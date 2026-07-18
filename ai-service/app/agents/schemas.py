from typing import Literal

from pydantic import BaseModel, Field


class ToolCallPayload(BaseModel):
    id: str
    name: str
    args: dict = Field(default_factory=dict)
    # Gemini's "thinking" models require this opaque signature to be echoed
    # back verbatim on the next turn or function-calling requests are rejected -
    # see additional_kwargs['__gemini_function_call_thought_signatures__'].
    signature: str | None = None


class ChatMessagePayload(BaseModel):
    role: Literal["user", "assistant", "tool"]
    content: str | None = None
    tool_calls: list[ToolCallPayload] | None = None
    tool_call_id: str | None = None
    name: str | None = None


class ToolSpec(BaseModel):
    name: str
    description: str
    parameters: dict = Field(default_factory=dict)


class AgentStepRequest(BaseModel):
    role: Literal["retriever", "synthesizer", "task_step"]
    messages: list[ChatMessagePayload]
    tools: list[ToolSpec] = Field(default_factory=list)
    # Caller-specific instructions (org/repo name, citation format, safety
    # guardrails) prepended alongside the role's generic system prompt -
    # the wire format has no "system" message role, so this is the channel for it.
    system_context: str | None = None
    # Which LLM backs this call, and an optional per-user API key override -
    # falls back to this service's own env-configured default when api_key is None.
    provider: Literal["gemini", "groq"] = "gemini"
    api_key: str | None = None


class AgentStepResponse(BaseModel):
    message: ChatMessagePayload
    done: bool


class PlanStepPayload(BaseModel):
    id: str
    type: Literal["tool", "agent", "decision", "validation"]
    name: str
    depends_on: list[str] = Field(default_factory=list)
    parallel_group: str | None = None
    input_template: dict = Field(default_factory=dict)


class PlanRequest(BaseModel):
    goal: str
    repository_context: str | None = None
    available_tools: list[ToolSpec]
    provider: Literal["gemini", "groq"] = "gemini"
    api_key: str | None = None


class PlanResponse(BaseModel):
    steps: list[PlanStepPayload]
    reasoning: str
    revised: bool


class ValidateRequest(BaseModel):
    output: str
    evidence: list[str] = Field(default_factory=list)
    provider: Literal["gemini", "groq"] = "gemini"
    api_key: str | None = None


class ValidateResponse(BaseModel):
    passed: bool
    confidence: int
    issues: list[str] = Field(default_factory=list)
