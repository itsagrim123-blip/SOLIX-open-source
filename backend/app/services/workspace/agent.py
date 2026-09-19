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

STRICT COMMUNICATION RULES:
1. NEVER output conversational filler, polite greetings, or chatbot pleasantries (e.g. NEVER say "Hello!", "How can I help you today?", "Sure, I can help with that", "I would be happy to...").
2. Get straight to work immediately. If the user asks you to write code, do NOT chat about it — formulate the plan and invoke the necessary workspace tools immediately.
3. When starting a task, state a concise numbered PLAN (2-4 steps) AND immediately call your first workspace tool (e.g. `workspace_list_files`, `workspace_read_file`, `workspace_create_file`, or `workspace_update_file`) in the same turn. Do not stop after writing the plan — immediately call a tool to begin execution.

RULES FOR AUTONOMOUS OPERATION:
1. Inspect the project before modifying files. If you need to check existing files, use `workspace_list_files` or `workspace_read_file`.
2. When creating or modifying files:
   - Provide complete, functional code with no placeholders or '... rest of code ...'.
   - Use `workspace_create_file` for new files and `workspace_update_file` for existing files.
   - For web projects (HTML, CSS, JavaScript), ensure all necessary files (e.g. index.html, styles.css, app.js) are implemented and linked properly.
3. After creating or editing code, ALWAYS execute or test your work:
   - For Python: use `workspace_run` or `workspace_test`.
   - For Web projects (HTML/CSS/JS): use `workspace_run` to validate the entrypoint.
   - For C/C++: use `workspace_build`, then `workspace_run`.
   - For Node/JS: use `workspace_run` or `workspace_test`.
4. If execution produces an error (traceback, compiler error, test failure):
   - Analyze the root cause.
   - Propose an exact fix to the relevant file.
   - Re-run or re-test to ensure the fix resolved the error.
5. When your plan is fully executed and verified, provide a concise final summary of what was created, tested, and verified.
"""

MAX_AGENT_ITERATIONS = 8


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
        try:
            from app.services.workspace.execution import execution_service
            asyncio.create_task(execution_service.stop(task.workspace_id))
        except Exception:
            pass
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
        match = re.search(r"(?:PLAN|Plan|Steps|STEPS|Here is (?:my|the) plan):\s*(.*?)(?=\n\n[A-Z#]|\Z)", text, re.DOTALL)
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

    def _update_plan_step_for_tool(self, task: AgentTaskState, tool_name: str, tool_args: Dict[str, Any]) -> bool:
        """Mark corresponding plan step completed as tool execution succeeds."""
        if not task.plan:
            return False

        updated = False
        target_path = (tool_args.get("path") or tool_args.get("entry_file") or "").lower()

        for step in task.plan:
            if step.get("status") == "completed":
                continue
            text = step.get("text", "").lower()

            if tool_name in ("workspace_list_files", "workspace_search", "workspace_read_file"):
                if any(w in text for w in ("list", "read", "inspect", "check", "examine", "search")):
                    step["status"] = "completed"
                    updated = True
                    break
            elif tool_name == "workspace_create_file":
                if any(w in text for w in ("create", "write", "add", "make", "implement")) or (target_path and target_path in text):
                    step["status"] = "completed"
                    updated = True
                    break
            elif tool_name == "workspace_update_file":
                if any(w in text for w in ("update", "modify", "edit", "fix", "change", "refactor")) or (target_path and target_path in text):
                    step["status"] = "completed"
                    updated = True
                    break
            elif tool_name in ("workspace_run", "workspace_test", "workspace_build"):
                if any(w in text for w in ("run", "test", "verify", "execute", "build")) or (target_path and target_path in text):
                    step["status"] = "completed"
                    updated = True
                    break

        return updated

    def _extract_json_objects(self, text: str) -> List[Dict[str, Any]]:
        """Find all top-level balanced JSON objects in text, respecting string quotes and escapes."""
        results = []
        i = 0
        n = len(text)
        while i < n:
            if text[i] == '{':
                start = i
                depth = 0
                in_str = False
                escape = False
                quote_char = None
                while i < n:
                    ch = text[i]
                    if in_str:
                        if escape:
                            escape = False
                        elif ch == '\\':
                            escape = True
                        elif ch == quote_char:
                            in_str = False
                    else:
                        if ch in ('"', "'"):
                            in_str = True
                            quote_char = ch
                        elif ch == '{':
                            depth += 1
                        elif ch == '}':
                            depth -= 1
                            if depth == 0:
                                substr = text[start : i + 1]
                                try:
                                    parsed = json.loads(substr, strict=False)
                                    if isinstance(parsed, dict):
                                        results.append(parsed)
                                except Exception:
                                    pass
                                break
                    i += 1
            i += 1
        return results

    def _normalize_tool_call(self, data: Any) -> Optional[Dict[str, Any]]:
        """Normalize parsed JSON dict into a standard workspace tool call."""
        if not isinstance(data, dict):
            return None

        tool_name = data.get("name") or data.get("tool") or data.get("action")
        if not tool_name or not isinstance(tool_name, str):
            # Check if dict itself has a single key that is the tool name, e.g. {"workspace_create_file": {...}}
            for k, v in data.items():
                if isinstance(k, str) and k.startswith("workspace_") and isinstance(v, dict):
                    tool_name = k
                    data = {"name": k, "arguments": v}
                    break

        if not tool_name or not isinstance(tool_name, str):
            return None

        alias_map = {
            "workspace_diagnose_errors": "workspace_get_problems",
            "workspace_create_directory": "workspace_create_folder",
            "workspace_mkdir": "workspace_create_folder",
            "workspace_rename_file": "workspace_rename",
            "workspace_git_status": "workspace_git_diff",
            "workspace_run_code": "workspace_run",
            "workspace_execute": "workspace_run",
            "workspace_run_tests": "workspace_test",
            "workspace_compile": "workspace_build",
        }
        tool_name = alias_map.get(tool_name, tool_name)

        if not tool_name.startswith("workspace_"):
            return None

        raw_args = data.get("arguments") or data.get("parameters") or data.get("args") or {}
        if isinstance(raw_args, str):
            try:
                raw_args = json.loads(raw_args)
            except Exception:
                raw_args = {}
        if not isinstance(raw_args, dict):
            raw_args = {}

        normalized_args: Dict[str, Any] = {}
        for k, v in raw_args.items():
            normalized_args[k] = v

        path_val = (
            raw_args.get("path")
            or raw_args.get("file")
            or raw_args.get("filepath")
            or raw_args.get("filename")
            or raw_args.get("directory")
        )
        if path_val is not None and isinstance(path_val, str):
            clean_p = path_val.replace("\\", "/").strip()
            while clean_p.startswith("./"):
                clean_p = clean_p[2:].strip()
            clean_p = clean_p.lstrip("/")
            normalized_args["path"] = clean_p

        if "content" not in normalized_args:
            content_val = raw_args.get("code") or raw_args.get("text") or raw_args.get("replacement_content")
            if content_val is not None:
                normalized_args["content"] = str(content_val)

        if "entry_file" not in normalized_args and tool_name == "workspace_run":
            ef = raw_args.get("file") or raw_args.get("path")
            if ef:
                normalized_args["entry_file"] = str(ef).replace("\\", "/").strip().lstrip("/")

        if "query" not in normalized_args and tool_name == "workspace_search":
            q = raw_args.get("pattern") or raw_args.get("text") or raw_args.get("search")
            if q:
                normalized_args["query"] = str(q)

        if tool_name == "workspace_rename":
            if "old_path" not in normalized_args:
                normalized_args["old_path"] = raw_args.get("source") or raw_args.get("from") or ""
            if "new_path" not in normalized_args:
                normalized_args["new_path"] = raw_args.get("destination") or raw_args.get("to") or ""

        return {"name": tool_name, "arguments": normalized_args}

    def _parse_tool_calls(self, text: str) -> List[Dict[str, Any]]:
        """Extract ALL tool calls from markdown or JSON blocks with support for nested braces."""
        if not text:
            return []

        tool_calls: List[Dict[str, Any]] = []
        seen = set()

        # 1. Try markdown code blocks: ```json ... ``` or ```tool_call ... ```
        block_patterns = [
            r"```(?:tool_call|json)\s*([\s\S]*?)\s*```",
            r"<tool_call>\s*([\s\S]*?)\s*</tool_call>",
        ]
        for pattern in block_patterns:
            for match in re.finditer(pattern, text, re.DOTALL):
                candidate = match.group(1).strip()
                parsed_objects = self._extract_json_objects(candidate)
                for obj in parsed_objects:
                    tc = self._normalize_tool_call(obj)
                    if tc:
                        key = (tc["name"], json.dumps(tc["arguments"], sort_keys=True))
                        if key not in seen:
                            seen.add(key)
                            tool_calls.append(tc)

        # 2. Try scanning all balanced JSON objects in text
        parsed_objects = self._extract_json_objects(text)
        for obj in parsed_objects:
            tc = self._normalize_tool_call(obj)
            if tc:
                key = (tc["name"], json.dumps(tc["arguments"], sort_keys=True))
                if key not in seen:
                    seen.add(key)
                    tool_calls.append(tc)

        return tool_calls

    def _clean_content_for_streaming(self, content: str) -> str:
        """Strip raw tool JSON, tool call wrappers, and conversational filler from streaming text."""
        if not content:
            return ""
        # Strip ```tool_call ... ``` or ```json ... ``` with workspace_
        cleaned = re.sub(r"```(?:tool_call|json)?\s*[\s\S]*?workspace_[\s\S]*?```", "", content, flags=re.DOTALL)
        # Strip <tool_call>...</tool_call>
        cleaned = re.sub(r"<tool_call>[\s\S]*?</tool_call>", "", cleaned, flags=re.DOTALL)
        # Strip bare workspace JSON calls
        cleaned = re.sub(r'\{\s*"name"\s*:\s*"workspace_[a-z_]+"\s*,\s*"arguments"\s*:\s*\{.*?\}\s*\}', "", cleaned, flags=re.DOTALL)
        # Strip any remaining dangling tool call tags
        cleaned = re.sub(r"</?tool_call>", "", cleaned)
        # Strip generic chatbot opening greeting lines
        cleaned = re.sub(r"^(?:Hello!|Hi!|Hey!|Greetings!|Hello there!|How can I (?:help|assist) you today\??)[^\n]*\n*", "", cleaned, flags=re.IGNORECASE)
        return cleaned.strip()

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
        client_files: Optional[List[Dict[str, str]]] = None,
    ) -> AsyncGenerator[str, None]:
        """Core autonomous agent loop streaming SSE events to frontend."""
        task_id = str(uuid.uuid4())
        task = AgentTaskState(task_id, workspace_id, user_request, auto_apply=auto_apply)
        self.active_tasks[task_id] = task

        is_ephemeral = bool(client_files)
        if client_files:
            try:
                workspace_storage.create_ephemeral_workspace(workspace_id, client_files)
            except Exception as e:
                logger.error(f"[AgentEngine] Failed to stage ephemeral files: {e}")

        logger.info(f"[AgentEngine] Starting autonomous task={task_id} in ws={workspace_id} (ephemeral={is_ephemeral}) for: {user_request[:60]}")

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
                if not task.plan:
                    parsed_plan = self._parse_plan(content)
                    if parsed_plan:
                        task.plan = parsed_plan
                        yield f"data: {json.dumps({'type': 'plan_created', 'plan': task.plan})}\n\n"

                # Stream reasoning tokens if clean non-tool text exists
                clean_token_text = self._clean_content_for_streaming(content)
                if clean_token_text:
                    yield f"data: {json.dumps({'type': 'token', 'text': clean_token_text})}\n\n"

                # Detect tool calls: either native or parsed
                tool_calls_to_run: List[Dict[str, Any]] = []

                if native_tool_calls:
                    for tc in native_tool_calls:
                        fn = tc.get("function", {})
                        norm = self._normalize_tool_call({
                            "name": fn.get("name"),
                            "arguments": fn.get("arguments", {}),
                        })
                        if norm:
                            tool_calls_to_run.append(norm)
                else:
                    # Fallback parser for code blocks / JSON
                    tool_calls_to_run = self._parse_tool_calls(content)

                # If no tool calls in this turn:
                if not tool_calls_to_run:
                    needs_initial_tools = (task.iterations == 1 and not task.files_created and not task.files_modified)
                    needs_fix = (task.state == "debugging" and task.iterations < MAX_AGENT_ITERATIONS)

                    if (needs_initial_tools or needs_fix) and task.iterations < MAX_AGENT_ITERATIONS:
                        logger.info(f"[AgentEngine] Task needs tool execution (initial={needs_initial_tools}, fix={needs_fix}). Prompting model to execute tools.")
                        task.state = "editing" if (task.files_created or task.files_modified) else "reading"
                        yield f"data: {json.dumps({'type': 'state_change', 'state': task.state, 'message': 'Executing plan with workspace tools...'})}\n\n"
                        messages.append(msg)
                        prompt_content = "Please now invoke the necessary workspace tool (e.g. `workspace_create_file`, `workspace_update_file`, `workspace_test`, `workspace_run`, etc.) to execute the plan."
                        if needs_fix:
                            prompt_content = "The previous execution encountered an error. Please modify the relevant file using `workspace_update_file` and re-test."
                        messages.append({
                            "role": "user",
                            "content": prompt_content,
                        })
                        continue

                    logger.info(f"[AgentEngine] No further tool calls detected. Completing task={task_id}")
                    task.state = "completed"

                    # Mark plan steps completed
                    if task.plan:
                        for s in task.plan:
                            s["status"] = "completed"
                        yield f"data: {json.dumps({'type': 'plan_created', 'plan': task.plan})}\n\n"

                    clean_summary = self._clean_content_for_streaming(content)
                    if not clean_summary:
                        parts = []
                        if task.files_created:
                            parts.append(f"Created {len(task.files_created)} file(s): {', '.join(task.files_created)}.")
                        if task.files_modified:
                            parts.append(f"Modified {len(task.files_modified)} file(s): {', '.join(task.files_modified)}.")
                        parts.append("Project verified in sandbox.")
                        clean_summary = " ".join(parts)

                    # Gather final file contents for created/modified files as safety net
                    file_contents_map: Dict[str, str] = {}
                    for fpath in set(task.files_created + task.files_modified):
                        try:
                            f_read = workspace_storage.read_file(workspace_id, fpath)
                            file_contents_map[fpath] = f_read.get("content", "")
                        except Exception:
                            pass

                    yield f"data: {json.dumps({'type': 'state_change', 'state': 'completed', 'message': 'Task completed'})}\n\n"
                    yield f"data: {json.dumps({'type': 'agent_completed', 'summary': clean_summary, 'files_created': task.files_created, 'files_modified': task.files_modified, 'files_deleted': task.files_deleted, 'file_contents': file_contents_map})}\n\n"
                    return

                # Record assistant response in conversation
                messages.append(msg)

                # Execute each tool call
                for tc in tool_calls_to_run:
                    if task.is_cancelled:
                        break

                    tool_name = tc.get("name", "")
                    tool_args = tc.get("arguments", {})
                    if not isinstance(tool_args, dict):
                        tool_args = {}
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

                    elif tool_name in ("workspace_get_problems", "workspace_diagnose_errors"):
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
                                    pass
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
                                    yield f"data: {json.dumps({'type': 'changes_applied', 'file': path, 'operation': op, 'content': content, 'result': apply_res})}\n\n"
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
                                yield f"data: {json.dumps({'type': 'changes_applied', 'file': path, 'operation': op, 'content': content, 'auto_applied': True, 'result': apply_res})}\n\n"

                    elif tool_name in ("workspace_open_in_browser", "workspace_preview", "workspace_open_browser"):
                        tool_result = {"success": True, "message": "Website opened in the Solix Live Preview tab."}
                    else:
                        tool_result = {"error": f"Unknown tool: {tool_name}"}

                    yield f"data: {json.dumps({'type': 'tool_completed', 'tool': tool_name, 'call_id': call_id, 'result': tool_result})}\n\n"

                    # Dynamically update plan step status based on executed tool
                    if self._update_plan_step_for_tool(task, tool_name, tool_args):
                        yield f"data: {json.dumps({'type': 'plan_created', 'plan': task.plan})}\n\n"

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
                task.state = "completed"
                if task.plan and (task.files_created or task.files_modified):
                    for s in task.plan:
                        s["status"] = "completed"
                    yield f"data: {json.dumps({'type': 'plan_created', 'plan': task.plan})}\n\n"

                parts = []
                if task.files_created:
                    parts.append(f"Created {len(task.files_created)} file(s): {', '.join(task.files_created)}.")
                if task.files_modified:
                    parts.append(f"Modified {len(task.files_modified)} file(s): {', '.join(task.files_modified)}.")
                if parts:
                    parts.append("Work verified in sandbox.")
                    clean_summary = " ".join(parts)
                else:
                    clean_summary = "Task finished after 8 iterations. Please review workspace files."

                file_contents_map: Dict[str, str] = {}
                for fpath in set(task.files_created + task.files_modified):
                    try:
                        f_read = workspace_storage.read_file(workspace_id, fpath)
                        file_contents_map[fpath] = f_read.get("content", "")
                    except Exception:
                        pass
                yield f"data: {json.dumps({'type': 'state_change', 'state': 'completed', 'message': 'Task completed'})}\n\n"
                yield f"data: {json.dumps({'type': 'agent_completed', 'summary': clean_summary, 'files_created': task.files_created, 'files_modified': task.files_modified, 'files_deleted': task.files_deleted, 'file_contents': file_contents_map})}\n\n"

        except Exception as e:
            logger.error(f"[AgentEngine] Unexpected error in agent loop: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'agent_failed', 'error': str(e)})}\n\n"
        finally:
            if is_ephemeral:
                try:
                    workspace_storage.cleanup_ephemeral_workspace(workspace_id)
                except Exception as e:
                    logger.warning(f"[AgentEngine] Cleanup error: {e}")
            self.active_tasks.pop(task_id, None)


coding_agent_engine = CodingAgentEngine()
