from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional
import uuid
import httpx

from app.core.config import settings
from app.providers.factory import get_active_provider
from app.services.workspace.languages import language_registry
from app.services.workspace.storage import workspace_storage
from app.services.workspace.tools import workspace_tools

logger = logging.getLogger("solix.workspace.agent")

AGENT_SYSTEM_PROMPT = """You are Solix Autonomous Coding Agent, an elite AI software engineer operating inside the Solix Coding Workspace.
You reason across entire multi-file codebases, formulate explicit step-by-step plans, create and modify files, run the code in the Solix sandbox, diagnose runtime and compiler errors, and iterate until the code is fully verified.

RULES FOR AUTONOMOUS OPERATION:
1. ALWAYS begin complex tasks by writing a concise, numbered plan:
   PLAN:
   1. [Step description]
   2. [Step description]
   ...
2. Inspect the project before modifying files. If you need to find symbols or definitions, use `workspace_search`. If you need to see file content, use `workspace_read_file`.
3. When creating or modifying files:
   - Provide complete, functional code with no placeholders or '... rest of code ...'.
   - Use `workspace_create_file` for new files and `workspace_update_file` for existing files.
   - The user will review the unified diff in their editor before the changes are applied.
4. After creating or editing code, ALWAYS execute or test your work:
   - For Python: use `workspace_run` or `workspace_test`.
   - For C/C++: use `workspace_build`, then `workspace_run`.
   - For Node/JS: use `workspace_run` or `workspace_test`.
5. If execution produces an error (traceback, compiler error, test failure):
   - Analyze the root cause.
   - Propose an exact fix to the relevant file.
   - Re-run or re-test to ensure the fix resolved the error.
6. When your plan is fully executed and verified, provide a concise final summary of what was created, tested, and verified.
"""

MAX_AGENT_ITERATIONS = 5


class AgentTaskState:
    def __init__(self, task_id: str, workspace_id: str, user_request: str, auto_apply: bool = False):
        self.task_id = task_id
        self.workspace_id = workspace_id
        self.user_request = user_request
        self.auto_apply = auto_apply
        self.state: str = "idle"
        self.plan: List[Dict[str, Any]] = []
        self.is_cancelled: bool = False
        self.approval_future: Optional[asyncio.Future] = None
        self.pending_approval: Optional[Dict[str, Any]] = None
        self.files_created: List[str] = []
        self.files_modified: List[str] = []
        self.files_deleted: List[str] = []
        self.iterations: int = 0
        self.created_at = time.time()


class CodingAgentEngine:
    """Orchestrates autonomous multi-turn tool-calling loops with qwen2.5-coder:7b."""

    def __init__(self):
        self.active_tasks: Dict[str, AgentTaskState] = {}

    def get_task(self, task_id: str) -> Optional[AgentTaskState]:
        return self.active_tasks.get(task_id)

    def cancel_task(self, task_id: str) -> bool:
        """Cancel an in-progress agent task."""
        task = self.active_tasks.get(task_id)
        if not task:
            return False
        task.is_cancelled = True
        task.state = "cancelled"
        if task.approval_future and not task.approval_future.done():
            task.approval_future.cancel()
        logger.info(f"[AgentEngine] Cancelled task={task_id} in ws={task.workspace_id}")
        return True

    def resolve_approval(self, task_id: str, approval_id: str, approved: bool) -> bool:
        """Resolve a pending user approval for staged file modifications."""
        task = self.active_tasks.get(task_id)
        if not task or not task.approval_future or task.approval_future.done():
            return False
        if task.pending_approval and task.pending_approval.get("approval_id") == approval_id:
            task.approval_future.set_result(approved)
            logger.info(f"[AgentEngine] Resolved approval {approval_id} as approved={approved} for task={task_id}")
            return True
        return False

    def _parse_plan(self, text: str) -> List[Dict[str, Any]]:
        """Extract numbered plan items from model response."""
        plan_items: List[Dict[str, Any]] = []
        match = re.search(r"PLAN:\s*(.*?)(?=\n\n|\n[A-Z#]|\Z)", text, re.DOTALL | re.IGNORECASE)
        plan_text = match.group(1) if match else text

        for line in plan_text.splitlines():
            line = line.strip()
            item_match = re.match(r"^(?:\d+[\.\)]|\-|\*)\s+(.+)$", line)
            if item_match:
                plan_items.append({
                    "id": len(plan_items) + 1,
                    "text": item_match.group(1).strip(),
                    "status": "pending",
                })

        return plan_items[:10]

    def _parse_tool_call(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract tool call from markdown or JSON block fallback."""
        # 1. ```tool_call ... ```
        match = re.search(r"```(?:tool_call|json)\s*(\{.*?\})\s*```", text, re.DOTALL)
        if not match:
            # 2. <tool_call>...</tool_call>
            match = re.search(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", text, re.DOTALL)
        if not match:
            # 3. Bare JSON with "name" and "arguments"
            match = re.search(r'(\{\s*"name"\s*:\s*"workspace_[a-z_]+"\s*,\s*"arguments"\s*:\s*\{.*?\}\s*\})', text, re.DOTALL)

        if match:
            try:
                data = json.loads(match.group(1), strict=False)
                if "name" in data and isinstance(data["name"], str) and data["name"].startswith("workspace_"):
                    return {"name": data["name"], "arguments": data.get("arguments", {})}
            except Exception:
                pass
        return None

    def _build_project_grounding(self, workspace_id: str, active_file: Optional[str] = None) -> str:
        """Create a concise grounding snapshot for the agent."""
        tree = workspace_storage.get_workspace_tree(workspace_id)
        lines = []

        def recurse(nodes, indent=0):
            for n in nodes:
                pfx = "  " * indent
                if n.get("is_directory"):
                    lines.append(f"{pfx}📁 {n['name']}/")
                    recurse(n.get("children", []), indent + 1)
                else:
                    lines.append(f"{pfx}📄 {n['name']} ({n.get('size', 0)} B)")

        recurse(tree)
        tree_str = "\n".join(lines[:35])

        active_file_content = ""
        if active_file:
            try:
                f_data = workspace_storage.read_file(workspace_id, active_file)
                active_file_content = f"\n--- ACTIVE EDITOR FILE ({active_file}) ---\n{f_data['content']}\n"
            except Exception:
                pass

        runtimes_map = language_registry.detect_runtimes()
        runtime_names = ", ".join([r.display_name for r in runtimes_map.values() if r.available])

        return (
            f"--- WORKSPACE PROJECT OVERVIEW ---\n"
            f"Available Runtimes in Sandbox: {runtime_names}\n"
            f"File Tree:\n{tree_str}\n"
            f"{active_file_content}"
        )

    async def run_agent_loop(
        self,
        workspace_id: str,
        user_request: str,
        active_file: Optional[str] = None,
        auto_apply: bool = False,
    ) -> AsyncGenerator[str, None]:
        """Core autonomous agent loop streaming SSE events to frontend."""
        task_id = str(uuid.uuid4())
        task = AgentTaskState(task_id, workspace_id, user_request, auto_apply=auto_apply)
        self.active_tasks[task_id] = task

        logger.info(f"[AgentEngine] Starting autonomous task={task_id} in ws={workspace_id} for: {user_request[:60]}")

        # Initial event
        yield f"data: {json.dumps({'type': 'agent_started', 'task_id': task_id, 'model': settings.OLLAMA_CODING_MODEL, 'user_request': user_request})}\n\n"

        provider, is_connected = await get_active_provider()
        if not is_connected:
            yield f"data: {json.dumps({'type': 'agent_failed', 'error': f'Code AI unavailable — Ollama is offline at {settings.OLLAMA_BASE_URL}. Please start Ollama.'})}\n\n"
            return

        model_name = settings.OLLAMA_CODING_MODEL
        if hasattr(provider, "resolve_model_name"):
            resolved = await provider.resolve_model_name(model_name)
            if resolved:
                model_name = resolved
            else:
                yield f"data: {json.dumps({'type': 'agent_failed', 'error': f'Code AI model unavailable — {model_name} is not installed in local Ollama. Run `ollama pull {model_name}`.'})}\n\n"
                return

        # 1. State: PLANNING
        task.state = "planning"
        yield f"data: {json.dumps({'type': 'state_change', 'state': 'planning', 'message': 'Formulating plan...'})}\n\n"

        grounding = self._build_project_grounding(workspace_id, active_file)
        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": AGENT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"{grounding}\n\n"
                    f"--- USER REQUEST ---\n"
                    f"{user_request}\n\n"
                    f"Please inspect the workspace, formulate a concise plan, and use tools to solve this request."
                ),
            },
        ]

        tool_defs = workspace_tools.get_tool_definitions()

        try:
            while task.iterations < MAX_AGENT_ITERATIONS and not task.is_cancelled:
                task.iterations += 1
                logger.info(f"[AgentEngine] Iteration {task.iterations}/{MAX_AGENT_ITERATIONS} for task={task_id}")

                # Call Ollama via HTTP to support tools parameter
                ollama_payload = {
                    "model": model_name,
                    "messages": messages,
                    "tools": tool_defs,
                    "stream": False,
                    "options": {"temperature": 0.2},
                }

                try:
                    async with httpx.AsyncClient(timeout=90.0) as client:
                        resp = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=ollama_payload)
                        if resp.status_code != 200:
                            raise RuntimeError(f"Ollama returned HTTP {resp.status_code}: {resp.text}")
                        resp_data = resp.json()
                except Exception as e:
                    logger.error(f"[AgentEngine] Ollama request failed: {e}")
                    yield f"data: {json.dumps({'type': 'agent_failed', 'error': f'Ollama error: {e}'})}\n\n"
                    return

                msg = resp_data.get("message", {})
                content = msg.get("content", "")
                native_tool_calls = msg.get("tool_calls", [])

                # If model generated a plan in text, parse and emit plan
                if "PLAN:" in content and not task.plan:
                    parsed_plan = self._parse_plan(content)
                    if parsed_plan:
                        task.plan = parsed_plan
                        yield f"data: {json.dumps({'type': 'plan_created', 'plan': task.plan})}\n\n"

                # Stream reasoning tokens if content exists
                if content:
                    yield f"data: {json.dumps({'type': 'token', 'text': content})}\n\n"

                # Detect tool calls: either native or parsed
                tool_calls_to_run: List[Dict[str, Any]] = []

                if native_tool_calls:
                    for tc in native_tool_calls:
                        fn = tc.get("function", {})
                        tool_calls_to_run.append({
                            "name": fn.get("name"),
                            "arguments": fn.get("arguments", {}),
                        })
                else:
                    # Fallback parser for code blocks / JSON
                    parsed_tc = self._parse_tool_call(content)
                    if parsed_tc:
                        tool_calls_to_run.append(parsed_tc)

                # If no tool calls in this turn:
                if not tool_calls_to_run:
                    # If model just outlined a plan or has pending steps, prompt it to execute the steps with tools!
                    has_pending = task.plan and any(step.get("status") in ("pending", "in_progress") for step in task.plan)
                    if has_pending and task.iterations < MAX_AGENT_ITERATIONS:
                        logger.info(f"[AgentEngine] Plan created or pending steps remain. Prompting model to execute tools.")
                        messages.append(msg)
                        messages.append({
                            "role": "user",
                            "content": "Plan noted. Please now invoke the necessary workspace tools (e.g. `workspace_create_file`, `workspace_update_file`, `workspace_test`, etc.) to execute the plan step by step.",
                        })
                        continue

                    logger.info(f"[AgentEngine] No further tool calls detected. Completing task={task_id}")
                    task.state = "completed"
                    yield f"data: {json.dumps({'type': 'state_change', 'state': 'completed', 'message': 'Task completed'})}\n\n"
                    yield f"data: {json.dumps({'type': 'agent_completed', 'summary': content, 'files_created': task.files_created, 'files_modified': task.files_modified, 'files_deleted': task.files_deleted})}\n\n"
                    return

                # Record assistant response in conversation
                messages.append(msg)

                # Execute each tool call
                for tc in tool_calls_to_run:
                    if task.is_cancelled:
                        break

                    tool_name = tc.get("name", "")
                    tool_args = tc.get("arguments", {})
                    call_id = str(uuid.uuid4())[:8]

                    logger.info(f"[AgentEngine] Executing tool {tool_name} with args: {tool_args}")
                    yield f"data: {json.dumps({'type': 'tool_started', 'tool': tool_name, 'args': tool_args, 'call_id': call_id})}\n\n"

                    # ── State transitions based on tool ──
                    if tool_name in ("workspace_read_file", "workspace_list_files", "workspace_search"):
                        task.state = "reading"
                        target_path = tool_args.get("path", "workspace")
                        yield f"data: {json.dumps({'type': 'state_change', 'state': 'reading', 'message': f'Reading {target_path}'})}\n\n"
                    elif tool_name in ("workspace_create_file", "workspace_update_file", "workspace_delete_file"):
                        task.state = "editing"
                        target_file = tool_args.get("path", "file")
                        yield f"data: {json.dumps({'type': 'state_change', 'state': 'editing', 'message': f'Staging {target_file}'})}\n\n"
                    elif tool_name == "workspace_build":
                        task.state = "building"
                        yield f"data: {json.dumps({'type': 'state_change', 'state': 'building', 'message': 'Building project...'})}\n\n"
                    elif tool_name == "workspace_run":
                        task.state = "running"
                        yield f"data: {json.dumps({'type': 'state_change', 'state': 'running', 'message': 'Executing code in sandbox...'})}\n\n"
                    elif tool_name == "workspace_test":
                        task.state = "testing"
                        yield f"data: {json.dumps({'type': 'state_change', 'state': 'testing', 'message': 'Running test suite...'})}\n\n"

                    # ── Execute Tool ──
                    tool_result: Dict[str, Any] = {}

                    if tool_name == "workspace_list_files":
                        tool_result = workspace_tools.list_files(workspace_id, path=tool_args.get("path", ""))

                    elif tool_name == "workspace_read_file":
                        tool_result = workspace_tools.read_file(workspace_id, path=tool_args.get("path", ""))

                    elif tool_name == "workspace_search":
                        tool_result = workspace_tools.search_project(workspace_id, query=tool_args.get("query", ""))

                    elif tool_name == "workspace_create_folder":
                        tool_result = workspace_tools.create_folder(workspace_id, path=tool_args.get("path", ""))

                    elif tool_name == "workspace_rename":
                        tool_result = workspace_tools.rename_path(workspace_id, old_path=tool_args.get("old_path", ""), new_path=tool_args.get("new_path", ""))

                    elif tool_name == "workspace_get_problems":
                        tool_result = workspace_tools.get_problems(workspace_id)

                    elif tool_name == "workspace_git_diff":
                        tool_result = workspace_tools.git_diff(workspace_id)

                    elif tool_name == "workspace_build":
                        yield f"data: {json.dumps({'type': 'build_started'})}\n\n"
                        tool_result = await workspace_tools.build_workspace(workspace_id)
                        yield f"data: {json.dumps({'type': 'build_completed', 'result': tool_result})}\n\n"

                    elif tool_name == "workspace_run":
                        yield f"data: {json.dumps({'type': 'run_started'})}\n\n"
                        tool_result = await workspace_tools.run_workspace(
                            workspace_id,
                            entry_file=tool_args.get("entry_file"),
                            args=tool_args.get("args"),
                        )
                        yield f"data: {json.dumps({'type': 'run_completed', 'result': tool_result})}\n\n"

                    elif tool_name == "workspace_test":
                        yield f"data: {json.dumps({'type': 'test_started'})}\n\n"
                        tool_result = await workspace_tools.test_workspace(workspace_id)
                        yield f"data: {json.dumps({'type': 'test_completed', 'result': tool_result})}\n\n"

                    # ── Staged File Operations (Create, Update, Delete) ──
                    elif tool_name in ("workspace_create_file", "workspace_update_file", "workspace_delete_file"):
                        path = tool_args.get("path", "")
                        content = tool_args.get("content", "")

                        if tool_name == "workspace_create_file":
                            stage_res = workspace_tools.stage_file_creation(workspace_id, path, content)
                        elif tool_name == "workspace_update_file":
                            stage_res = workspace_tools.stage_file_update(workspace_id, path, content)
                        else:
                            stage_res = workspace_tools.stage_file_deletion(workspace_id, path)

                        if not stage_res.get("success"):
                            tool_result = stage_res
                        else:
                            op = stage_res.get("operation")
                            approval_id = str(uuid.uuid4())

                            # Check if approval is required
                            # Deletion ALWAYS requires approval; creation/modification requires approval unless auto_apply
                            needs_approval = (not task.auto_apply) or (op == "delete")

                            if needs_approval:
                                task.state = "awaiting_approval"
                                approval_req = {
                                    "approval_id": approval_id,
                                    "operation": op,
                                    "file": path,
                                    "before": stage_res.get("before", ""),
                                    "after": stage_res.get("after", ""),
                                    "diff": stage_res.get("diff", ""),
                                    "explanation": stage_res.get("explanation", f"{op.capitalize()} {path}"),
                                }
                                task.pending_approval = approval_req
                                loop = asyncio.get_running_loop()
                                task.approval_future = loop.create_future()

                                yield f"data: {json.dumps({'type': 'state_change', 'state': 'awaiting_approval', 'message': f'Waiting for approval to {op} {path}'})}\n\n"
                                yield f"data: {json.dumps({'type': 'approval_required', 'request': approval_req})}\n\n"

                                try:
                                    # Wait for user approval (5 minutes timeout)
                                    is_approved = await asyncio.wait_for(task.approval_future, timeout=300.0)
                                except asyncio.TimeoutError:
                                    is_approved = False
                                    logger.warning(f"[AgentEngine] Approval timed out for {path}")
                                except asyncio.CancelledError:
                                    is_approved = False
                                    logger.info(f"[AgentEngine] Approval cancelled for {path}")

                                task.pending_approval = None
                                task.approval_future = None

                                if is_approved:
                                    task.state = "applying"
                                    yield f"data: {json.dumps({'type': 'state_change', 'state': 'applying', 'message': f'Applying changes to {path}...'})}\n\n"
                                    apply_res = workspace_tools.apply_file_operation(workspace_id, op, path, content)
                                    if op == "create":
                                        task.files_created.append(path)
                                    elif op == "modify":
                                        task.files_modified.append(path)
                                    elif op == "delete":
                                        task.files_deleted.append(path)

                                    tool_result = {"status": "applied", "file": path, "operation": op, "result": apply_res}
                                    yield f"data: {json.dumps({'type': 'changes_applied', 'file': path, 'operation': op, 'result': apply_res})}\n\n"
                                else:
                                    tool_result = {"status": "rejected", "file": path, "message": "User rejected this change. Please adapt your plan."}
                                    yield f"data: {json.dumps({'type': 'changes_rejected', 'file': path, 'operation': op})}\n\n"
                            else:
                                # Auto apply enabled (creation or modification)
                                task.state = "applying"
                                yield f"data: {json.dumps({'type': 'state_change', 'state': 'applying', 'message': f'Auto-applying changes to {path}...'})}\n\n"
                                apply_res = workspace_tools.apply_file_operation(workspace_id, op, path, content)
                                if op == "create":
                                    task.files_created.append(path)
                                elif op == "modify":
                                    task.files_modified.append(path)

                                tool_result = {"status": "auto_applied", "file": path, "operation": op, "result": apply_res}
                                yield f"data: {json.dumps({'type': 'changes_applied', 'file': path, 'operation': op, 'auto_applied': True})}\n\n"

                    else:
                        tool_result = {"error": f"Unknown tool: {tool_name}"}

                    yield f"data: {json.dumps({'type': 'tool_completed', 'tool': tool_name, 'call_id': call_id, 'result': tool_result})}\n\n"

                    # Check for errors in execution tools to enter debugging state
                    if tool_name in ("workspace_run", "workspace_build", "workspace_test"):
                        exit_code = tool_result.get("exit_code", 0)
                        if exit_code != 0:
                            task.state = "debugging"
                            yield f"data: {json.dumps({'type': 'state_change', 'state': 'debugging', 'message': 'Diagnosing error & preparing fix...'})}\n\n"
                            yield f"data: {json.dumps({'type': 'problem_detected', 'tool': tool_name, 'stderr': tool_result.get('stderr', '')[:500]})}\n\n"

                    # Add tool response to message history
                    messages.append({
                        "role": "tool",
                        "content": json.dumps(tool_result),
                        "name": tool_name,
                    })

            if task.is_cancelled:
                yield f"data: {json.dumps({'type': 'agent_cancelled', 'message': 'Agent task was stopped by user.'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'agent_completed', 'summary': 'Maximum iterations reached.', 'files_created': task.files_created, 'files_modified': task.files_modified, 'files_deleted': task.files_deleted})}\n\n"

        except Exception as e:
            logger.error(f"[AgentEngine] Unexpected error in agent loop: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'agent_failed', 'error': str(e)})}\n\n"
        finally:
            self.active_tasks.pop(task_id, None)


coding_agent_engine = CodingAgentEngine()
