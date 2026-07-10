from pydantic import BaseModel


class AnalysisFileInput(BaseModel):
    path: str
    language: str
    content_hash: str


class AnalysisRequest(BaseModel):
    organization_id: str
    repository_id: str
    commit_sha: str | None = None
    clone_url: str
    access_token: str
    default_branch: str


class FindingPayload(BaseModel):
    category: str
    type: str
    severity: str
    title: str
    explanation: str
    suggested_fix: str | None = None
    confidence: int
    file_path: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    symbol_name: str | None = None
    metadata: dict = {}


class AnalysisResponse(BaseModel):
    overall_score: int
    architecture_score: int
    security_score: int
    performance_score: int
    maintainability_score: int
    findings: list[FindingPayload]
