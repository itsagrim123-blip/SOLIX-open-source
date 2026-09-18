from __future__ import annotations

import logging
from pathlib import Path
import re
from typing import List, Literal, Optional
from pydantic import BaseModel

logger = logging.getLogger("solix.workspace.diagnostics")


class DiagnosticItem(BaseModel):
    severity: Literal["error", "warning", "info"]
    file: str
    line: int
    column: int
    message: str
    source: str


class DiagnosticParser:
    """Parses raw compiler output and runtime stack traces into structured Problem diagnostics."""

    # GCC/Clang: file.cpp:12:5: error: expected ';'
    GCC_PATTERN = re.compile(
        r"^([a-zA-Z0-9_./\\-]+):(\d+):(\d+):\s*(error|fatal error|warning|note):\s*(.+)$",
        re.MULTILINE,
    )

    # TypeScript: src/index.ts(12,5): error TS2304: Cannot find name 'x'.
    TS_PATTERN = re.compile(
        r"^([a-zA-Z0-9_./\\-]+)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+:\s*.+)$",
        re.MULTILINE,
    )

    # Python traceback: File "...", line 12, in <module>
    PY_FRAME_PATTERN = re.compile(
        r'File "([^"]+)", line (\d+)(?:, in [^\n]+)?(?:\n\s+([^\n]+))?',
        re.MULTILINE,
    )
    PY_ERROR_PATTERN = re.compile(
        r"^([a-zA-Z0-9_.]+(?:Error|Exception|Warning)):\s*(.*)$",
        re.MULTILINE,
    )

    # Node.js: at Object.<anonymous> (/path/to/main.js:12:5) or at file:///.../main.js:12:5
    NODE_FRAME_PATTERN = re.compile(
        r"at\s+.*?(?:\((?:.*?[/\\])?([a-zA-Z0-9_./\\-]+\.js):(\d+):(\d+)\)|(?:.*?[/\\])?([a-zA-Z0-9_./\\-]+\.js):(\d+):(\d+))",
        re.MULTILINE,
    )
    NODE_ERROR_PATTERN = re.compile(
        r"^([a-zA-Z0-9_]+Error):\s*(.*)$",
        re.MULTILINE,
    )

    def parse(self, raw_output: str, default_file: Optional[str] = None) -> List[DiagnosticItem]:
        """Parse raw process output (stdout + stderr) into structured diagnostics."""
        if not raw_output or not raw_output.strip():
            return []

        diagnostics: List[DiagnosticItem] = []
        seen_keys = set()

        def add_diag(item: DiagnosticItem):
            key = (item.file, item.line, item.column, item.message)
            if key not in seen_keys:
                seen_keys.add(key)
                diagnostics.append(item)

        # 1. Parse GCC / G++ / Clang errors and warnings
        for match in self.GCC_PATTERN.finditer(raw_output):
            raw_file, line, col, level, msg = match.groups()
            sev: Literal["error", "warning", "info"] = (
                "error" if "error" in level.lower() else "warning" if "warning" in level.lower() else "info"
            )
            # Clean file path relative to workspace
            clean_file = Path(raw_file).name if not ("/" in raw_file or "\\" in raw_file) else raw_file.replace("\\", "/")
            if clean_file.startswith("./"):
                clean_file = clean_file[2:]
            add_diag(
                DiagnosticItem(
                    severity=sev,
                    file=clean_file,
                    line=int(line),
                    column=int(col),
                    message=msg.strip(),
                    source="gcc" if "cpp" in clean_file or "c" in clean_file else "compiler",
                )
            )

        # 2. Parse TypeScript tsc errors
        for match in self.TS_PATTERN.finditer(raw_output):
            raw_file, line, col, level, msg = match.groups()
            clean_file = raw_file.replace("\\", "/")
            if clean_file.startswith("./"):
                clean_file = clean_file[2:]
            add_diag(
                DiagnosticItem(
                    severity="error" if "error" in level.lower() else "warning",
                    file=clean_file,
                    line=int(line),
                    column=int(col),
                    message=msg.strip(),
                    source="tsc",
                )
            )

        # 3. Parse Python Traceback
        if "Traceback (most recent call last):" in raw_output or "Error:" in raw_output:
            py_err_match = self.PY_ERROR_PATTERN.search(raw_output)
            py_err_msg = ""
            if py_err_match:
                py_err_msg = f"{py_err_match.group(1)}: {py_err_match.group(2)}".strip()

            # Find all frames and take the last frame (where error occurred in user code)
            frames = list(self.PY_FRAME_PATTERN.finditer(raw_output))
            if frames:
                # Prefer user workspace files over standard library
                chosen_frame = frames[-1]
                for f in reversed(frames):
                    fn = f.group(1)
                    if not ("lib" in fn.lower() or "python" in fn.lower() or "<" in fn):
                        chosen_frame = f
                        break

                raw_file = chosen_frame.group(1)
                line = chosen_frame.group(2)
                code_snippet = chosen_frame.group(3) or ""
                clean_file = Path(raw_file).name
                msg = py_err_msg or (f"Error on line {line}: {code_snippet}" if code_snippet else f"Error on line {line}")

                add_diag(
                    DiagnosticItem(
                        severity="error",
                        file=clean_file,
                        line=int(line),
                        column=1,
                        message=msg,
                        source="python",
                    )
                )

        # 4. Parse Node.js Runtime Errors
        if "Error:" in raw_output and ("at Object." in raw_output or "at async" in raw_output or "at file:" in raw_output):
            node_err_match = self.NODE_ERROR_PATTERN.search(raw_output)
            node_err_msg = ""
            if node_err_match:
                node_err_msg = f"{node_err_match.group(1)}: {node_err_match.group(2)}".strip()

            frames = list(self.NODE_FRAME_PATTERN.finditer(raw_output))
            if frames:
                f = frames[0]
                raw_file = f.group(1) or f.group(4) or default_file or "index.js"
                line = f.group(2) or f.group(5) or "1"
                col = f.group(3) or f.group(6) or "1"
                clean_file = Path(raw_file).name

                add_diag(
                    DiagnosticItem(
                        severity="error",
                        file=clean_file,
                        line=int(line),
                        column=int(col),
                        message=node_err_msg or "Runtime error",
                        source="node",
                    )
                )

        return diagnostics


diagnostic_parser = DiagnosticParser()

