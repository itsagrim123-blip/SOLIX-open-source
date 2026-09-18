import logging
from typing import List, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from app.services.files import file_service
from app.services.files.models import FileMetadata
from app.services.files.validator import validate_file_count

logger = logging.getLogger("solix.api.files")
router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/upload", response_model=List[FileMetadata])
async def upload_files(
    files: List[UploadFile] = File(...),
    conversation_id: Optional[str] = Form(None),
):
    """
    Upload one or more files to Solix.
    Validates file sizes, magic bytes, parses format, extracts text, chunks, and indexes.
    """
    count_err = validate_file_count(len(files))
    if count_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=count_err,
        )

    results: List[FileMetadata] = []
    for upload in files:
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
        "error": meta.error,
    }


@router.delete("/{file_id}")
async def delete_file(file_id: str):
    """Remove an uploaded file and clear its index."""
    deleted = file_service.delete_file(file_id)
    return {"success": deleted, "file_id": file_id}

