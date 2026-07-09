from pydantic import BaseModel


class SearchRequest(BaseModel):
    query_text: str
    repository_ids: list[str]
    kinds: list[str] | None = None
    limit: int = 10


class SearchResultItem(BaseModel):
    chunk_id: str
    score: float
    repository_id: str
    file_path: str
    kind: str


class SearchResponse(BaseModel):
    results: list[SearchResultItem]
