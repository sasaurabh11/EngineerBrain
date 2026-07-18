from fastapi import APIRouter, Depends

from app.agents.critic import run_critic
from app.agents.messages import from_ai_message, to_langchain_messages
from app.agents.planner import run_planner
from app.agents.reasoning_agent import run_reasoning_step
from app.agents.schemas import AgentStepRequest, AgentStepResponse, PlanRequest, PlanResponse, ValidateRequest, ValidateResponse
from app.core.errors import raise_provider_error
from app.core.security import verify_internal_api_key

router = APIRouter(prefix="/internal/agents", dependencies=[Depends(verify_internal_api_key)])


@router.post("/agent-step", response_model=AgentStepResponse)
async def agent_step(request: AgentStepRequest) -> AgentStepResponse:
    history = to_langchain_messages(request.messages)
    tools = [t.model_dump() for t in request.tools]
    try:
        response = await run_reasoning_step(request.role, history, tools, request.system_context, request.provider, request.api_key)
    except Exception as exc:
        raise_provider_error(exc)
    payload = from_ai_message(response)
    return AgentStepResponse(message=payload, done=not bool(payload.tool_calls))


@router.post("/plan", response_model=PlanResponse)
async def plan(request: PlanRequest) -> PlanResponse:
    try:
        draft, revised = await run_planner(request.goal, request.repository_context, request.available_tools, request.provider, request.api_key)
    except Exception as exc:
        raise_provider_error(exc)
    return PlanResponse(steps=draft.steps, reasoning=draft.reasoning, revised=revised)


@router.post("/validate", response_model=ValidateResponse)
async def validate(request: ValidateRequest) -> ValidateResponse:
    try:
        verdict = await run_critic(request.output, request.evidence, request.provider, request.api_key)
    except Exception as exc:
        raise_provider_error(exc)
    return ValidateResponse(passed=verdict.passed, confidence=verdict.confidence, issues=verdict.issues)
