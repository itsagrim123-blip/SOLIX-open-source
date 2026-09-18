import logging
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from app.services.files.models import DocumentChunk
from app.services.files.retriever import BM25Retriever
from app.services.workspace.storage import workspace_storage

logger = logging.getLogger("solix.workspace.context")

# Regex patterns to detect symbol definitions across languages
SYMBOL_PATTERNS = [
    # Python
    re.compile(r"^\s*(def|async\s+def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)", re.MULTILINE),
    # JS/TS
    re.compile(r"^\s*(export\s+)?(function|class|interface|type|const|let)\s+([a-zA-Z_][a-zA-Z0-9_]*)", re.MULTILINE),
    # Rust
    re.compile(r"^\s*(pub\s+)?(fn|struct|enum|trait|impl)\s+([a-zA-Z_][a-zA-Z0-9_]*)", re.MULTILINE),
    # Go
    re.compile(r"^\s*func\s+(\([^)]+\)\s+)?([a-zA-Z_][a-zA-Z0-9_]*)", re.MULTILINE),
    # Java/C/C++
    re.compile(r"^\s*(public|private|protected|static|\s)*\s*(class|interface|struct)\s+([a-zA-Z_][a-zA-Z0-9_]*)", re.MULTILINE),
]

TEXT_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".scss",
    ".json", ".md", ".rs", ".go", ".java", ".c", ".h", ".cpp", ".hpp",
    ".cs", ".php", ".sql", ".sh", ".bash", ".yaml", ".yml", ".toml", ".txt",
}

IGNORED_DIRS = {
    ".git", "__pycache__", ".venv", "venv", "node_modules", ".next",
    ".pytest_cache", "dist", "build", "target", "bin", "obj",
}


class CodeContextEngine:
    """Indexes and retrieves project-wide code context with symbol awareness and priority budgeting."""

    def __init__(self, max_tokens: int = 4000):
        self.max_tokens = max_tokens

    def _extract_symbols(self, text: str) -> List[str]:
        """Extract top-level and member symbol names from code."""
        symbols: Set[str] = set()
        for pattern in SYMBOL_PATTERNS:
            for match in pattern.finditer(text):
                # The symbol name is typically in the last capture group
                groups = [g for g in match.groups() if g and g.isidentifier()]
                if groups:
                    symbols.add(groups[-1])
        return sorted(list(symbols))

    def _get_workspace_code_files(self, workspace_id: str) -> List[Tuple[str, str]]:
        """Collect all text code files in a workspace as (relative_path, content)."""
        ws_dir = workspace_storage.resolve_safe_path(workspace_id, ".")
        files: List[Tuple[str, str]] = []

        for root, dirs, filenames in os.walk(ws_dir):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]
            for fname in filenames:
                if fname.startswith(".solix_"):
                    continue
                ext = Path(fname).suffix.lower()
                if ext in TEXT_EXTENSIONS or fname in ("Dockerfile", "Makefile", "LICENSE"):
                    full_p = Path(root) / fname
                    rel_p = full_p.relative_to(ws_dir).as_posix()
                    try:
                        content = full_p.read_text(encoding="utf-8")
                        files.append((rel_p, content))
                    except Exception:
                        pass
        return files

    def _chunk_code_file(self, rel_path: str, content: str, chunk_size_lines: int = 45) -> List[DocumentChunk]:
        """Chunk code into overlapping line-based sections with symbol annotation."""
        lines = content.splitlines()
        if not lines:
            return []

        chunks: List[DocumentChunk] = []
        step = max(1, chunk_size_lines - 10)  # 10 lines overlap

        for i in range(0, len(lines), step):
            chunk_lines = lines[i : i + chunk_size_lines]
            chunk_text = "\n".join(chunk_lines)
            symbols = self._extract_symbols(chunk_text)
            symbols_meta = f" [Symbols: {', '.join(symbols)}]" if symbols else ""

            chunk_id = f"{rel_path}:{i+1}-{i+len(chunk_lines)}"
            doc_chunk = DocumentChunk(
                chunk_id=chunk_id,
                file_id=rel_path,
                filename=Path(rel_path).name,
                content=f"// File: {rel_path} (Lines {i+1}-{i+len(chunk_lines)}){symbols_meta}\n{chunk_text}",
                line_start=i + 1,
                line_end=i + len(chunk_lines),
                section=f"{rel_path} ({i+1}-{i+len(chunk_lines)})",
            )
            chunks.append(doc_chunk)

            if i + chunk_size_lines >= len(lines):
                break

        return chunks

    def build_context(
        self,
        workspace_id: str,
        query: str,
        current_file: Optional[str] = None,
        selected_code: Optional[str] = None,
        open_files: Optional[List[str]] = None,
    ) -> str:
        """Assemble a grounded context string across the entire coding project with strict priority."""
        code_files = self._get_workspace_code_files(workspace_id)
        if not code_files:
            return "No project files found in workspace."

        tree_nodes = workspace_storage.get_workspace_tree(workspace_id)
        file_list_summary = []

        def recurse_summary(nodes: List[Dict[str, Any]], indent: int = 0):
            for n in nodes:
                pfx = "  " * indent
                if n.get("is_directory"):
                    file_list_summary.append(f"{pfx}📁 {n['name']}/")
                    recurse_summary(n.get("children", []), indent + 1)
                else:
                    file_list_summary.append(f"{pfx}📄 {n['name']} ({n.get('size', 0)} B)")

        recurse_summary(tree_nodes)
        tree_str = "\n".join(file_list_summary[:40])

        context_parts: List[str] = []
        est_chars = 0
        max_chars = self.max_tokens * 4  # Roughly 4 chars per token

        # 1. Project Overview Tree
        tree_block = f"--- PROJECT FILE TREE ---\n{tree_str}\n"
        context_parts.append(tree_block)
        est_chars += len(tree_block)

        # 2. Priority 1: Current Active File & Selection
        if current_file:
            matching = next((c for p, c in code_files if p == current_file), None)
            if matching is not None:
                cur_block = f"--- ACTIVE FILE: {current_file} ---\n{matching}\n"
                if selected_code and selected_code.strip():
                    cur_block += f"\n--- USER SELECTED CODE ({current_file}) ---\n{selected_code.strip()}\n"
                context_parts.append(cur_block)
                est_chars += len(cur_block)

        # 3. Priority 2: Open Files (if within budget)
        open_set = set(open_files or [])
        for rel_p, content in code_files:
            if rel_p in open_set and rel_p != current_file:
                if est_chars + min(len(content), 1200) < max_chars:
                    sample = content[:1200]
                    if len(content) > 1200:
                        sample += "\n... [truncated for length]"
                    open_block = f"--- OPEN TAB: {rel_p} ---\n{sample}\n"
                    context_parts.append(open_block)
                    est_chars += len(open_block)

        # 4. Priority 3: Relevant Project Chunks via BM25
        all_chunks: List[DocumentChunk] = []
        for rel_p, content in code_files:
            # Skip current file since we already loaded it full
            if rel_p == current_file:
                continue
            all_chunks.extend(self._chunk_code_file(rel_p, content))

        if all_chunks and query.strip():
            retriever = BM25Retriever(all_chunks)
            scored = retriever.score(query)
            top_chunks = [c for s, c in scored[:8] if s > 0.1]

            if top_chunks:
                rel_parts = ["--- RELEVANT CODE ACROSS PROJECT ---"]
                for c in top_chunks:
                    chunk_text = c.content + "\n"
                    if est_chars + len(chunk_text) < max_chars:
                        rel_parts.append(chunk_text)
                        est_chars += len(chunk_text)
                    else:
                        break
                if len(rel_parts) > 1:
                    context_parts.append("\n".join(rel_parts))

        # 5. Priority 4: README or Config
        for rel_p, content in code_files:
            if rel_p.lower() in ("readme.md", "requirements.txt", "package.json"):
                if est_chars + min(len(content), 800) < max_chars:
                    sample = content[:800]
                    doc_block = f"--- CONFIG / DOCS: {rel_p} ---\n{sample}\n"
                    context_parts.append(doc_block)
                    est_chars += len(doc_block)

        return "\n\n".join(context_parts)


code_context_engine = CodeContextEngine()
