from fastapi import APIRouter, Depends

from app.core.security import verify_internal_api_key
from app.repository import clone_manager
from app.vectorstore import qdrant_store

router = APIRouter(prefix="/internal", dependencies=[Depends(verify_internal_api_key)])


@router.delete("/repositories/{repository_id}/clone")
async def delete_repository_clone(repository_id: str) -> dict[str, bool]:
    clone_manager.delete_repository(repository_id)
    qdrant_store.delete_by_repository(repository_id)
    return {"deleted": True}
