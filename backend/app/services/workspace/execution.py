from abc import ABC, abstractmethod
import asyncio
import logging
import os
from pathlib import Path
import sys
import time
from typing import Any, Dict, List, Optional
from app.core.config import settings
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

    # Allow harmless base system paths and locale variables
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
        # Filter out anything with sensitive keywords
        if any(bad in k_lower for bad in BLOCKED_ENV_KEYS):
            continue

        if key in allowed_exact_keys:
            safe_env[key] = val
        elif key == "PATH":
            # Keep standard Python/Node system PATH
            safe_env["PATH"] = val

    # Force unbuffered I/O so stdout streams immediately
    safe_env["PYTHONUNBUFFERED"] = "1"
    safe_env["PYTHONIOENCODING"] = "utf-8"
    safe_env["NODE_ENV"] = "development"
    return safe_env


class BaseExecutionService(ABC):
    """Abstract base class for code execution runners."""

    @abstractmethod
    async def run(
        self,
        workspace_id: str,
        command: Optional[str] = None,
        is_test: bool = False,
    ) -> Dict[str, Any]:
        """Execute project code or tests in the workspace."""
        pass

    @abstractmethod
    async def stop(self, workspace_id: str) -> bool:
        """Stop any active process running for the workspace."""
        pass


class SafeProcessRunner(BaseExecutionService):
    """Secure, local-sandbox execution runner with environment scrubbing, timeouts, and process tracking."""

    def __init__(self):
        self.active_processes: Dict[str, asyncio.subprocess.Process] = {}

    def detect_command(self, workspace_dir: Path, is_test: bool = False) -> List[str]:
        """Detect the appropriate execution command based on files present in the workspace."""
        # Check Python
        if (workspace_dir / "main.py").exists() or any(workspace_dir.glob("*.py")):
            python_bin = sys.executable  # Use current Python virtualenv
            if is_test:
                if (workspace_dir / "test_main.py").exists() or any(workspace_dir.glob("test_*.py")):
                    return [python_bin, "-m", "unittest", "discover", "-s", ".", "-p", "test_*.py"]
                return [python_bin, "-m", "unittest"]
            if (workspace_dir / "main.py").exists():
                return [python_bin, "main.py"]
            # Fallback to first .py found
            first_py = next(workspace_dir.glob("*.py"))
            return [python_bin, first_py.name]

        # Check Node.js / JavaScript
        if (workspace_dir / "package.json").exists():
            if is_test:
                return ["npm", "test"]
            return ["node", "index.js" if (workspace_dir / "index.js").exists() else "main.js"]

        if (workspace_dir / "index.js").exists():
            return ["node", "index.js"]

        # Check Rust
        if (workspace_dir / "Cargo.toml").exists():
            return ["cargo", "test"] if is_test else ["cargo", "run"]

        # Check Go
        if (workspace_dir / "go.mod").exists() or (workspace_dir / "main.go").exists():
            return ["go", "test", "./..."] if is_test else ["go", "run", "."]

        raise ValueError("Could not auto-detect a runnable entry point (e.g. main.py, index.js, Cargo.toml). Please provide an explicit command.")

    def parse_command(self, raw_cmd: str, workspace_dir: Path) -> List[str]:
        """Parse and sanitize a user-supplied command into arguments."""
        cmd_lower = raw_cmd.lower().strip()
        for blocked in BLOCKED_COMMAND_KEYWORDS:
            if blocked in cmd_lower:
                raise ValueError(f"Command contains forbidden operation: '{blocked}'.")

        # Split safely
        import shlex
        parts = shlex.split(raw_cmd, posix=(os.name != "nt"))
        if not parts:
            raise ValueError("Command cannot be empty.")

        first = parts[0].lower()
        # Map generic 'python' or 'python3' to the active secure environment executable
        if first in ("python", "python3", "python.exe"):
            parts[0] = sys.executable

        return parts

    async def run(
        self,
        workspace_id: str,
        command: Optional[str] = None,
        is_test: bool = False,
    ) -> Dict[str, Any]:
        """Execute code in a shielded, jailed environment."""
        ws_dir = workspace_storage.resolve_safe_path(workspace_id, ".")
        if not ws_dir.exists():
            raise FileNotFoundError(f"Workspace '{workspace_id}' not found.")

        # Stop any existing process for this workspace
        await self.stop(workspace_id)

        # Resolve command args
        if command and command.strip():
            cmd_args = self.parse_command(command, ws_dir)
        else:
            cmd_args = self.detect_command(ws_dir, is_test=is_test)

        cmd_display = " ".join(cmd_args)
        logger.info(f"[Execution] Running in ws={workspace_id}: {cmd_display}")

        # Sanitize environment (stripping all secrets)
        env = sanitize_environment()

        start_time = time.time()
        stdout_chunks: List[str] = []
        stderr_chunks: List[str] = []
        timed_out = False
        exit_code = 0
        max_chars = settings.EXECUTION_MAX_OUTPUT_CHARS

        banner = (
            f"$ {Path(cmd_args[0]).name} {' '.join(cmd_args[1:])}\n"
            f"[Solix Sandbox]: Execution started in workspace (timeout: {int(settings.EXECUTION_TIMEOUT_SECONDS)}s, secrets shielded)\n"
            f"----------------------------------------------------------------------\n"
        )
        stdout_chunks.append(banner)

        try:
            # Launch direct subprocess without shell=True to avoid injection
            proc = await asyncio.create_subprocess_exec(
                cmd_args[0],
                *cmd_args[1:],
                cwd=str(ws_dir),
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            self.active_processes[workspace_id] = proc

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
                try:
                    proc.kill()
                    stdout_bytes, stderr_bytes = await proc.communicate()
                except Exception:
                    stdout_bytes, stderr_bytes = b"", b""
                stderr_chunks.append(f"\n[Execution Error]: Process timed out after {settings.EXECUTION_TIMEOUT_SECONDS} seconds and was terminated.")

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
            self.active_processes.pop(workspace_id, None)

        duration = round(time.time() - start_time, 3)
        final_stdout = "".join(stdout_chunks)
        final_stderr = "".join(stderr_chunks)

        return {
            "workspace_id": workspace_id,
            "command": cmd_display,
            "exit_code": exit_code,
            "stdout": final_stdout,
            "stderr": final_stderr,
            "execution_time": duration,
            "timed_out": timed_out,
            "success": (exit_code == 0),
        }

    async def stop(self, workspace_id: str) -> bool:
        """Terminate any currently running process in the workspace."""
        proc = self.active_processes.pop(workspace_id, None)
        if proc and proc.returncode is None:
            try:
                proc.kill()
                await proc.wait()
                logger.info(f"[Execution] Stopped process for workspace {workspace_id}")
                return True
            except Exception as e:
                logger.warning(f"[Execution] Failed to kill process for workspace {workspace_id}: {e}")
        return False


execution_service = SafeProcessRunner()

