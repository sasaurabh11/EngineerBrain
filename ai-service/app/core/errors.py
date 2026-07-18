from typing import NoReturn

from fastapi import HTTPException

_PROFILE_HINT = "Add your own Gemini or Groq API key in your profile settings to avoid this."


def _status_code_of(exc: Exception) -> int | None:
    for attr in ("status_code", "code"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    return None


def raise_provider_error(exc: Exception) -> NoReturn:
    """Classifies an exception raised while calling an LLM provider (Gemini or
    Groq, via get_chat_model) and re-raises it as an HTTPException with a
    structured, user-safe detail - never leaks the raw provider exception
    (which can include request/response internals) to the client."""
    if isinstance(exc, RuntimeError) and "is not configured" in str(exc):
        raise HTTPException(
            status_code=503,
            detail={"code": "not_configured", "message": f"No AI provider is configured for this request. {_PROFILE_HINT}"},
        ) from exc

    status = _status_code_of(exc)
    if status == 429:
        raise HTTPException(
            status_code=429,
            detail={"code": "rate_limited", "message": f"The AI provider is rate-limiting requests right now. {_PROFILE_HINT}"},
        ) from exc
    if status in (401, 403):
        raise HTTPException(
            status_code=502,
            detail={"code": "auth_error", "message": f"The AI provider rejected the request's credentials. {_PROFILE_HINT}"},
        ) from exc

    raise HTTPException(
        status_code=502,
        detail={"code": "provider_error", "message": "The AI provider returned an error. Please try again in a moment."},
    ) from exc
