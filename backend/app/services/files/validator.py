import hashlib
import os
import re
from typing import Optional
from app.core.config import settings


def sanitize_filename(filename: str) -> str:
    """
    Sanitize an uploaded filename to prevent directory traversal and filesystem attacks.
    Removes paths, null bytes, and non-printable characters.
    """
    if not filename:
        return "unnamed_file"

    # Strip directory components (both Unix and Windows separators)
    clean_name = os.path.basename(filename.replace("\\", "/"))

    # Remove null bytes and control characters
    clean_name = re.sub(r"[\x00-\x1f\x7f]", "", clean_name)

    # Strip leading/trailing dots and spaces (prevents hidden files / traversal tricks like "..")
    clean_name = clean_name.strip(". ")

    # Fallback if empty after stripping
    if not clean_name:
        return "unnamed_file"

    # Truncate length to 255 chars
    if len(clean_name) > 255:
        base, ext = os.path.splitext(clean_name)
        clean_name = base[: 255 - len(ext)] + ext

    return clean_name


def validate_file_size(size_bytes: int, max_size_mb: Optional[int] = None) -> Optional[str]:
    """Validate file size against configured limits."""
    max_mb = max_size_mb or settings.MAX_FILE_SIZE_MB
    max_bytes = max_mb * 1024 * 1024
    if size_bytes > max_bytes:
        return f"File is too large. Maximum allowed size is {max_mb} MB (got {size_bytes / (1024*1024):.1f} MB)."
    if size_bytes == 0:
        return "File is empty."
    return None


def validate_file_count(count: int, max_count: Optional[int] = None) -> Optional[str]:
    """Validate total number of attached files in a single request."""
    limit = max_count or settings.MAX_FILES_PER_REQUEST
    if count > limit:
        return f"Too many files uploaded. Maximum allowed is {limit} files per request."
    return None


def compute_sha256(data: bytes) -> str:
    """Compute SHA-256 cryptographic hash of byte content."""
    return hashlib.sha256(data).hexdigest()

