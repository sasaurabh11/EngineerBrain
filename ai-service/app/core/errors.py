from typing import NoReturn

from fastapi import HTTPException

_PROFILE_HINT = "Add your own Gemini or Groq API key in your profile settings to avoid this."
_PROFILE_HINT_MID_SENTENCE = "add your own Gemini or Groq API key in your profile settings."


def _status_code_of(exc: Exception) -> int | None:
    for attr in ("status_code", "code"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    return None


def classify_provider_error(exc: Exception) -> dict:
    """Classifies an exception raised while calling an LLM provider (Gemini or
    Groq, via get_chat_model) into a structured, user-safe {code, message}
    detail - never leaks the raw provider exception (which can include
    request/response internals) to the client. Shared by raise_provider_error
    (for normal request/response endpoints) and streaming endpoints, which
    can't raise an HTTPException mid-stream since headers are already sent."""
    if isinstance(exc, RuntimeError) and "is not configured" in str(exc):
        return {"code": "not_configured", "message": f"No AI provider is configured for this request. {_PROFILE_HINT}"}

    status = _status_code_of(exc)
    if status == 429:
        return {"code": "rate_limited", "message": f"The AI provider is rate-limiting requests right now. {_PROFILE_HINT}"}
    if status in (401, 403):
        return {"code": "auth_error", "message": f"The AI provider rejected the request's credentials. {_PROFILE_HINT}"}

    return {
        "code": "provider_error",
        "message": f"The AI provider returned an error. If this keeps happening, {_PROFILE_HINT_MID_SENTENCE}",
    }


def raise_provider_error(exc: Exception) -> NoReturn:
    detail = classify_provider_error(exc)
    status = {"not_configured": 503, "rate_limited": 429, "auth_error": 502}.get(detail["code"], 502)
    raise HTTPException(status_code=status, detail=detail) from exc
