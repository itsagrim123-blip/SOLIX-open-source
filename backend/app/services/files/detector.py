import os
from typing import Optional, Tuple
import puremagic


# Map of extensions to format categories
_EXTENSION_CATEGORIES = {
    # Documents
    ".pdf": "pdf",
    ".docx": "docx",
    ".doc": "doc",
    ".odt": "odt",
    ".rtf": "rtf",
    ".txt": "text",
    ".md": "text",
    ".markdown": "text",
    ".log": "text",
    # Spreadsheets
    ".xlsx": "spreadsheet",
    ".xls": "spreadsheet",
    ".ods": "spreadsheet",
    ".csv": "spreadsheet",
    ".tsv": "spreadsheet",
    # Presentations
    ".pptx": "presentation",
    ".ppt": "presentation",
    ".odp": "presentation",
    # Web / Structured
    ".html": "html",
    ".htm": "html",
    ".xml": "xml",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    # Images
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".gif": "image",
    ".bmp": "image",
    ".tiff": "image",
    ".tif": "image",
    ".svg": "image",
    # Archives
    ".zip": "archive",
    # Code & Config files
    ".py": "code",
    ".js": "code",
    ".jsx": "code",
    ".ts": "code",
    ".tsx": "code",
    ".java": "code",
    ".c": "code",
    ".cpp": "code",
    ".cc": "code",
    ".cxx": "code",
    ".h": "code",
    ".hpp": "code",
    ".cs": "code",
    ".go": "code",
    ".r": "code",
    ".rs": "code",
    ".php": "code",
    ".rb": "code",
    ".swift": "code",
    ".kt": "code",
    ".kts": "code",
    ".sql": "code",
    ".sh": "code",
    ".bash": "code",
    ".bat": "code",
    ".ps1": "code",
    ".css": "code",
    ".scss": "code",
    ".sass": "code",
    ".less": "code",
    ".ini": "code",
    ".toml": "code",
    ".conf": "code",
    ".config": "code",
    ".env": "code",
    ".env.example": "code",
}

# Dangerous executable magic bytes signatures that must NEVER be allowed under document disguises
_DANGEROUS_MAGIC_PREFIXES = [
    b"MZ",              # DOS / Windows PE Executable (EXE, DLL, SYS)
    b"\x7fELF",         # Linux Executable and Linkable Format (ELF)
    b"\xca\xfe\xba\xbe", # Mach-O binary / Java bytecode (when not zip/jar)
    b"\xce\xfa\xed\xfe", # Mach-O 32-bit
    b"\xcf\xfa\xed\xfe", # Mach-O 64-bit
]


def is_text_content(data: bytes, sample_size: int = 4096) -> bool:
    """Check if byte buffer contains valid, printable human-readable text."""
    sample = data[:sample_size]
    if not sample:
        return True
    if b"\x00" in sample:
        # Null bytes strongly indicate binary files
        return False
    try:
        sample.decode("utf-8")
        return True
    except UnicodeDecodeError:
        pass
    try:
        sample.decode("latin-1")
        # Check non-printable characters ratio
        non_printable = sum(1 for b in sample if b < 32 and b not in (9, 10, 13))
        return (non_printable / len(sample)) < 0.15
    except Exception:
        return False


def detect_file_type(
    filename: str,
    header_bytes: bytes,
    claimed_mime: Optional[str] = None,
) -> Tuple[str, str, Optional[str]]:
    """
    Detect the real file format category, canonical MIME type, and error if spoofed or dangerous.

    Returns:
        (category, canonical_mime, error_message)
    """
    ext = os.path.splitext(filename.lower())[1]

    # 1. Security Check: Block dangerous binary executables disguised as anything
    for prefix in _DANGEROUS_MAGIC_PREFIXES:
        if header_bytes.startswith(prefix):
            return "unsupported", "application/octet-stream", "Executable files cannot be uploaded or processed for security reasons."

    # 2. Magic byte sniffing using puremagic
    magic_info = None
    try:
        matches = puremagic.magic_string(header_bytes)
        if matches:
            magic_info = matches[0]
    except Exception:
        magic_info = None

    detected_mime = magic_info.mime_type if magic_info else (claimed_mime or "application/octet-stream")

    # 3. PDF verification
    if header_bytes.startswith(b"%PDF-"):
        if ext and ext != ".pdf":
            return "pdf", "application/pdf", None
        return "pdf", "application/pdf", None
    elif ext == ".pdf":
        # Claimed to be PDF but lacks PDF magic bytes
        return "unsupported", "application/octet-stream", "File has .pdf extension but does not have valid PDF file signature."

    # 4. Image magic bytes verification
    if header_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image", "image/png", None
    if header_bytes.startswith(b"\xff\xd8\xff"):
        return "image", "image/jpeg", None
    if header_bytes.startswith(b"GIF87a") or header_bytes.startswith(b"GIF88a"):
        return "image", "image/gif", None
    if header_bytes.startswith(b"BM"):
        return "image", "image/bmp", None
    if header_bytes.startswith(b"RIFF") and len(header_bytes) >= 12 and header_bytes[8:12] == b"WEBP":
        return "image", "image/webp", None
    if header_bytes.startswith(b"II*\x00") or header_bytes.startswith(b"MM\x00*"):
        return "image", "image/tiff", None

    # SVG text image check
    if ext == ".svg" or (is_text_content(header_bytes) and b"<svg" in header_bytes.lower()):
        return "image", "image/svg+xml", None

    # 5. ZIP-based Office & Archive verification (PK\x03\x04 or PK\x05\x06)
    if header_bytes.startswith(b"PK\x03\x04") or header_bytes.startswith(b"PK\x05\x06"):
        # Could be docx, pptx, xlsx, odt, odp, ods, or plain zip
        if ext == ".docx":
            return "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", None
        if ext == ".pptx":
            return "presentation", "application/vnd.openxmlformats-officedocument.presentationml.presentation", None
        if ext == ".xlsx":
            return "spreadsheet", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", None
        if ext == ".odt":
            return "odt", "application/vnd.oasis.opendocument.text", None
        if ext == ".odp":
            return "presentation", "application/vnd.oasis.opendocument.presentation", None
        if ext == ".ods":
            return "spreadsheet", "application/vnd.oasis.opendocument.spreadsheet", None
        return "archive", "application/zip", None

    # 6. Legacy MS Office compound binary format (.doc, .ppt, .xls)
    if header_bytes.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        if ext == ".doc":
            return "doc", "application/msword", None
        if ext == ".ppt":
            return "presentation", "application/vnd.ms-powerpoint", None
        if ext == ".xls":
            return "spreadsheet", "application/vnd.ms-excel", None
        return "doc", "application/x-ole-storage", None

    # 7. RTF document verification
    if header_bytes.startswith(b"{\\rtf"):
        return "rtf", "application/rtf", None

    # 8. Text, Code, Web, Config detection
    if is_text_content(header_bytes):
        # Known extension match
        if ext in _EXTENSION_CATEGORIES:
            category = _EXTENSION_CATEGORIES[ext]
            return category, claimed_mime or "text/plain", None

        # Check for HTML
        lower_sample = header_bytes[:512].lower()
        if b"<!doctype html" in lower_sample or b"<html" in lower_sample:
            return "html", "text/html", None

        # Check for XML
        if b"<?xml" in lower_sample:
            return "xml", "application/xml", None

        # Check for JSON
        stripped_sample = header_bytes.strip()
        if (stripped_sample.startswith(b"{") and b"}" in stripped_sample) or (
            stripped_sample.startswith(b"[") and b"]" in stripped_sample
        ):
            return "json", "application/json", None

        # Generic plain text
        return "text", "text/plain", None

    # 9. Unsupported binary format
    return "unsupported", detected_mime, "Solix can't read this file type yet."

