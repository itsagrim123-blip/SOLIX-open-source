import difflib
import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from app.services.workspace.storage import workspace_storage

logger = logging.getLogger("solix.workspace.assistant")

CODING_SYSTEM_PROMPT = """You are Solix, an elite AI coding partner designed to reason across multi-file codebases, debug runtime errors, and produce production-quality software.

PROJECT CONTEXT:
The user has provided grounded context from their current coding workspace, including project file tree, active editor file, open tabs, and relevant code sections.

RULES FOR CODING:
1. Always base your answers on the provided project context.
2. If asked to debug an error, analyze the provided stderr, exit code, and trace down the exact root cause in the code.
3. Keep explanations clear, technical, and concise.
4. When suggesting code changes, bug fixes, refactoring, or writing new files:
   - Provide your explanation and reasoning first.
   - Then, provide a structured patch block in the EXACT format below:

```solix-patch
{
  "file": "path/to/file.ext",
  "explanation": "Concise summary of the modifications",
  "replacement_content": "Complete updated file content"
}
```

5. Make sure the replacement_content contains complete, functional, syntax-valid code (do not use lazy placeholders like '... rest of code here ...').
"""


class CodingAssistantService:
    """Coordinates coding prompts, streaming parsing of structured patches, and diff generation."""

    def extract_patch(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract and parse a structured ```solix-patch JSON block from model response."""
        match = re.search(r"```solix-patch\s*(\{.*?\})\s*```", text, re.DOTALL)
        if not match:
            # Try matching unclosed block if still streaming or trailing
            match = re.search(r"```solix-patch\s*(\{.*)", text, re.DOTALL)
            if not match:
                return None

        raw_json = match.group(1).strip()
        # If it doesn't end with }, attempt to close it if truncated
        if not raw_json.endswith("}"):
            raw_json += '"}'

        try:
            data = json.loads(raw_json)
            if isinstance(data, dict) and "file" in data and "replacement_content" in data:
                return data
        except Exception:
            pass
        return None

    def generate_diff(self, original: str, replacement: str, filename: str = "code") -> str:
        """Generate a unified diff between original code and proposed replacement."""
        orig_lines = original.splitlines(keepends=True)
        repl_lines = replacement.splitlines(keepends=True)
        diff = difflib.unified_diff(
            orig_lines,
            repl_lines,
            fromfile=f"a/{filename}",
            tofile=f"b/{filename}",
            lineterm="",
        )
        return "".join(diff)

    def apply_patch(
        self,
        workspace_id: str,
        file_path: str,
        replacement_content: str,
    ) -> Dict[str, Any]:
        """Validate and apply a structured patch to a workspace file."""
        orig_file = workspace_storage.read_file(workspace_id, file_path)
        orig_content = orig_file["content"]

        # Generate audit diff
        diff_str = self.generate_diff(orig_content, replacement_content, filename=file_path)

        # Atomically write updated content
        res = workspace_storage.write_file(workspace_id, file_path, replacement_content)
        logger.info(f"[Assistant] Successfully applied patch to {file_path} in workspace {workspace_id}")

        return {
            "success": True,
            "file": file_path,
            "size": res["size"],
            "updated_at": res["updated_at"],
            "diff": diff_str,
        }


coding_assistant = CodingAssistantService()

