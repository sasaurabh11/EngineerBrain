from fastapi import APIRouter, Depends

from app.agents.critic import run_critic
from app.agents.messages import from_ai_message, to_langchain_messages
from app.agents.planner import run_planner
from app.agents.reasoning_agent import run_reasoning_step
from app.agents.schemas import AgentStepRequest, AgentStepResponse, PlanRequest, PlanResponse, ValidateRequest, ValidateResponse
from app.core.security import verify_internal_api_key

router = APIRouter(prefix="/internal/agents", dependencies=[Depends(verify_internal_api_key)])


@router.post("/agent-step", response_model=AgentStepResponse)
async def agent_step(request: AgentStepRequest) -> AgentStepResponse:
    history = to_langchain_messages(request.messages)
    tools = [t.model_dump() for t in request.tools]
    response = await run_reasoning_step(request.role, history, tools, request.system_context)
    payload = from_ai_message(response)
    return AgentStepResponse(message=payload, done=not bool(payload.tool_calls))


@router.post("/plan", response_model=PlanResponse)
async def plan(request: PlanRequest) -> PlanResponse:
    draft, revised = await run_planner(request.goal, request.repository_context, request.available_tools)
    return PlanResponse(steps=draft.steps, reasoning=draft.reasoning, revised=revised)


@router.post("/validate", response_model=ValidateResponse)
async def validate(request: ValidateRequest) -> ValidateResponse:
    verdict = await run_critic(request.output, request.evidence)
    return ValidateResponse(passed=verdict.passed, confidence=verdict.confidence, issues=verdict.issues)
