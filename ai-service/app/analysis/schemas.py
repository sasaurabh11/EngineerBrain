from typing import Literal

from pydantic import BaseModel


class AnalysisFileInput(BaseModel):
    path: str
    language: str
    content_hash: str


class AnalysisRequest(BaseModel):
    organization_id: str
    repository_id: str
    # When set, analyzes this specific branch/commit instead of default_branch
    # (e.g. a PR's head commit) - uses an isolated scratch clone, not the
    # persisted default-branch cache.
    commit_sha: str | None = None
    clone_url: str
    access_token: str
    default_branch: str
    # When set, the returned findings are filtered to only these files (or
    # findings that otherwise reference one of them) - for diff-scoped review.
    changed_files: list[str] | None = None
    provider: Literal["gemini", "groq"] = "gemini"
    api_key: str | None = None


class FindingPayload(BaseModel):
    category: str
    type: str
    severity: str
    priority: str | None = None
    title: str
    explanation: str
    evidence: str | None = None
    suggested_fix: str | None = None
    estimated_impact: str | None = None
    confidence: int
    file_path: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    symbol_name: str | None = None
    related_files: list[str] = []
    related_classes: list[str] = []
    related_functions: list[str] = []
    metadata: dict = {}


class AnalysisResponse(BaseModel):
    overall_score: int
    architecture_score: int
    security_score: int
    performance_score: int
    maintainability_score: int
    scalability_score: int
    modularity_score: int
    layering_score: int
    documentation_score: int
    complexity_score: int
    technical_debt_score: int
    architecture_summary: str
    findings: list[FindingPayload]
