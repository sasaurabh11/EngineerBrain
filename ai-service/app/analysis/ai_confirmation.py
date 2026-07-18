import logging

from pydantic import BaseModel, Field

from app.agents.llm import get_chat_model
from app.analysis.analyzer import AnalysisContext, RawFinding
from app.core.config import settings

logger = logging.getLogger(__name__)

_CANDIDATE_CATEGORIES = frozenset({"SOLID", "PATTERN"})
_MAX_SNIPPET_CHARS = 3000


class ConfirmationResult(BaseModel):
    confirmed: bool
    confidence: int = Field(ge=0, le=100)
    explanation: str
    suggested_fix: str | None = None


def _is_configured(provider: str, api_key: str | None) -> bool:
    if api_key:
        return True
    return bool(settings.groq_api_key) if provider == "groq" else bool(settings.gemini_api_key)


def _snippet_for(context: AnalysisContext, finding: RawFinding) -> str:
    if finding.file_path is None:
        return ""
    file = next((f for f in context.files if f.path == finding.file_path), None)
    if file is None:
        return ""
    if finding.start_line is None or finding.end_line is None:
        text = file.source.decode("utf-8", errors="replace")
    else:
        lines = file.source.decode("utf-8", errors="replace").splitlines()
        text = "\n".join(lines[finding.start_line - 1 : finding.end_line])
    return text[:_MAX_SNIPPET_CHARS]


async def _confirm_one(
    structured_llm, context: AnalysisContext, finding: RawFinding
) -> RawFinding | None:
    snippet = _snippet_for(context, finding)
    prompt = (
        f"You are reviewing a candidate {finding.category.lower()} finding detected by a structural heuristic "
        f"(naming conventions and code shape), not by understanding the code's actual behavior.\n\n"
        f"Type: {finding.type}\nTitle: {finding.title}\nStructural signal: {finding.explanation}\n\n"
        f"Code ({finding.file_path}):\n{snippet}\n\n"
        "Judge whether this is a real, meaningful instance rather than a coincidence of naming."
    )

    try:
        data: ConfirmationResult = await structured_llm.ainvoke(prompt)
    except Exception:
        logger.exception("AI confirmation call failed for finding type=%s file=%s", finding.type, finding.file_path)
        return None

    if not data.confirmed:
        return None

    return RawFinding(
        category=finding.category,
        type=finding.type,
        severity=finding.severity,
        title=finding.title,
        explanation=data.explanation or finding.explanation,
        confidence=data.confidence if data.confidence is not None else finding.confidence,
        file_path=finding.file_path,
        start_line=finding.start_line,
        end_line=finding.end_line,
        symbol_name=finding.symbol_name,
        suggested_fix=data.suggested_fix,
        metadata=finding.metadata,
    )


async def confirm_candidates(
    findings: list[RawFinding],
    context: AnalysisContext,
    provider: str = "gemini",
    api_key: str | None = None,
) -> list[RawFinding]:
    """SOLID/pattern findings are structural guesses (naming + shape), not
    confirmed problems - this is the only place an LLM call happens during
    analysis itself; everything else stays deterministic. If the selected
    provider isn't configured, candidates are dropped rather than shown
    unconfirmed, since an unconfirmed guess at a semantic judgment isn't a
    trustworthy finding."""
    candidates = [f for f in findings if f.category in _CANDIDATE_CATEGORIES]
    other_findings = [f for f in findings if f.category not in _CANDIDATE_CATEGORIES]

    if not candidates or not _is_configured(provider, api_key):
        return other_findings

    structured_llm = get_chat_model(temperature=0, provider=provider, api_key=api_key).with_structured_output(ConfirmationResult)
    confirmed: list[RawFinding] = []
    for finding in candidates:
        result = await _confirm_one(structured_llm, context, finding)
        if result is not None:
            confirmed.append(result)

    return other_findings + confirmed
