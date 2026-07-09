from qdrant_client import QdrantClient, models

from app.core.config import settings

COLLECTION_NAME = "code_chunks"

_client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)


def ensure_collection() -> None:
    if _client.collection_exists(COLLECTION_NAME):
        return

    _client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=models.VectorParams(size=settings.embedding_dimensions, distance=models.Distance.COSINE),
    )


def upsert_chunks(points: list[dict]) -> None:
    """points: [{id, vector, organization_id, repository_id, file_path, kind, symbol_name}]"""
    _client.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            models.PointStruct(
                id=point["id"],
                vector=point["vector"],
                payload={
                    "organization_id": point["organization_id"],
                    "repository_id": point["repository_id"],
                    "file_path": point["file_path"],
                    "kind": point["kind"],
                    "symbol_name": point.get("symbol_name"),
                },
            )
            for point in points
        ],
    )


def delete_by_ids(chunk_ids: list[str]) -> None:
    if not chunk_ids:
        return
    _client.delete(collection_name=COLLECTION_NAME, points_selector=models.PointIdsList(points=chunk_ids))


def delete_by_repository(repository_id: str) -> None:
    _client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[models.FieldCondition(key="repository_id", match=models.MatchValue(value=repository_id))]
            )
        ),
    )


def delete_by_file(repository_id: str, file_path: str) -> None:
    _client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(key="repository_id", match=models.MatchValue(value=repository_id)),
                    models.FieldCondition(key="file_path", match=models.MatchValue(value=file_path)),
                ]
            )
        ),
    )


def search(query_vector: list[float], repository_ids: list[str], limit: int = 10) -> list[dict]:
    results = _client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        query_filter=models.Filter(
            must=[models.FieldCondition(key="repository_id", match=models.MatchAny(any=repository_ids))]
        ),
        limit=limit,
        with_payload=True,
    )
    return [{"chunk_id": point.id, "score": point.score, "payload": point.payload} for point in results.points]
