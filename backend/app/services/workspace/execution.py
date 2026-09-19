from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
import uuid
from pydantic import BaseModel

from app.core.config import settings
from app.services.workspace.compiler import compiler_service
from app.services.workspace.diagnostics import DiagnosticItem, diagnostic_parser
from app.services.workspace.languages import language_registry
from app.services.workspace.storage import workspace_storage

logger = logging.getLogger("solix.workspace.execution")

BLOCKED_COMMAND_KEYWORDS = {
    "rmdir",
    "del /s",
    "format",
    "diskpart",
    "reg",
    "regedit",
    "shutdown",
    "net user",
    "takeown",
    "icacls",
    "schtasks",
    "powershell",
    "curl",
    "wget",
    "nc",
    "ncat",
    "certutil",
}

BLOCKED_ENV_KEYS = {
    "key",
    "secret",
    "password",
    "token",
    "credential",
    "database",
    "tavily",
    "ollama",
    "dashboard",
    "auth",
    "cookie",
}


def sanitize_environment() -> Dict[str, str]:
    """Create a strictly scrubbed environment dictionary stripping all sensitive host secrets."""
    safe_env: Dict[str, str] = {}

    allowed_exact_keys = {
        "SYSTEMROOT",
        "WINDIR",
        "COMSPEC",
        "PATHEXT",
        "TEMP",
        "TMP",
        "LANG",
        "LC_ALL",
        "PYTHONIOENCODING",
        "PYTHONUNBUFFERED",
    }

    for key, val in os.environ.items():
        k_lower = key.lower()
        if any(bad in k_lower for bad in BLOCKED_ENV_KEYS):
            continue

        if key in allowed_exact_keys:
            safe_env[key] = val
        elif key == "PATH":
            # Include system PATH + local toolchain paths
            safe_env["PATH"] = val

    safe_env["PYTHONUNBUFFERED"] = "1"
    safe_env["PYTHONIOENCODING"] = "utf-8"
    safe_env["NODE_ENV"] = "development"
    return safe_env


class ActiveExecution:
    def __init__(self, execution_id: str, workspace_id: str, proc: asyncio.subprocess.Process, command: str):
        self.execution_id = execution_id
        self.workspace_id = workspace_id
        self.proc = proc
        self.command = command
        self.start_time = time.time()


class ExecutionManager:
    """Manages builds, runs, tests, process tracking, timeouts, and structured diagnostics."""

    def __init__(self):
        self.active_executions: Dict[str, ActiveExecution] = {}  # execution_id -> ActiveExecution
        self.workspace_active: Dict[str, str] = {}  # workspace_id -> execution_id

    def detect_run_command(self, ws_dir: Path) -> Tuple[List[str], bool]:
        """Detect the appropriate run command and whether a build is required first."""
        proj_lang = language_registry.detect_project_language(ws_dir)
        bin_name = "main.exe" if os.name == "nt" else "main"
        target_bin = ws_dir / "build" / bin_name

        if proj_lang:
            if proj_lang.id in ("cpp", "c"):
                # Compiled executable
                return [str(target_bin)], True

            if proj_lang.id == "typescript":
                # Built JS file in build/
                ts_entry = ws_dir / "build" / "index.js"
                return ["node", str(ts_entry.relative_to(ws_dir))], True

            if proj_lang.id == "python":
                py_bin = sys.executable
                if (ws_dir / "main.py").exists():
                    return [py_bin, "main.py"], False
                if (ws_dir / "app.py").exists():
                    return [py_bin, "app.py"], False
                all_pys = list(ws_dir.glob("*.py"))
                if all_pys:
                    return [py_bin, all_pys[0].name], False

            if proj_lang.id == "javascript":
                if (ws_dir / "package.json").exists():
                    if (ws_dir / "index.js").exists():
                        return ["node", "index.js"], False
                    if (ws_dir / "main.js").exists():
                        return ["node", "main.js"], False
                if (ws_dir / "index.js").exists():
                    return ["node", "index.js"], False
                if (ws_dir / "main.js").exists():
                    return ["node", "main.js"], False

        # Fallback inspection
        if (ws_dir / "main.py").exists() or any(ws_dir.glob("*.py")):
            return [sys.executable, "main.py"], False

        raise ValueError("Could not auto-detect a runnable entry point (e.g. main.py, main.cpp, index.js). Please create an entrypoint or provide an explicit command.")

    def parse_user_command(self, raw_cmd: str, ws_dir: Path) -> List[str]:
        """Parse and sanitize user command."""
        cmd_lower = raw_cmd.lower().strip()
        for blocked in BLOCKED_COMMAND_KEYWORDS:
            if blocked in cmd_lower:
                raise ValueError(f"Command contains forbidden operation: '{blocked}'.")

        import shlex
        parts = shlex.split(raw_cmd, posix=(os.name != "nt"))
        parts = [p.strip('"\'') for p in parts if p.strip()]
        if not parts:
            raise ValueError("Command cannot be empty.")

        first = parts[0].lower()
        if first in ("python", "python3", "python.exe"):
            parts[0] = sys.executable

        return parts

    async def build(self, workspace_id: str) -> Dict[str, Any]:
        """Trigger project build/compilation without running."""
        ws_dir = workspace_storage.resolve_safe_path(workspace_id, ".")
        if not ws_dir.exists():
            raise FileNotFoundError(f"Workspace '{workspace_id}' not found.")

        result = await compiler_service.build(workspace_id, ws_dir)
        return {
            "workspace_id": workspace_id,
            "success": result.success,
            "command": result.command,
            "exit_code": result.exit_code,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "build_time": result.build_time,
            "binary_path": result.binary_path,
            "problems": [p.model_dump() for p in result.problems],
        }

    async def run(
        self,
        workspace_id: str,
        command: Optional[str] = None,
        is_test: bool = False,
    ) -> Dict[str, Any]:
        """Execute project code or tests in the sandboxed environment."""
        ws_dir = workspace_storage.resolve_safe_path(workspace_id, ".")
        if not ws_dir.exists():
            raise FileNotFoundError(f"Workspace '{workspace_id}' not found.")

        # Stop any active process for this workspace
        await self.stop(workspace_id=workspace_id)

        execution_id = str(uuid.uuid4())
        problems: List[DiagnosticItem] = []

        # If this is a test request, handle project test detection
        if is_test:
            return await self._run_tests(workspace_id, ws_dir, execution_id, command)

        # Fast-path for static web projects with index.html
        if not command and (ws_dir / "index.html").exists() and not (ws_dir / "main.py").exists() and not (ws_dir / "index.js").exists():
            return {
                "execution_id": execution_id,
                "workspace_id": workspace_id,
                "command": "web_preview index.html",
                "exit_code": 0,
                "stdout": "[Web Project]: index.html ready for Live Preview in browser.\n",
                "stderr": "",
                "execution_time": 0.01,
                "timed_out": False,
                "success": True,
                "problems": [],
            }

        # Determine run command and whether a build is required
        needs_build = False
        if command and command.strip():
            cmd_args = self.parse_user_command(command, ws_dir)
        else:
            cmd_args, needs_build = self.detect_run_command(ws_dir)

        stdout_chunks: List[str] = []
        stderr_chunks: List[str] = []
        start_time = time.time()
        exit_code = 0
        timed_out = False

        # If a build is required first (e.g. C++, C, TypeScript), perform compilation
        if needs_build:
            stdout_chunks.append(f"$ [Build]: Compiling project sources...\n")
            build_res = await compiler_service.build(workspace_id, ws_dir)
            if build_res.stdout:
                stdout_chunks.append(build_res.stdout)
            if build_res.stderr:
                stderr_chunks.append(build_res.stderr)

            if not build_res.success:
                problems.extend(build_res.problems)
                return {
                    "execution_id": execution_id,
                    "workspace_id": workspace_id,
                    "command": build_res.command,
                    "exit_code": build_res.exit_code or 1,
                    "stdout": "".join(stdout_chunks),
                    "stderr": "".join(stderr_chunks),
                    "execution_time": build_res.build_time,
                    "timed_out": False,
                    "success": False,
                    "problems": [p.model_dump() for p in problems],
                }

            # Update binary path if compiling to executable
            if build_res.binary_path:
                cmd_args[0] = build_res.binary_path

        cmd_display = " ".join(cmd_args)
        logger.info(f"[Execution] Starting {execution_id} in ws={workspace_id}: {cmd_display}")

        banner = (
            f"$ {Path(cmd_args[0]).name} {' '.join(cmd_args[1:])}\n"
            f"[Solix Sandbox]: Running with secrets shielded (timeout: {int(settings.EXECUTION_TIMEOUT_SECONDS)}s)\n"
            f"----------------------------------------------------------------------\n"
        )
        stdout_chunks.append(banner)

        env = sanitize_environment()
        max_chars = settings.EXECUTION_MAX_OUTPUT_CHARS

        try:
            proc = await asyncio.create_subprocess_exec(
                cmd_args[0],
                *cmd_args[1:],
                cwd=str(ws_dir),
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            active = ActiveExecution(execution_id, workspace_id, proc, cmd_display)
            self.active_executions[execution_id] = active
            self.workspace_active[workspace_id] = execution_id

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=settings.EXECUTION_TIMEOUT_SECONDS,
                )
                exit_code = proc.returncode or 0
            except asyncio.TimeoutError:
                timed_out = True
                exit_code = -1
                logger.warning(f"[Execution] Process timed out in ws={workspace_id} after {settings.EXECUTION_TIMEOUT_SECONDS}s")
                await self._kill_proc(proc)
                stdout_bytes, stderr_bytes = b"", b""
                stderr_chunks.append(f"\n[Execution Error]: Process timed out after {int(settings.EXECUTION_TIMEOUT_SECONDS)} seconds and was terminated.")

            if stdout_bytes:
                out_str = stdout_bytes.decode("utf-8", errors="replace")
                if len(out_str) > max_chars:
                    out_str = out_str[:max_chars] + f"\n... [Output truncated after {max_chars} characters]"
                stdout_chunks.append(out_str)

            if stderr_bytes:
                err_str = stderr_bytes.decode("utf-8", errors="replace")
                if len(err_str) > max_chars:
                    err_str = err_str[:max_chars] + f"\n... [Stderr truncated after {max_chars} characters]"
                stderr_chunks.append(err_str)

        except FileNotFoundError as e:
            exit_code = 127
            stderr_chunks.append(f"[Execution Error]: Executable not found: {cmd_args[0]} ({e})")
        except Exception as e:
            exit_code = 1
            stderr_chunks.append(f"[Execution Error]: Failed to start process: {str(e)}")
        finally:
            self.active_executions.pop(execution_id, None)
            if self.workspace_active.get(workspace_id) == execution_id:
                self.workspace_active.pop(workspace_id, None)

        duration = round(time.time() - start_time, 3)
        final_stdout = "".join(stdout_chunks)
        final_stderr = "".join(stderr_chunks)

        # Parse problems from runtime error output
        if exit_code != 0:
            parsed = diagnostic_parser.parse(final_stderr + "\n" + final_stdout)
            problems.extend(parsed)

        return {
            "execution_id": execution_id,
            "workspace_id": workspace_id,
            "command": cmd_display,
            "exit_code": exit_code,
            "stdout": final_stdout,
            "stderr": final_stderr,
            "execution_time": duration,
            "timed_out": timed_out,
            "success": (exit_code == 0),
            "problems": [p.model_dump() for p in problems],
        }

    async def _run_tests(
        self,
        workspace_id: str,
        ws_dir: Path,
        execution_id: str,
        custom_cmd: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute project test suite."""
        start_time = time.time()
        proj_lang = language_registry.detect_project_language(ws_dir)

        cmd_args: Optional[List[str]] = None
        if custom_cmd and custom_cmd.strip():
            cmd_args = self.parse_user_command(custom_cmd, ws_dir)
        elif proj_lang:
            if proj_lang.id == "python":
                py_bin = sys.executable
                if (ws_dir / "test_main.py").exists() or any(ws_dir.glob("test_*.py")):
                    cmd_args = [py_bin, "-m", "unittest", "discover", "-s", ".", "-p", "test_*.py"]
                else:
                    return {
                        "execution_id": execution_id,
                        "workspace_id": workspace_id,
                        "command": "python -m unittest",
                        "exit_code": 0,
                        "stdout": "No test runner detected for this project.\nTo add unit tests, create a test file named 'test_main.py' or 'test_*.py'.\n",
                        "stderr": "",
                        "execution_time": 0.0,
                        "timed_out": False,
                        "success": True,
                        "problems": [],
                    }
            elif proj_lang.id in ("javascript", "typescript"):
                if (ws_dir / "package.json").exists():
                    cmd_args = ["npm.cmd" if os.name == "nt" else "npm", "test"]
                elif (ws_dir / "test.js").exists():
                    cmd_args = ["node", "test.js"]
                else:
                    return {
                        "execution_id": execution_id,
                        "workspace_id": workspace_id,
                        "command": "npm test",
                        "exit_code": 0,
                        "stdout": "No test runner detected for this project.\nTo add tests, define a 'test' script in package.json or create 'test.js'.\n",
                        "stderr": "",
                        "execution_time": 0.0,
                        "timed_out": False,
                        "success": True,
                        "problems": [],
                    }
            elif proj_lang.id in ("cpp", "c"):
                test_sources = list(ws_dir.glob("**/test_*.cpp")) or list(ws_dir.glob("**/test_*.c"))
                if test_sources:
                    # Compile and run test binary
                    test_bin = ws_dir / "build" / ("test.exe" if os.name == "nt" else "test")
                    build_res = await compiler_service.build(workspace_id, ws_dir)
                    if not build_res.success:
                        return {
                            "execution_id": execution_id,
                            "workspace_id": workspace_id,
                            "command": "test build",
                            "exit_code": 1,
                            "stdout": build_res.stdout,
                            "stderr": build_res.stderr,
                            "execution_time": build_res.build_time,
                            "timed_out": False,
                            "success": False,
                            "problems": [p.model_dump() for p in build_res.problems],
                        }
                    cmd_args = [str(test_bin)]
                else:
                    return {
                        "execution_id": execution_id,
                        "workspace_id": workspace_id,
                        "command": "test",
                        "exit_code": 0,
                        "stdout": "No test runner detected for this project.\nTo add tests, create a test file such as 'test_main.cpp'.\n",
                        "stderr": "",
                        "execution_time": 0.0,
                        "timed_out": False,
                        "success": True,
                        "problems": [],
                    }

        if not cmd_args:
            return {
                "execution_id": execution_id,
                "workspace_id": workspace_id,
                "command": "test",
                "exit_code": 0,
                "stdout": "No test runner detected for this project.\n",
                "stderr": "",
                "execution_time": 0.0,
                "timed_out": False,
                "success": True,
                "problems": [],
            }

        # Run detected test command
        cmd_display = " ".join(cmd_args)
        logger.info(f"[Test Execution] Running tests in ws={workspace_id}: {cmd_display}")
        env = sanitize_environment()

        try:
            proc = await asyncio.create_subprocess_exec(
                cmd_args[0],
                *cmd_args[1:],
                cwd=str(ws_dir),
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            self.active_executions[execution_id] = ActiveExecution(execution_id, workspace_id, proc, cmd_display)
            self.workspace_active[workspace_id] = execution_id

            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(),
                timeout=settings.EXECUTION_TIMEOUT_SECONDS,
            )
            exit_code = proc.returncode or 0
            stdout_str = stdout_bytes.decode("utf-8", errors="replace")
            stderr_str = stderr_bytes.decode("utf-8", errors="replace")
        except asyncio.TimeoutError:
            exit_code = -1
            stdout_str = ""
            stderr_str = f"Tests timed out after {int(settings.EXECUTION_TIMEOUT_SECONDS)} seconds."
        finally:
            self.active_executions.pop(execution_id, None)
            if self.workspace_active.get(workspace_id) == execution_id:
                self.workspace_active.pop(workspace_id, None)

        duration = round(time.time() - start_time, 3)
        problems = diagnostic_parser.parse(stderr_str + "\n" + stdout_str) if exit_code != 0 else []

        return {
            "execution_id": execution_id,
            "workspace_id": workspace_id,
            "command": cmd_display,
            "exit_code": exit_code,
            "stdout": stdout_str,
            "stderr": stderr_str,
            "execution_time": duration,
            "timed_out": (exit_code == -1),
            "success": (exit_code == 0),
            "problems": [p.model_dump() for p in problems],
        }

    async def _kill_proc(self, proc: asyncio.subprocess.Process):
        """Cleanly kill a process and its child tree on Windows or Unix."""
        try:
            if os.name == "nt":
                # Windows taskkill /F /T kills child processes without leaving orphans
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    capture_output=True,
                    timeout=3,
                )
            else:
                proc.kill()
            await proc.wait()
        except Exception as e:
            logger.debug(f"Failed to kill proc {proc.pid}: {e}")

    async def stop(self, workspace_id: Optional[str] = None, execution_id: Optional[str] = None) -> bool:
        """Stop an active execution by workspace_id or execution_id."""
        target_exec: Optional[ActiveExecution] = None

        if execution_id and execution_id in self.active_executions:
            target_exec = self.active_executions.pop(execution_id)
            if target_exec.workspace_id in self.workspace_active:
                self.workspace_active.pop(target_exec.workspace_id, None)
        elif workspace_id and workspace_id in self.workspace_active:
            eid = self.workspace_active.pop(workspace_id)
            target_exec = self.active_executions.pop(eid, None)

        if target_exec and target_exec.proc and target_exec.proc.returncode is None:
            logger.info(f"[Execution] Stopping execution {target_exec.execution_id} (PID {target_exec.proc.pid})")
            await self._kill_proc(target_exec.proc)
            return True

        return False


execution_service = ExecutionManager()
