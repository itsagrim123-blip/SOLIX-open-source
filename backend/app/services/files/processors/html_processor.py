import os
from bs4 import BeautifulSoup
from app.services.files.chunker import DocumentChunker
from app.services.files.models import ExtractionResult
from app.services.files.processors.base import BaseFileProcessor


class HtmlProcessor(BaseFileProcessor):
    """Safely extracts visible text and structure from HTML documents without script execution."""

    def __init__(self):
        self.chunker = DocumentChunker(chunk_size=1000, chunk_overlap=150)

    def can_process(self, category: str, mime_type: str, filename: str) -> bool:
        ext = os.path.splitext(filename.lower())[1]
        return category == "html" or ext in (".html", ".htm")

    async def extract(self, file_id: str, filename: str, content_bytes: bytes) -> ExtractionResult:
        # Decode HTML safely
        html_text = ""
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                html_text = content_bytes.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        if not html_text:
            html_text = content_bytes.decode("utf-8", errors="replace")

        soup = BeautifulSoup(html_text, "html.parser")

        # Strip all script, style, noscript, and iframe tags
        for tag in soup(["script", "style", "noscript", "iframe", "object", "embed", "svg"]):
            tag.decompose()

        title = soup.title.string.strip() if soup.title and soup.title.string else None

        # Build clean structured representation
        extracted_lines = []
        if title:
            extracted_lines.append(f"# {title}\n")

        for elem in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "table", "pre", "code"]):
            if elem.name in ("h1", "h2", "h3", "h4", "h5", "h6"):
                level = int(elem.name[1])
                extracted_lines.append(f"\n{'#' * level} {elem.get_text(strip=True)}\n")
            elif elem.name == "p":
                p_text = elem.get_text(strip=True)
                if p_text:
                    extracted_lines.append(f"{p_text}\n")
            elif elem.name == "li":
                li_text = elem.get_text(strip=True)
                if li_text:
                    extracted_lines.append(f"- {li_text}")
            elif elem.name == "pre" or elem.name == "code":
                code_text = elem.get_text()
                if code_text.strip():
                    extracted_lines.append(f"```\n{code_text}\n```")
            elif elem.name == "table":
                # Format table
                rows = []
                for tr in elem.find_all("tr"):
                    cells = [td.get_text(strip=True) for td in tr.find_all(["th", "td"])]
                    if cells:
                        rows.append(" | ".join(cells))
                if rows:
                    extracted_lines.append("\n[Table]\n" + "\n".join(rows) + "\n")

        cleaned_text = "\n".join(extracted_lines).strip()
        if not cleaned_text:
            # Fallback to general text extraction
            cleaned_text = soup.get_text(separator="\n", strip=True)

        chunks = self.chunker.chunk_text(
            cleaned_text,
            file_id=file_id,
            filename=filename,
            section=title or "HTML Content",
        )

        return ExtractionResult(
            text=cleaned_text,
            chunks=chunks,
            metadata={"title": title, "char_count": len(cleaned_text)},
        )

