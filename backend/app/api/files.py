import logging
import os
from typing import List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from app.services.files import file_service
from app.services.files.models import FileMetadata
from app.services.files.validator import validate_file_count

logger = logging.getLogger("solix.api.files")
router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/upload", response_model=List[FileMetadata])
async def upload_files(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    conversation_id: Optional[str] = Form(None),
):
    """
    Upload one or more files to Solix.
    Validates file sizes, magic bytes, parses format, extracts text, chunks, and indexes.
    Supports both 'files' (multi) and 'file' (single) form-data field keys.
    """
    upload_list: List[UploadFile] = []
    if files:
        upload_list.extend(files)
    if file:
        upload_list.append(file)

    if not upload_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided in upload request.",
        )

    count_err = validate_file_count(len(upload_list))
    if count_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=count_err,
        )

    results: List[FileMetadata] = []
    for upload in upload_list:
        filename = upload.filename or "unnamed_file"
        claimed_mime = upload.content_type
        try:
            content_bytes = await upload.read()
            metadata = await file_service.process_upload(
                filename=filename,
                content_bytes=content_bytes,
                claimed_mime=claimed_mime,
                conversation_id=conversation_id,
            )
            results.append(metadata)
        except Exception as exc:
            logger.error(f"[Files] Error handling upload for '{filename}': {exc}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to process file '{filename}': {exc}",
            )

    return results


@router.get("/{file_id}", response_model=FileMetadata)
async def get_file_metadata(file_id: str):
    """Retrieve metadata and processing status of an uploaded file."""
    meta = file_service.get_metadata(file_id)
    if not meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID '{file_id}' not found or has expired.",
        )
    return meta


@router.get("/{file_id}/status")
async def get_file_status(file_id: str):
    """Check processing status of an uploaded file."""
    meta = file_service.get_metadata(file_id)
    if not meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID '{file_id}' not found.",
        )
    return {
        "file_id": file_id,
        "status": meta.status,
        "filename": meta.filename,
        "chunk_count": meta.chunk_count,
        "url": meta.url,
        "preview_url": meta.preview_url,
        "download_url": meta.download_url,
        "error": meta.error,
    }


@router.get("/{file_id}/content")
@router.get("/{file_id}/preview")
async def get_file_content(file_id: str):
    """
    Stream uploaded file content inline for preview (images, PDF, text, etc.).
    Keeps file paths opaque and prevents directory traversal.
    """
    file_info = file_service.get_file_path(file_id)
    if not file_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID '{file_id}' not found or has expired.",
        )
    file_path, filename, content_type = file_info
    if not os.path.isfile(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical file not found on disk.",
        )

    # Encode filename safely for Content-Disposition header
    encoded_filename = filename.replace('"', '\\"')
    return FileResponse(
        path=file_path,
        media_type=content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{encoded_filename}"',
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/{file_id}/download")
async def download_file(file_id: str):
    """
    Download uploaded file triggering browser save dialog.
    """
    file_info = file_service.get_file_path(file_id)
    if not file_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File with ID '{file_id}' not found or has expired.",
        )
    file_path, filename, content_type = file_info
    if not os.path.isfile(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical file not found on disk.",
        )

    encoded_filename = filename.replace('"', '\\"')
    return FileResponse(
        path=file_path,
        media_type=content_type or "application/octet-stream",
        filename=filename,
        headers={
            "Content-Disposition": f'attachment; filename="{encoded_filename}"',
        },
    )


@router.delete("/{file_id}")
async def delete_file(file_id: str):
    """Remove an uploaded file and clear its index."""
    deleted = file_service.delete_file(file_id)
    return {"success": deleted, "file_id": file_id}
