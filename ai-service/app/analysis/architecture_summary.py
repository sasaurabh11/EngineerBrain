import logging

from google import genai

from app.analysis.analyzer import AnalysisContext, RawFinding
from app.core.config import settings

logger = logging.getLogger(__name__)

_FALLBACK_SUMMARY = "Architecture summary unavailable (Gemini is not configured for this deployment)."
_MAX_FINDINGS_IN_PROMPT = 15


def _is_configured() -> bool:
    return bool(settings.gemini_api_key)


async def generate_architecture_summary(
    context: AnalysisContext,
    findings: list[RawFinding],
    scores: dict[str, int],
    detected_frameworks: list[str],
) -> str:
    """One LLM call per analysis (not per-finding) synthesizing an overview -
    grounded in the actual scores and findings, not a generic description."""
    if not _is_configured():
        return _FALLBACK_SUMMARY

    dependency_findings = [f for f in findings if f.category == "DEPENDENCY"][:_MAX_FINDINGS_IN_PROMPT]
    findings_text = (
        "\n".join(f"- [{f.severity}] {f.title}" for f in dependency_findings) if dependency_findings else "None detected."
    )

    prompt = (
        "You are summarizing a codebase's architecture for an engineering team, based on real analysis data below - "
        "not a generic description of good architecture.\n\n"
        f"Files analyzed: {len(context.files)}\n"
        f"Detected frameworks: {', '.join(detected_frameworks) if detected_frameworks else 'none detected'}\n"
        f"Architecture score: {scores['architecture_score']}/100\n"
        f"Modularity score: {scores['modularity_score']}/100\n"
        f"Layering score: {scores['layering_score']}/100\n"
        f"Dependency-related findings:\n{findings_text}\n\n"
        "Write a concise (3-5 sentence) architecture summary: what kind of system this looks like, its structural "
        "strengths, and its most important structural risk if any. Reference the actual scores/findings above, don't "
        "give a generic textbook description."
    )

    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        response = await client.aio.models.generate_content(model=settings.gemini_chat_model, contents=prompt)
        return response.text.strip() if response.text else _FALLBACK_SUMMARY
    except Exception:
        logger.exception("Architecture summary generation failed")
        return _FALLBACK_SUMMARY
