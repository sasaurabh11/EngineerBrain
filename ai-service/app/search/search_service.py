from app.embeddings.gemini_provider import GeminiEmbeddingProvider
from app.embeddings.gemini_provider import is_configured as embeddings_configured
from app.search.schemas import SearchRequest, SearchResponse, SearchResultItem
from app.vectorstore import qdrant_store


async def search(request: SearchRequest) -> SearchResponse:
    if not embeddings_configured() or not request.repository_ids:
        return SearchResponse(results=[])

    provider = GeminiEmbeddingProvider()
    vectors = await provider.embed([request.query_text], is_query=True)
    query_vector = vectors[0]

    raw_results = qdrant_store.search(query_vector, request.repository_ids, kinds=request.kinds, limit=request.limit)

    return SearchResponse(
        results=[
            SearchResultItem(
                chunk_id=result["chunk_id"],
                score=result["score"],
                repository_id=result["payload"]["repository_id"],
                file_path=result["payload"]["file_path"],
                kind=result["payload"]["kind"],
            )
            for result in raw_results
        ]
    )
