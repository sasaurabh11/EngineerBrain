from fastapi import APIRouter, Depends

from app.core.security import verify_internal_api_key
from app.indexing.pipeline import run_index
from app.indexing.schemas import IndexRequest, IndexResponse

router = APIRouter(prefix="/internal", dependencies=[Depends(verify_internal_api_key)])


@router.post("/index", response_model=IndexResponse)
async def index_repository(request: IndexRequest) -> IndexResponse:
    return await run_index(request)
