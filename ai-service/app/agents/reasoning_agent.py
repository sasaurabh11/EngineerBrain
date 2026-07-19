from collections.abc import AsyncIterator
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from app.agents.llm import get_chat_model

_ROLE_SYSTEM_PROMPTS: dict[str, str] = {
    "retriever": (
        "You are the Retriever agent in a multi-agent code-intelligence system. Your job is to gather the "
        "information needed to answer the user's question by calling the available tools. Call a tool whenever "
        "you need more information. Once you have enough to answer, respond in plain text instead of calling "
        "another tool - do not call a tool you've already called with the same arguments."
    ),
    "synthesizer": (
        "You are the Synthesizer agent in a multi-agent code-intelligence system. Write a clear final answer to "
        "the user's original question, using the information already gathered earlier in this conversation (from "
        "the Retriever agent's tool calls) as your source for any repository-specific claim - never invent a "
        "detail about the codebase that isn't backed by that gathered information. Ordinary general-knowledge "
        "questions unrelated to the repository (e.g. basic facts or arithmetic) can be answered directly using "
        "your own knowledge; grounding only applies to claims about this specific codebase. Do not call any "
        "tools yourself."
    ),
    "task_step": (
        "You are an autonomous engineering agent executing one step of a larger task plan. Use the available "
        "tools to complete this specific step. Once the step is complete, report your result in plain text "
        "instead of calling another tool."
    ),
}

AgentRole = Literal["retriever", "synthesizer", "task_step"]


class ReasoningState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


def build_reasoning_graph(
    role: AgentRole,
    tools: list[dict],
    system_context: str | None = None,
    provider: str = "gemini",
    api_key: str | None = None,
):
    llm = get_chat_model(provider=provider, api_key=api_key)
    bound_llm = llm.bind_tools(tools) if tools else llm
    system_prompt = _ROLE_SYSTEM_PROMPTS[role]
    if system_context:
        system_prompt = f"{system_prompt}\n\n{system_context}"

    def reason(state: ReasoningState) -> dict:
        # The system prompt is prepended only for this one LLM call, not written
        # back into state - `add_messages` appends rather than replaces, so
        # persisting it into `messages` here would duplicate it on every round.
        response = bound_llm.invoke([SystemMessage(content=system_prompt), *state["messages"]])
        return {"messages": [response]}

    graph = StateGraph(ReasoningState)
    graph.add_node("reason", reason)
    graph.set_entry_point("reason")
    graph.add_edge("reason", END)
    return graph.compile()


async def run_reasoning_step(
    role: AgentRole,
    history: list[BaseMessage],
    tools: list[dict],
    system_context: str | None = None,
    provider: str = "gemini",
    api_key: str | None = None,
) -> AIMessage:
    graph = build_reasoning_graph(role, tools, system_context, provider, api_key)
    result = await graph.ainvoke({"messages": history})
    return result["messages"][-1]


async def stream_reasoning_step(
    role: AgentRole,
    history: list[BaseMessage],
    system_context: str | None = None,
    provider: str = "gemini",
    api_key: str | None = None,
) -> AsyncIterator[str]:
    """Streams the model's real output tokens as they're generated - used only
    for tool-free, single-shot generation (the Synthesizer's final answer).
    Bypasses build_reasoning_graph/LangGraph on purpose: LangGraph's own
    streaming modes are built around graph state transitions, not raw token
    deltas, and this call never binds tools, so a plain `llm.astream(...)`
    is the direct, correct way to get real per-token output."""
    llm = get_chat_model(provider=provider, api_key=api_key)
    system_prompt = _ROLE_SYSTEM_PROMPTS[role]
    if system_context:
        system_prompt = f"{system_prompt}\n\n{system_context}"

    async for chunk in llm.astream([SystemMessage(content=system_prompt), *history]):
        # Some providers emit non-string content blocks (e.g. multimodal parts) -
        # only forward plain text deltas, matching what the client renders.
        if isinstance(chunk.content, str) and chunk.content:
            yield chunk.content
