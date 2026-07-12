from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.config import settings


def get_chat_model(temperature: float = 0.2) -> ChatGoogleGenerativeAI:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return ChatGoogleGenerativeAI(model=settings.gemini_chat_model, google_api_key=settings.gemini_api_key, temperature=temperature)
