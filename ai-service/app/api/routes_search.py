from fastapi import APIRouter, Depends

from app.core.security import verify_internal_api_key
from app.search.schemas import SearchRequest, SearchResponse
from app.search.search_service import search

router = APIRouter(prefix="/internal", dependencies=[Depends(verify_internal_api_key)])


@router.post("/search", response_model=SearchResponse)
async def search_chunks(request: SearchRequest) -> SearchResponse:
    return await search(request)
