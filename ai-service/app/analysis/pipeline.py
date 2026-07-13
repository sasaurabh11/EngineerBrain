from pathlib import Path

from app.analysis.ai_confirmation import confirm_candidates
from app.analysis.analyzer import AnalysisContext, AnalyzedFile
from app.analysis.architecture_summary import generate_architecture_summary
from app.analysis.enrichment import (
    compute_estimated_impact,
    compute_evidence,
    compute_priority,
    compute_related_files,
    compute_related_symbols,
)
from app.analysis.registry import run_all
from app.analysis.schemas import AnalysisRequest, AnalysisResponse, FindingPayload
from app.analysis.scoring import compute_scores
from app.indexing.file_walker import walk_supported_files
from app.parsers.registry import get_parser_for_file
from app.repository import clone_manager

_MANIFEST_FILENAMES = ("package.json", "requirements.txt", "pom.xml")

# Lightweight keyword sniff over already-read manifest text, purely to give the
# architecture summary prompt a "what kind of system is this" hint - not a
# first-class framework-detection feature.
_FRAMEWORK_KEYWORDS = (
    "react",
    "next",
    "express",
    "nestjs",
    "vue",
    "angular",
    "django",
    "flask",
    "fastapi",
    "spring",
)


def _detect_frameworks(manifests: dict[str, str]) -> list[str]:
    combined = " ".join(manifests.values()).lower()
    return [keyword for keyword in _FRAMEWORK_KEYWORDS if keyword in combined]


def _build_context(repository_id: str, repo_path: Path) -> AnalysisContext:
    files: list[AnalyzedFile] = []
    for file_abs_path in walk_supported_files(repo_path):
        relative_path = str(file_abs_path.relative_to(repo_path))
        parser = get_parser_for_file(relative_path)
        if parser is None:
            continue
        source_bytes = file_abs_path.read_bytes()
        parsed = parser.parse(relative_path, source_bytes)
        files.append(AnalyzedFile(path=relative_path, language=parsed.language, source=source_bytes, parsed=parsed))

    manifests: dict[str, str] = {}
    for filename in _MANIFEST_FILENAMES:
        manifest_path = repo_path / filename
        if manifest_path.exists() and manifest_path.is_file():
            manifests[filename] = manifest_path.read_text(errors="ignore")

    return AnalysisContext(repository_id=repository_id, repo_path=repo_path, files=files, dependency_manifests=manifests)


async def run_analysis(request: AnalysisRequest) -> AnalysisResponse:
    if request.commit_sha:
        repo_path = clone_manager.ensure_repository_at_ref(
            request.repository_id, request.clone_url, request.access_token, request.commit_sha
        )
    else:
        repo_path = clone_manager.ensure_repository(
            request.repository_id, request.clone_url, request.access_token, request.default_branch
        )
    context = _build_context(request.repository_id, repo_path)

    findings = await run_all(context)
    findings = await confirm_candidates(findings, context)

    scores = compute_scores(context, findings)
    detected_frameworks = _detect_frameworks(context.dependency_manifests)
    architecture_summary = await generate_architecture_summary(context, findings, scores, detected_frameworks)

    if request.changed_files is not None:
        changed_set = set(request.changed_files)
        findings = [f for f in findings if f.file_path in changed_set or changed_set & set(compute_related_files(f))]

    findings_payload: list[FindingPayload] = []
    for f in findings:
        related_classes, related_functions = compute_related_symbols(f)
        findings_payload.append(
            FindingPayload(
                category=f.category,
                type=f.type,
                severity=f.severity,
                title=f.title,
                explanation=f.explanation,
                suggested_fix=f.suggested_fix,
                confidence=f.confidence,
                file_path=f.file_path,
                start_line=f.start_line,
                end_line=f.end_line,
                symbol_name=f.symbol_name,
                metadata=f.metadata,
                priority=compute_priority(f),
                evidence=compute_evidence(f),
                estimated_impact=compute_estimated_impact(f),
                related_files=compute_related_files(f),
                related_classes=related_classes,
                related_functions=related_functions,
            )
        )

    if request.commit_sha:
        clone_manager.delete_ref_scratch(request.repository_id, request.commit_sha)

    return AnalysisResponse(findings=findings_payload, architecture_summary=architecture_summary, **scores)
