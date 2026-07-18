from typing import TypedDict

from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

from app.agents.llm import get_chat_model


class Verdict(BaseModel):
    passed: bool = Field(description="Whether the output is factually grounded in the given evidence")
    confidence: int = Field(description="0-100 confidence in this verdict")
    issues: list[str] = Field(default_factory=list, description="Specific ungrounded or unsupported claims, if any")


class CriticState(TypedDict):
    output: str
    evidence: list[str]
    verdict: Verdict | None


_CRITIC_PROMPT = (
    "You are the Critic agent in a multi-agent code-intelligence system. Judge whether the OUTPUT below is "
    "factually grounded in the EVIDENCE below - every specific claim ABOUT THE REPOSITORY (scores, file names, "
    "counts, findings) must be traceable to something in the evidence. General framing/transitional language and "
    "ordinary general-knowledge statements unrelated to the repository (basic facts, definitions, arithmetic) "
    "don't need a citation and should not be flagged. Be strict about repository-specific claims: if the output "
    "states something about the repository that the evidence doesn't support, that's a failure.\n\n"
    "EVIDENCE:\n{evidence}\n\n"
    "OUTPUT:\n{output}"
)


def build_critic_graph(provider: str = "gemini", api_key: str | None = None):
    structured_llm = get_chat_model(temperature=0, provider=provider, api_key=api_key).with_structured_output(Verdict)

    def assess(state: CriticState) -> dict:
        evidence_text = "\n".join(f"- {e}" for e in state["evidence"]) or "(no evidence provided)"
        prompt = _CRITIC_PROMPT.format(evidence=evidence_text, output=state["output"])
        verdict = structured_llm.invoke(prompt)
        return {"verdict": verdict}

    graph = StateGraph(CriticState)
    graph.add_node("assess", assess)
    graph.set_entry_point("assess")
    graph.add_edge("assess", END)
    return graph.compile()


async def run_critic(output: str, evidence: list[str], provider: str = "gemini", api_key: str | None = None) -> Verdict:
    graph = build_critic_graph(provider, api_key)
    result = await graph.ainvoke({"output": output, "evidence": evidence, "verdict": None})
    return result["verdict"]
