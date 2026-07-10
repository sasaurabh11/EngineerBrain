from fastapi import APIRouter, Depends

from app.analysis.pipeline import run_analysis
from app.analysis.schemas import AnalysisRequest, AnalysisResponse
from app.core.security import verify_internal_api_key

router = APIRouter(prefix="/internal", dependencies=[Depends(verify_internal_api_key)])


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_repository(request: AnalysisRequest) -> AnalysisResponse:
    return await run_analysis(request)
