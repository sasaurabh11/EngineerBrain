from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import verify_internal_api_key
from app.indexing.file_walker import MAX_FILE_SIZE_BYTES
from app.repository import clone_manager
from app.repository.schemas import FileContentRequest, FileContentResponse

router = APIRouter(prefix="/internal", dependencies=[Depends(verify_internal_api_key)])


@router.post("/file-content", response_model=FileContentResponse)
async def get_file_content(request: FileContentRequest) -> FileContentResponse:
    repo_path = clone_manager.ensure_repository(
        request.repository_id, request.clone_url, request.access_token, request.default_branch
    )
    repo_root = repo_path.resolve()
    target = (repo_path / request.file_path).resolve()

    if repo_root not in target.parents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file path")

    if not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    if target.stat().st_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")

    return FileContentResponse(content=target.read_text(errors="replace"))
