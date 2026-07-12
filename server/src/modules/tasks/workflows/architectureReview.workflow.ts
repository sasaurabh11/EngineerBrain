import type { PlanStepPayload } from "../../ai/agents/agentClient.ts";

/** Code-defined plan (not Planner-generated) - deterministic and reusable
 * every time this workflow runs, matching the fixed steps a senior engineer
 * would always take to review a repository's architecture. */
export function buildArchitectureReviewPlan(): PlanStepPayload[] {
  return [
    {
      id: "get_health_report",
      type: "tool",
      name: "health_report",
      depends_on: [],
      parallel_group: "gather",
      input_template: {},
    },
    {
      id: "get_dependency_graph",
      type: "tool",
      name: "dependency_graph",
      depends_on: [],
      parallel_group: "gather",
      input_template: {},
    },
    {
      id: "get_repo_structure",
      type: "tool",
      name: "repository_structure",
      depends_on: [],
      parallel_group: "gather",
      input_template: {},
    },
    {
      id: "analyze_architecture",
      type: "agent",
      name: "Analyze architecture strengths, risks, and coupling",
      depends_on: ["get_health_report", "get_dependency_graph", "get_repo_structure"],
      parallel_group: null,
      input_template: {},
    },
    {
      id: "validate_review",
      type: "validation",
      name: "Validate the architecture review is grounded in gathered data",
      depends_on: ["analyze_architecture"],
      parallel_group: null,
      input_template: {},
    },
  ];
}
