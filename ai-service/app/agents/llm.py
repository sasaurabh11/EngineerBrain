from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq

from app.core.config import settings

ChatModel = ChatGoogleGenerativeAI | ChatGroq


def get_chat_model(temperature: float = 0.2, provider: str = "gemini", api_key: str | None = None) -> ChatModel:
    if provider == "groq":
        key = api_key or settings.groq_api_key
        if not key:
            raise RuntimeError("GROQ_API_KEY is not configured")
        return ChatGroq(model=settings.groq_chat_model, api_key=key, temperature=temperature)

    key = api_key or settings.gemini_api_key
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return ChatGoogleGenerativeAI(model=settings.gemini_chat_model, google_api_key=key, temperature=temperature)
