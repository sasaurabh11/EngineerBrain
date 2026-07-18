import json
from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

from app.agents.llm import get_chat_model
from app.agents.schemas import PlanStepPayload, ToolSpec

_MAX_REVISIONS = 1


class PlanDraft(BaseModel):
    steps: list[PlanStepPayload] = Field(description="Ordered/parallelizable steps forming a DAG")
    reasoning: str = Field(description="Brief explanation of why this plan achieves the goal")


class PlanCritique(BaseModel):
    has_issues: bool = Field(description="True if the plan has a real gap, unreachable step, or misuses a tool")
    feedback: str = Field(description="Specific, actionable feedback if has_issues is true")


class PlannerState(TypedDict):
    goal: str
    repository_context: str
    tools_manifest: str
    draft: PlanDraft | None
    critique: PlanCritique | None
    revision_count: int
    final: PlanDraft | None


_DRAFT_PROMPT = (
    "You are the Planner agent in a multi-agent autonomous engineering system. Decompose the GOAL below into a "
    "directed graph of steps. Each step must be one of:\n"
    "- \"tool\": a direct call to one of the AVAILABLE TOOLS listed below (use its exact name)\n"
    "- \"agent\": a step that needs LLM reasoning over gathered context (no tool call itself)\n"
    "- \"decision\": a branch point whose output determines which dependent steps actually run\n"
    "- \"validation\": a final grounding check on the produced result\n\n"
    "Each step needs a unique id, its type, a name, the ids of steps it depends_on (empty if it can run first), "
    "an optional parallel_group id shared by steps that can run concurrently, and for \"tool\" steps an "
    "input_template object with concrete argument values matching that tool's parameters schema exactly (omit "
    "arguments you don't have a concrete value for - the executor will fill in repository/organization context "
    "automatically). End with exactly one "
    "\"validation\" step depending on the final output-producing step(s).\n\n"
    "GOAL:\n{goal}\n\n"
    "REPOSITORY CONTEXT:\n{repository_context}\n\n"
    "AVAILABLE TOOLS:\n{tools_manifest}"
)

_CRITIQUE_PROMPT = (
    "Review this plan for the GOAL below. Look specifically for: a step referencing a tool not in the available "
    "list, a step with a dependency that doesn't exist, a missing validation step, or a goal requirement the "
    "plan doesn't actually address. Don't flag stylistic preferences - only real defects.\n\n"
    "GOAL:\n{goal}\n\n"
    "AVAILABLE TOOLS:\n{tools_manifest}\n\n"
    "PLAN:\n{plan}"
)

_REFINE_PROMPT = (
    "Revise this plan to address the feedback below. Keep everything that already works; only change what the "
    "feedback identifies as a problem.\n\n"
    "GOAL:\n{goal}\n\n"
    "AVAILABLE TOOLS:\n{tools_manifest}\n\n"
    "PREVIOUS PLAN:\n{plan}\n\n"
    "FEEDBACK:\n{feedback}"
)


def _format_tools(tools: list[ToolSpec]) -> str:
    return (
        "\n".join(f"- {t.name}: {t.description}\n  parameters: {json.dumps(t.parameters)}" for t in tools)
        or "(no tools available)"
    )


def build_planner_graph(provider: str = "gemini", api_key: str | None = None):
    draft_llm = get_chat_model(provider=provider, api_key=api_key).with_structured_output(PlanDraft)
    critique_llm = get_chat_model(temperature=0, provider=provider, api_key=api_key).with_structured_output(PlanCritique)

    def draft(state: PlannerState) -> dict:
        prompt = _DRAFT_PROMPT.format(
            goal=state["goal"], repository_context=state["repository_context"], tools_manifest=state["tools_manifest"]
        )
        return {"draft": draft_llm.invoke(prompt), "revision_count": 0}

    def critique(state: PlannerState) -> dict:
        prompt = _CRITIQUE_PROMPT.format(
            goal=state["goal"], tools_manifest=state["tools_manifest"], plan=state["draft"].model_dump_json()
        )
        return {"critique": critique_llm.invoke(prompt)}

    def refine(state: PlannerState) -> dict:
        prompt = _REFINE_PROMPT.format(
            goal=state["goal"],
            tools_manifest=state["tools_manifest"],
            plan=state["draft"].model_dump_json(),
            feedback=state["critique"].feedback,
        )
        return {"draft": draft_llm.invoke(prompt), "revision_count": state["revision_count"] + 1}

    def finalize(state: PlannerState) -> dict:
        return {"final": state["draft"]}

    def route_after_critique(state: PlannerState) -> Literal["refine", "finalize"]:
        if state["critique"].has_issues and state["revision_count"] < _MAX_REVISIONS:
            return "refine"
        return "finalize"

    graph = StateGraph(PlannerState)
    graph.add_node("draft", draft)
    graph.add_node("critique", critique)
    graph.add_node("refine", refine)
    graph.add_node("finalize", finalize)
    graph.set_entry_point("draft")
    graph.add_edge("draft", "critique")
    graph.add_conditional_edges("critique", route_after_critique, {"refine": "refine", "finalize": "finalize"})
    graph.add_edge("refine", "finalize")
    graph.add_edge("finalize", END)
    return graph.compile()


async def run_planner(
    goal: str,
    repository_context: str | None,
    available_tools: list[ToolSpec],
    provider: str = "gemini",
    api_key: str | None = None,
) -> tuple[PlanDraft, bool]:
    graph = build_planner_graph(provider, api_key)
    result = await graph.ainvoke(
        {
            "goal": goal,
            "repository_context": repository_context or "(none provided)",
            "tools_manifest": _format_tools(available_tools),
            "draft": None,
            "critique": None,
            "revision_count": 0,
            "final": None,
        }
    )
    return result["final"], result["revision_count"] > 0
