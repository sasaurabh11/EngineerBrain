from google import genai
from google.genai import types

from app.core.config import settings
from app.embeddings.base import EmbeddingProvider

_BATCH_SIZE = 100


class GeminiEmbeddingProvider(EmbeddingProvider):
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        self.dimensions = settings.embedding_dimensions
        self._client = genai.Client(api_key=settings.gemini_api_key)

    async def embed(self, texts: list[str], *, is_query: bool = False) -> list[list[float]]:
        task_type = "RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT"
        vectors: list[list[float]] = []

        for start in range(0, len(texts), _BATCH_SIZE):
            batch = texts[start : start + _BATCH_SIZE]
            response = await self._client.aio.models.embed_content(
                model=settings.embedding_model,
                contents=batch,
                config=types.EmbedContentConfig(
                    task_type=task_type,
                    output_dimensionality=settings.embedding_dimensions,
                ),
            )
            vectors.extend(embedding.values for embedding in response.embeddings)

        return vectors


def is_configured() -> bool:
    return bool(settings.gemini_api_key)
