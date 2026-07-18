import type { PlanStepPayload } from "../../ai/agents/agentClient.ts";
import { requireStringParam } from "./params.ts";

/** The "collect -> correlate -> analyze -> recommend" pipeline, expressed
 * as a plan for the *existing* task engine (task.consumer.ts) - each step
 * below is a real registered AiTool, not a new execution mechanism. All
 * three steps are deterministic-code-plus-one-bounded-LLM-call tools (see
 * correlateIncidentEvidence/analyzeRootCause/generateRecommendations.tool.ts)
 * rather than the generic free-text "agent" step type, since this pipeline
 * needs to persist structured, grounded data at every stage - not prose. */
export function buildIncidentAnalysisPlan(params: Record<string, unknown>): PlanStepPayload[] {
  const incidentId = requireStringParam(params, "incidentId");

  return [
    {
      id: "correlate_evidence",
      type: "tool",
      name: "correlate_incident_evidence",
      depends_on: [],
      parallel_group: null,
      input_template: { incident_id: incidentId },
    },
    {
      id: "analyze_root_cause",
      type: "tool",
      name: "analyze_root_cause",
      depends_on: ["correlate_evidence"],
      parallel_group: null,
      input_template: { incident_id: incidentId },
    },
    {
      id: "generate_recommendations",
      type: "tool",
      name: "generate_recommendations",
      depends_on: ["analyze_root_cause"],
      parallel_group: null,
      input_template: { incident_id: incidentId },
    },
  ];
}
