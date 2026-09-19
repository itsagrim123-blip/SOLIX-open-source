import json
import logging
import os
from pathlib import Path
import shutil
import time
from typing import Any, Dict, List, Optional
import uuid
from app.core.config import settings

logger = logging.getLogger("solix.workspace.storage")

LANGUAGE_EXT_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".json": "json",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".md": "markdown",
    ".markdown": "markdown",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".php": "php",
    ".sql": "sql",
    ".sh": "shell",
    ".bash": "shell",
    ".zsh": "shell",
    ".bat": "bat",
    ".cmd": "bat",
    ".ps1": "powershell",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".ini": "ini",
    ".txt": "plaintext",
}

IGNORED_TREE_NAMES = {
    ".solix_workspace.json",
    "__pycache__",
    ".git",
    ".venv",
    "venv",
    "node_modules",
    ".next",
    ".pytest_cache",
    ".DS_Store",
    "Thumbs.db",
}


def detect_language(path: str) -> str:
    """Infer Monaco language ID from file extension."""
    ext = Path(path).suffix.lower()
    return LANGUAGE_EXT_MAP.get(ext, "plaintext")


class WorkspaceStorage:
    """Manages file storage, directory trees, and strict path security for workspaces."""

    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path or settings.WORKSPACE_STORAGE_PATH).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_workspace_dir(self, workspace_id: str) -> Path:
        """Return and validate the root directory for a workspace."""
        # Sanitize workspace_id to prevent directory traversal
        clean_id = Path(workspace_id).name
        if not clean_id or clean_id != workspace_id or ".." in clean_id:
            raise ValueError(f"Invalid workspace ID: {workspace_id}")
        ws_dir = (self.base_path / clean_id).resolve()
        if not str(ws_dir).startswith(str(self.base_path)):
            raise ValueError(f"Workspace path traversal attempt detected: {workspace_id}")
        return ws_dir

    def create_ephemeral_workspace(self, workspace_id: str, files: List[Dict[str, str]]) -> Path:
        """Create a temporary sandbox directory for ephemeral agent execution."""
        clean_id = Path(workspace_id).name
        ws_dir = (self.base_path / clean_id).resolve()
        if ws_dir.exists():
            shutil.rmtree(ws_dir, ignore_errors=True)
        ws_dir.mkdir(parents=True, exist_ok=True)
        meta = {
            "id": workspace_id,
            "name": "Ephemeral Workspace",
            "template": "ephemeral",
            "created_at": time.time(),
            "updated_at": time.time(),
            "ephemeral": True,
        }
        (ws_dir / ".solix_workspace.json").write_text(json.dumps(meta), encoding="utf-8")
        for f in files:
            p_rel = f.get("path", "").replace("\\", "/").lstrip("/")
            if p_rel:
                try:
                    p = self.resolve_safe_path(workspace_id, p_rel)
                    p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_text(f.get("content", ""), encoding="utf-8")
                except Exception as e:
                    logger.warning(f"Could not stage ephemeral file {p_rel}: {e}")
        return ws_dir

    def cleanup_ephemeral_workspace(self, workspace_id: str) -> None:
        """Purge temporary sandbox directory after execution completes."""
        try:
            clean_id = Path(workspace_id).name
            ws_dir = (self.base_path / clean_id).resolve()
            if ws_dir.exists():
                shutil.rmtree(ws_dir, ignore_errors=True)
                logger.info(f"[WorkspaceStorage] Purged ephemeral workspace {workspace_id}")
        except Exception as e:
            logger.warning(f"Failed to cleanup ephemeral workspace {workspace_id}: {e}")

    def resolve_safe_path(self, workspace_id: str, relative_path: str) -> Path:
        """Resolve a relative file path inside a workspace with strict jail validation.

        Disallows:
          - Parent traversal (..)
          - Absolute paths (/etc/passwd, C:\\Windows)
          - Null bytes
          - Escaping the workspace root directory
        """
        if not relative_path or not relative_path.strip():
            raise ValueError("File path cannot be empty.")

        if "\x00" in relative_path:
            raise ValueError("Null bytes in path are disallowed.")

        ws_dir = self._get_workspace_dir(workspace_id)
        if not ws_dir.exists():
            raise FileNotFoundError(f"Workspace '{workspace_id}' not found.")

        raw = relative_path.strip()
        if raw.startswith("/") or raw.startswith("\\") or (len(raw) > 1 and raw[1] == ":"):
            raise ValueError(f"Absolute paths or drive specifications are disallowed: {relative_path}")

        # Normalize separators
        clean_rel = raw.replace("\\", "/")
        parts = clean_rel.split("/")
        for part in parts:
            if part in ("..", ""):
                raise ValueError(f"Directory traversal component '{part}' is disallowed.")

        resolved = (ws_dir / clean_rel).resolve()
        if not str(resolved).startswith(str(ws_dir)):
            raise ValueError(f"Path traversal outside workspace root is disallowed: {relative_path}")

        return resolved

    def create_workspace(self, name: Optional[str] = None, template: str = "starter-python") -> Dict[str, Any]:
        """Create a new workspace directory with starter code."""
        ws_id = str(uuid.uuid4())
        ws_dir = self._get_workspace_dir(ws_id)
        ws_dir.mkdir(parents=True, exist_ok=True)

        ws_name = name.strip() if name and name.strip() else f"Project-{ws_id[:6]}"
        now = time.time()
        meta = {
            "id": ws_id,
            "name": ws_name,
            "template": template,
            "created_at": now,
            "updated_at": now,
        }

        # Seed starter files based on template
        if template == "starter-python":
            (ws_dir / "main.py").write_text(
                '"""Solix Starter Project - Main Entrypoint."""\n\n'
                'from utils import fibonacci, format_output\n\n\n'
                'def main():\n'
                '    print("=" * 45)\n'
                '    print(" Welcome to Solix Coding Workspace! ")\n'
                '    print("=" * 45)\n\n'
                '    n = 10\n'
                '    series = [fibonacci(i) for i in range(n)]\n'
                '    print(format_output("Fibonacci Series (First 10)", series))\n'
                '    print(f"Sum of series: {sum(series)}")\n'
                '    print("Ready for your code! Ask Solix to edit, test, or debug.")\n\n\n'
                'if __name__ == "__main__":\n'
                '    main()\n',
                encoding="utf-8",
            )
            (ws_dir / "utils.py").write_text(
                '"""Utility functions for Solix sample project."""\n\n\n'
                'def fibonacci(n: int) -> int:\n'
                '    """Calculate the n-th Fibonacci number efficiently."""\n'
                '    if n <= 0:\n'
                '        return 0\n'
                '    if n == 1:\n'
                '        return 1\n'
                '    a, b = 0, 1\n'
                '    for _ in range(2, n + 1):\n'
                '        a, b = b, a + b\n'
                '    return b\n\n\n'
                'def format_output(title: str, data: list) -> str:\n'
                '    """Format list data nicely for terminal presentation."""\n'
                '    items_str = ", ".join(str(x) for x in data)\n'
                '    return f"[{title}]: [ {items_str} ]"\n',
                encoding="utf-8",
            )
            (ws_dir / "test_main.py").write_text(
                '"""Unit tests for Solix sample project."""\n\n'
                'import unittest\n'
                'from utils import fibonacci\n\n\n'
                'class TestMathUtils(unittest.TestCase):\n'
                '    def test_fibonacci_base_cases(self):\n'
                '        self.assertEqual(fibonacci(0), 0)\n'
                '        self.assertEqual(fibonacci(1), 1)\n\n'
                '    def test_fibonacci_sequence(self):\n'
                '        self.assertEqual(fibonacci(5), 5)\n'
                '        self.assertEqual(fibonacci(7), 13)\n'
                '        self.assertEqual(fibonacci(10), 55)\n\n\n'
                'if __name__ == "__main__":\n'
                '    unittest.main()\n',
                encoding="utf-8",
            )
            (ws_dir / "README.md").write_text(
                '# Solix Sample Project (Python)\n\n'
                'This is a sample project running inside the **Solix Coding Workspace**.\n\n'
                '### Features\n'
                '- **Run code**: Click `Run` or press `Ctrl+Enter`.\n'
                '- **Test code**: Click `Test` to execute unit tests.\n'
                '- **Solix AI**: Ask Solix to edit, test, or debug code.\n',
                encoding="utf-8",
            )
        elif template == "starter-cpp":
            (ws_dir / "include").mkdir(parents=True, exist_ok=True)
            (ws_dir / "src").mkdir(parents=True, exist_ok=True)

            (ws_dir / "include" / "utils.h").write_text(
                '#pragma once\n'
                '#include <string>\n\n'
                'std::string get_greeting(const std::string& name);\n'
                'long long compute_fibonacci(int n);\n',
                encoding="utf-8",
            )
            (ws_dir / "src" / "utils.cpp").write_text(
                '#include "../include/utils.h"\n\n'
                'std::string get_greeting(const std::string& name) {\n'
                '    return "Hello " + name + " from Solix C++ Compiler!";\n'
                '}\n\n'
                'long long compute_fibonacci(int n) {\n'
                '    if (n <= 0) return 0;\n'
                '    if (n == 1) return 1;\n'
                '    long long a = 0, b = 1;\n'
                '    for (int i = 2; i <= n; ++i) {\n'
                '        long long next = a + b;\n'
                '        a = b;\n'
                '        b = next;\n'
                '    }\n'
                '    return b;\n'
                '}\n',
                encoding="utf-8",
            )
            (ws_dir / "src" / "main.cpp").write_text(
                '#include <iostream>\n'
                '#include "../include/utils.h"\n\n'
                'int main() {\n'
                '    std::cout << "========================================" << std::endl;\n'
                '    std::cout << "  Welcome to Solix C++ Workspace!       " << std::endl;\n'
                '    std::cout << "========================================" << std::endl;\n'
                '    std::cout << get_greeting("Developer") << std::endl;\n'
                '    std::cout << "Fibonacci(10) = " << compute_fibonacci(10) << std::endl;\n'
                '    std::cout << "Build & Run with genuine GCC/G++." << std::endl;\n'
                '    return 0;\n'
                '}\n',
                encoding="utf-8",
            )
            (ws_dir / "README.md").write_text(
                '# Solix C++ Project\n\n'
                'This C++ project compiles and runs using the native **GCC/G++ 16.2** toolchain.\n\n'
                '### Features\n'
                '- **Build**: Click `Build` to invoke `g++` and check for compiler diagnostics.\n'
                '- **Run**: Click `Run` or press `Ctrl+Enter` to compile and execute `./build/main.exe`.\n'
                '- **Problems Panel**: View line-by-line compiler errors and jump directly to code.\n',
                encoding="utf-8",
            )
        elif template == "starter-node":
            (ws_dir / "package.json").write_text(
                '{\n'
                '  "name": "solix-node-project",\n'
                '  "version": "1.0.0",\n'
                '  "main": "index.js",\n'
                '  "scripts": {\n'
                '    "start": "node index.js",\n'
                '    "test": "node test.js"\n'
                '  }\n'
                '}\n',
                encoding="utf-8",
            )
            (ws_dir / "index.js").write_text(
                '// Solix Node.js Project\n'
                'function greet(name) {\n'
                '  return `Hello ${name} from Node.js in Solix!`;\n'
                '}\n\n'
                'console.log("=".repeat(40));\n'
                'console.log(" Welcome to Solix Node.js Workspace! ");\n'
                'console.log("=".repeat(40));\n'
                'console.log(greet("Developer"));\n'
                'console.log("Node version:", process.version);\n',
                encoding="utf-8",
            )
            (ws_dir / "test.js").write_text(
                '// Simple test runner for Node.js\n'
                'const assert = require("assert");\n'
                'function add(a, b) { return a + b; }\n\n'
                'console.log("Running unit tests...");\n'
                'assert.strictEqual(add(2, 3), 5, "2 + 3 should be 5");\n'
                'assert.strictEqual(add(-1, 1), 0, "-1 + 1 should be 0");\n'
                'console.log("All 2 tests passed successfully!");\n',
                encoding="utf-8",
            )
            (ws_dir / "README.md").write_text(
                '# Solix Node.js Project\n\n'
                'Node.js project executed with native V8 runtime.\n',
                encoding="utf-8",
            )
        elif template == "empty":
            (ws_dir / "README.md").write_text(
                '# Empty Project\n\n'
                'Create a file (e.g. `main.py`, `main.cpp`, `index.js`) to get started!\n',
                encoding="utf-8",
            )

        # Write metadata
        (ws_dir / ".solix_workspace.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        logger.info(f"Created workspace {ws_id} ({ws_name})")
        return meta

    def list_workspaces(self) -> List[Dict[str, Any]]:
        """List all active workspaces."""
        results = []
        if not self.base_path.exists():
            return results

        for child in self.base_path.iterdir():
            if child.is_dir():
                meta_file = child / ".solix_workspace.json"
                if meta_file.exists():
                    try:
                        meta = json.loads(meta_file.read_text(encoding="utf-8"))
                        results.append(meta)
                    except Exception as e:
                        logger.warning(f"Failed to read metadata for {child.name}: {e}")
                else:
                    results.append({
                        "id": child.name,
                        "name": child.name,
                        "created_at": child.stat().st_ctime,
                        "updated_at": child.stat().st_mtime,
                    })

        results.sort(key=lambda x: x.get("updated_at", 0), reverse=True)
        return results

    def get_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """Fetch workspace metadata."""
        ws_dir = self._get_workspace_dir(workspace_id)
        if not ws_dir.exists():
            raise FileNotFoundError(f"Workspace '{workspace_id}' not found.")

        meta_file = ws_dir / ".solix_workspace.json"
        if meta_file.exists():
            try:
                return json.loads(meta_file.read_text(encoding="utf-8"))
            except Exception:
                pass

        return {
            "id": workspace_id,
            "name": workspace_id,
            "created_at": ws_dir.stat().st_ctime,
            "updated_at": ws_dir.stat().st_mtime,
        }

    def delete_workspace(self, workspace_id: str) -> bool:
        """Delete an entire workspace directory."""
        ws_dir = self._get_workspace_dir(workspace_id)
        if ws_dir.exists():
            shutil.rmtree(ws_dir, ignore_errors=True)
            logger.info(f"Deleted workspace {workspace_id}")
            return True
        return False

    def get_workspace_tree(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Return the hierarchical file tree of a workspace."""
        ws_dir = self._get_workspace_dir(workspace_id)
        if not ws_dir.exists():
            raise FileNotFoundError(f"Workspace '{workspace_id}' not found.")

        def build_node(path: Path) -> Optional[Dict[str, Any]]:
            name = path.name
            if name in IGNORED_TREE_NAMES:
                return None

            rel_path = path.relative_to(ws_dir).as_posix()
            if path.is_dir():
                children = []
                try:
                    for child in sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                        child_node = build_node(child)
                        if child_node is not None:
                            children.append(child_node)
                except PermissionError:
                    pass

                return {
                    "name": name,
                    "path": rel_path,
                    "is_directory": True,
                    "children": children,
                }
            else:
                stat = path.stat()
                return {
                    "name": name,
                    "path": rel_path,
                    "is_directory": False,
                    "size": stat.st_size,
                    "updated_at": stat.st_mtime,
                    "language": detect_language(name),
                }

        tree = []
        for item in sorted(ws_dir.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            node = build_node(item)
            if node is not None:
                tree.append(node)

        return tree

    def read_file(self, workspace_id: str, relative_path: str) -> Dict[str, Any]:
        """Read a file's content and metadata."""
        safe_path = self.resolve_safe_path(workspace_id, relative_path)
        if not safe_path.exists():
            raise FileNotFoundError(f"File '{relative_path}' does not exist.")
        if safe_path.is_dir():
            raise ValueError(f"Path '{relative_path}' is a directory, not a file.")

        try:
            content = safe_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = safe_path.read_text(encoding="latin-1")

        stat = safe_path.stat()
        return {
            "path": relative_path.replace("\\", "/"),
            "content": content,
            "size": stat.st_size,
            "updated_at": stat.st_mtime,
            "language": detect_language(safe_path.name),
        }

    def write_file(self, workspace_id: str, relative_path: str, content: str) -> Dict[str, Any]:
        """Atomically write content to a file."""
        safe_path = self.resolve_safe_path(workspace_id, relative_path)
        safe_path.parent.mkdir(parents=True, exist_ok=True)

        temp_path = safe_path.with_suffix(safe_path.suffix + ".tmp")
        temp_path.write_text(content, encoding="utf-8")
        temp_path.replace(safe_path)

        stat = safe_path.stat()
        # Touch workspace updated_at
        try:
            meta_file = self._get_workspace_dir(workspace_id) / ".solix_workspace.json"
            if meta_file.exists():
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                meta["updated_at"] = time.time()
                meta_file.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception:
            pass

        return {
            "path": relative_path.replace("\\", "/"),
            "size": stat.st_size,
            "updated_at": stat.st_mtime,
            "language": detect_language(safe_path.name),
        }

    def create_file_or_dir(
        self,
        workspace_id: str,
        relative_path: str,
        is_directory: bool = False,
        content: str = "",
    ) -> Dict[str, Any]:
        """Create a new file or directory inside the workspace."""
        safe_path = self.resolve_safe_path(workspace_id, relative_path)
        if safe_path.exists():
            raise FileExistsError(f"Path '{relative_path}' already exists.")

        if is_directory:
            safe_path.mkdir(parents=True, exist_ok=True)
            return {
                "name": safe_path.name,
                "path": relative_path.replace("\\", "/"),
                "is_directory": True,
                "children": [],
            }
        else:
            safe_path.parent.mkdir(parents=True, exist_ok=True)
            safe_path.write_text(content, encoding="utf-8")
            stat = safe_path.stat()
            return {
                "name": safe_path.name,
                "path": relative_path.replace("\\", "/"),
                "is_directory": False,
                "size": stat.st_size,
                "updated_at": stat.st_mtime,
                "language": detect_language(safe_path.name),
            }

    def delete_path(self, workspace_id: str, relative_path: str) -> bool:
        """Delete a file or directory."""
        safe_path = self.resolve_safe_path(workspace_id, relative_path)
        if not safe_path.exists():
            raise FileNotFoundError(f"Path '{relative_path}' not found.")

        if safe_path.is_dir():
            shutil.rmtree(safe_path)
        else:
            safe_path.unlink()
        return True

    def rename_path(self, workspace_id: str, old_path: str, new_path: str) -> Dict[str, Any]:
        """Rename or move a file/directory within the workspace."""
        old_safe = self.resolve_safe_path(workspace_id, old_path)
        new_safe = self.resolve_safe_path(workspace_id, new_path)

        if not old_safe.exists():
            raise FileNotFoundError(f"Source path '{old_path}' not found.")
        if new_safe.exists():
            raise FileExistsError(f"Destination path '{new_path}' already exists.")

        new_safe.parent.mkdir(parents=True, exist_ok=True)
        old_safe.rename(new_safe)

        is_dir = new_safe.is_dir()
        return {
            "old_path": old_path.replace("\\", "/"),
            "new_path": new_path.replace("\\", "/"),
            "is_directory": is_dir,
            "language": detect_language(new_safe.name) if not is_dir else None,
        }


workspace_storage = WorkspaceStorage()
