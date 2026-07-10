from pathlib import Path

from app.analysis.ai_confirmation import confirm_candidates
from app.analysis.analyzer import AnalysisContext, AnalyzedFile
from app.analysis.registry import run_all
from app.analysis.schemas import AnalysisRequest, AnalysisResponse, FindingPayload
from app.analysis.scoring import compute_scores
from app.indexing.file_walker import walk_supported_files
from app.parsers.registry import get_parser_for_file
from app.repository import clone_manager

_MANIFEST_FILENAMES = ("package.json", "requirements.txt", "pom.xml")


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
    repo_path = clone_manager.ensure_repository(
        request.repository_id, request.clone_url, request.access_token, request.default_branch
    )
    context = _build_context(request.repository_id, repo_path)

    findings = await run_all(context)
    findings = await confirm_candidates(findings, context)

    scores = compute_scores(context, findings)

    return AnalysisResponse(
        findings=[
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
            )
            for f in findings
        ],
        **scores,
    )
