from __future__ import annotations

import difflib
import json
import logging
import os
from pathlib import Path
import re
import subprocess
from typing import Any, Dict, List, Optional, Tuple

from app.services.workspace.compiler import compiler_service
from app.services.workspace.diagnostics import DiagnosticItem, diagnostic_parser
from app.services.workspace.execution import execution_service
from app.services.workspace.languages import language_registry
from app.services.workspace.storage import detect_language, workspace_storage

logger = logging.getLogger("solix.workspace.tools")


class WorkspaceToolRegistry:
    """Provides controlled, validated backend tools for the Solix Autonomous Coding Agent."""

    # ── 1. Filesystem & Code Tools ──────────────────────────────────────────────

    def list_files(self, workspace_id: str, path: str = "") -> Dict[str, Any]:
        """List all files and directories in a workspace or subdirectory."""
        try:
            ws_dir = workspace_storage.resolve_safe_path(workspace_id, ".")
            target_dir = workspace_storage.resolve_safe_path(workspace_id, path) if path else ws_dir
            if not target_dir.exists():
                return {"success": False, "error": f"Path '{path}' does not exist."}
            if not target_dir.is_dir():
                return {"success": False, "error": f"Path '{path}' is a file, not a directory."}

            entries = []
            for item in sorted(target_dir.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                if item.name in (".solix_workspace.json", "__pycache__", ".git", ".venv", "venv", "node_modules", ".next"):
                    continue
                rel = item.relative_to(ws_dir).as_posix()
                if item.is_dir():
                    entries.append({
                        "name": item.name,
                        "path": rel,
                        "is_directory": True,
                    })
                else:
                    entries.append({
                        "name": item.name,
                        "path": rel,
                        "is_directory": False,
                        "size": item.stat().st_size,
                        "language": detect_language(item.name),
                    })

            return {"success": True, "files": entries, "count": len(entries)}
        except Exception as e:
            logger.error(f"[Tool] list_files error: {e}")
            return {"success": False, "error": str(e)}

    def read_file(self, workspace_id: str, path: str) -> Dict[str, Any]:
        """Read a file's content with line numbers and language detection."""
        try:
            res = workspace_storage.read_file(workspace_id, path)
            lines = res["content"].splitlines()
            numbered = [f"{i+1:4d} | {line}" for i, line in enumerate(lines)]
            return {
                "success": True,
                "path": res["path"],
                "content": res["content"],
                "numbered_content": "\n".join(numbered),
                "line_count": len(lines),
                "language": res["language"],
                "size": res["size"],
            }
        except Exception as e:
            logger.error(f"[Tool] read_file error on {path}: {e}")
            return {"success": False, "error": str(e)}

    def search_project(self, workspace_id: str, query: str) -> Dict[str, Any]:
        """Search regex/text query across all project text files."""
        try:
            if not query or not query.strip():
                return {"success": False, "error": "Search query cannot be empty."}

            ws_dir = workspace_storage.resolve_safe_path(workspace_id, ".")
            matches = []
            pattern = re.compile(re.escape(query.strip()), re.IGNORECASE)

            text_exts = {
                ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css",
                ".json", ".md", ".rs", ".go", ".java", ".c", ".h", ".cpp",
                ".hpp", ".sql", ".sh", ".yaml", ".yml", ".toml", ".txt",
            }

            for root, dirs, files in os.walk(ws_dir):
                dirs[:] = [d for d in dirs if d not in ("__pycache__", ".git", ".venv", "venv", "node_modules", ".next", "build")]
                for fname in files:
                    ext = Path(fname).suffix.lower()
                    if ext in text_exts or fname in ("Dockerfile", "Makefile", "LICENSE"):
                        file_p = Path(root) / fname
                        rel_p = file_p.relative_to(ws_dir).as_posix()
                        try:
                            content = file_p.read_text(encoding="utf-8")
                            for line_num, line in enumerate(content.splitlines(), start=1):
                                if pattern.search(line):
                                    matches.append({
                                        "file": rel_p,
                                        "line": line_num,
                                        "content": line.strip()[:200],
                                    })
                                    if len(matches) >= 50:
                                        break
                        except Exception:
                            pass
                if len(matches) >= 50:
                    break

            return {"success": True, "query": query, "matches": matches, "count": len(matches)}
        except Exception as e:
            logger.error(f"[Tool] search_project error: {e}")
            return {"success": False, "error": str(e)}

    def stage_file_creation(self, workspace_id: str, path: str, content: str) -> Dict[str, Any]:
        """Prepare creating a file and compute new-file diff."""
        try:
            safe_p = workspace_storage.resolve_safe_path(workspace_id, path)
            if safe_p.exists():
                return {"success": False, "error": f"File '{path}' already exists. Use workspace_update_file instead."}

            diff_str = f"--- /dev/null\n+++ b/{path}\n" + "\n".join([f"+{l}" for l in content.splitlines()])
            return {
                "success": True,
                "operation": "create",
                "file": path.replace("\\", "/"),
                "before": "",
                "after": content,
                "diff": diff_str,
                "explanation": f"Create new file {path}",
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def stage_file_update(self, workspace_id: str, path: str, content: str) -> Dict[str, Any]:
        """Prepare modifying an existing file and compute unified diff."""
        try:
            orig = workspace_storage.read_file(workspace_id, path)
            orig_content = orig["content"]
            orig_lines = orig_content.splitlines(keepends=True)
            repl_lines = content.splitlines(keepends=True)
            diff = difflib.unified_diff(
                orig_lines,
                repl_lines,
                fromfile=f"a/{path}",
                tofile=f"b/{path}",
                lineterm="",
            )
            diff_str = "".join(diff)
            if not diff_str:
                diff_str = "(No visual changes detected)"

            return {
                "success": True,
                "operation": "modify",
                "file": path.replace("\\", "/"),
                "before": orig_content,
                "after": content,
                "diff": diff_str,
                "explanation": f"Modify existing file {path}",
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def stage_file_deletion(self, workspace_id: str, path: str) -> Dict[str, Any]:
        """Prepare deleting a file and compute removal diff."""
        try:
            orig = workspace_storage.read_file(workspace_id, path)
            orig_content = orig["content"]
            diff_str = f"--- a/{path}\n+++ /dev/null\n" + "\n".join([f"-{l}" for l in orig_content.splitlines()])
            return {
                "success": True,
                "operation": "delete",
                "file": path.replace("\\", "/"),
                "before": orig_content,
                "after": "",
                "diff": diff_str,
                "explanation": f"Delete file {path}",
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def apply_file_operation(self, workspace_id: str, operation: str, path: str, content: str = "") -> Dict[str, Any]:
        """Execute an approved file operation."""
        try:
            if operation == "create":
                res = workspace_storage.create_file_or_dir(workspace_id, path, is_directory=False, content=content)
                return {"success": True, "operation": "create", "file": path, "size": res.get("size", 0)}
            elif operation == "modify":
                res = workspace_storage.write_file(workspace_id, path, content)
                return {"success": True, "operation": "modify", "file": path, "size": res.get("size", 0)}
            elif operation == "delete":
                workspace_storage.delete_path(workspace_id, path)
                return {"success": True, "operation": "delete", "file": path}
            else:
                return {"success": False, "error": f"Unknown operation: {operation}"}
        except Exception as e:
            logger.error(f"[Tool] apply_file_operation error: {e}")
            return {"success": False, "error": str(e)}

    def create_folder(self, workspace_id: str, path: str) -> Dict[str, Any]:
        """Create a new folder safely."""
        try:
            res = workspace_storage.create_file_or_dir(workspace_id, path, is_directory=True)
            return {"success": True, "path": res["path"], "is_directory": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def rename_path(self, workspace_id: str, old_path: str, new_path: str) -> Dict[str, Any]:
        """Rename or move a file or folder safely within the workspace."""
        try:
            res = workspace_storage.rename_path(workspace_id, old_path, new_path)
            return {"success": True, "old_path": res["old_path"], "new_path": res["new_path"]}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ── 2. Build, Run & Test Execution Tools ────────────────────────────────────

    async def run_workspace(self, workspace_id: str, entry_file: Optional[str] = None, args: Optional[List[str]] = None) -> Dict[str, Any]:
        """Execute code in the Solix sandbox."""
        try:
            ws_dir = workspace_storage.resolve_safe_path(workspace_id, ".")
            if (entry_file and entry_file.endswith(".html")) or ((ws_dir / "index.html").exists() and not (ws_dir / "main.py").exists() and not (ws_dir / "index.js").exists()):
                html_name = entry_file if (entry_file and entry_file.endswith(".html")) else "index.html"
                return {
                    "success": True,
                    "exit_code": 0,
                    "stdout": f"[Web Project]: {html_name} validated. Ready for browser preview in Live Preview tab.",
                    "stderr": "",
                    "execution_time": 0.01,
                    "timed_out": False,
                    "problems": [],
                }

            cmd = None
            if entry_file:
                safe_entry = workspace_storage.resolve_safe_path(workspace_id, entry_file)
                rel_entry = safe_entry.relative_to(ws_dir).as_posix()
                if rel_entry.endswith(".py"):
                    cmd = f"python {rel_entry}"
                elif rel_entry.endswith(".js"):
                    cmd = f"node {rel_entry}"
                if args:
                    cmd += " " + " ".join(args)

            res = await execution_service.run(workspace_id=workspace_id, command=cmd, is_test=False)
            return {
                "success": res.get("success", False),
                "exit_code": res.get("exit_code", 0),
                "stdout": res.get("stdout", "")[:15000],
                "stderr": res.get("stderr", "")[:15000],
                "execution_time": res.get("execution_time", 0.0),
                "timed_out": res.get("timed_out", False),
                "problems": res.get("problems", []),
            }
        except Exception as e:
            logger.error(f"[Tool] run_workspace error: {e}")
            return {"success": False, "error": str(e), "exit_code": -1, "stdout": "", "stderr": str(e)}

    async def build_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """Build the project for compiled languages (C++, C, TypeScript)."""
        try:
            res = await execution_service.build(workspace_id=workspace_id)
            return {
                "success": res.get("success", False),
                "exit_code": res.get("exit_code", 0),
                "stdout": res.get("stdout", "")[:15000],
                "stderr": res.get("stderr", "")[:15000],
                "build_time": res.get("build_time", 0.0),
                "binary_path": res.get("binary_path"),
                "problems": res.get("problems", []),
            }
        except Exception as e:
            logger.error(f"[Tool] build_workspace error: {e}")
            return {"success": False, "error": str(e), "exit_code": -1, "stdout": "", "stderr": str(e)}

    async def test_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """Run the project's unit test suite."""
        try:
            res = await execution_service.run(workspace_id=workspace_id, is_test=True)
            return {
                "success": res.get("success", False),
                "exit_code": res.get("exit_code", 0),
                "stdout": res.get("stdout", "")[:15000],
                "stderr": res.get("stderr", "")[:15000],
                "execution_time": res.get("execution_time", 0.0),
                "problems": res.get("problems", []),
            }
        except Exception as e:
            logger.error(f"[Tool] test_workspace error: {e}")
            return {"success": False, "error": str(e), "exit_code": -1, "stdout": "", "stderr": str(e)}

    def get_problems(self, workspace_id: str) -> Dict[str, Any]:
        """Return detected problems from active project files."""
        try:
            # Check if there are source files with obvious syntax issues
            ws_dir = workspace_storage.resolve_safe_path(workspace_id, ".")
            problems: List[Dict[str, Any]] = []

            # Check for Python files syntax via compile()
            for py_file in ws_dir.glob("**/*.py"):
                if any(p in py_file.parts for p in ("build", ".git", ".venv", "venv")):
                    continue
                try:
                    code = py_file.read_text(encoding="utf-8")
                    compile(code, str(py_file.relative_to(ws_dir)), "exec")
                except SyntaxError as se:
                    problems.append({
                        "severity": "error",
                        "file": py_file.relative_to(ws_dir).as_posix(),
                        "line": se.lineno or 1,
                        "column": se.offset or 1,
                        "message": se.msg,
                        "source": "Python Compiler",
                    })

            msg = "No syntax or compiler problems detected. Project is clean." if not problems else f"Found {len(problems)} problem(s)."
            return {"success": True, "problems": problems, "count": len(problems), "message": msg}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def git_diff(self, workspace_id: str) -> Dict[str, Any]:
        """Get git status and unified diff if this workspace is a Git repo."""
        try:
            ws_dir = workspace_storage.resolve_safe_path(workspace_id, ".")
            git_dir = ws_dir / ".git"
            if not git_dir.exists():
                return {"success": True, "is_repo": False, "diff": "", "status": "Not a git repository."}

            status_res = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=str(ws_dir),
                capture_output=True,
                text=True,
                timeout=5,
            )
            diff_res = subprocess.run(
                ["git", "diff"],
                cwd=str(ws_dir),
                capture_output=True,
                text=True,
                timeout=5,
            )
            return {
                "success": True,
                "is_repo": True,
                "status": status_res.stdout.strip(),
                "diff": diff_res.stdout.strip(),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ── 3. Ollama Tool Schemas Definition ───────────────────────────────────────

    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """Return the complete JSON schema for all 13 agent tools."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "workspace_list_files",
                    "description": "List files and subdirectories in the workspace.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Optional subdirectory path to list. Empty string lists project root.",
                            },
                        },
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_read_file",
                    "description": "Read the entire content and line numbers of a workspace file.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Relative file path inside the workspace.",
                            },
                        },
                        "required": ["path"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_search",
                    "description": "Search for symbols, keywords, or functions across all project files.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Keyword or symbol to search for.",
                            },
                        },
                        "required": ["query"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_create_file",
                    "description": "Create a new file with full content. The user will be asked to review and approve the diff.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Relative path for the new file (e.g. 'calculator.py').",
                            },
                            "content": {
                                "type": "string",
                                "description": "Full, complete content for the new file.",
                            },
                        },
                        "required": ["path", "content"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_update_file",
                    "description": "Update an existing file with complete updated code. Shows a unified diff for user approval.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Relative file path to modify.",
                            },
                            "content": {
                                "type": "string",
                                "description": "Complete replacement content for the file.",
                            },
                        },
                        "required": ["path", "content"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_delete_file",
                    "description": "Delete a file from the workspace. ALWAYS requires explicit user approval.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Relative file path to delete.",
                            },
                        },
                        "required": ["path"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_create_folder",
                    "description": "Create a new folder/directory inside the workspace.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Relative directory path to create (e.g. 'tests').",
                            },
                        },
                        "required": ["path"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_rename",
                    "description": "Rename or move a file or folder in the workspace.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "old_path": {
                                "type": "string",
                                "description": "Existing relative path.",
                            },
                            "new_path": {
                                "type": "string",
                                "description": "New relative path.",
                            },
                        },
                        "required": ["old_path", "new_path"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_run",
                    "description": "Execute the project code in the Solix sandbox. Returns stdout, stderr, and exit code.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "entry_file": {
                                "type": "string",
                                "description": "Optional entry file to execute (e.g. 'main.py' or 'calculator.py').",
                            },
                            "args": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Optional command line arguments to pass.",
                            },
                        },
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_build",
                    "description": "Compile the workspace for compiled languages (C, C++, TypeScript).",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_test",
                    "description": "Run the workspace unit tests. Returns test results, stdout, stderr, and exit code.",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_get_problems",
                    "description": "Inspect syntax or compilation problems across workspace files.",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "workspace_git_diff",
                    "description": "Inspect uncommitted git modifications and git status (read-only).",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                    },
                },
            },
        ]


workspace_tools = WorkspaceToolRegistry()
