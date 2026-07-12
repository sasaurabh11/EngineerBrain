import type { PlanStepPayload } from "../../ai/agents/agentClient.ts";

/** Code-defined plan (not Planner-generated) - deterministic and reusable
 * every time this workflow runs. */
export function buildOnboardingGuidePlan(): PlanStepPayload[] {
  return [
    {
      id: "get_repo_structure",
      type: "tool",
      name: "repository_structure",
      depends_on: [],
      parallel_group: "gather",
      input_template: {},
    },
    {
      id: "get_framework_detection",
      type: "tool",
      name: "framework_detection",
      depends_on: [],
      parallel_group: "gather",
      input_template: {},
    },
    {
      id: "search_existing_docs",
      type: "tool",
      name: "documentation_search",
      depends_on: [],
      parallel_group: "gather",
      input_template: { query: "setup installation getting started prerequisites" },
    },
    {
      id: "get_health_report",
      type: "tool",
      name: "health_report",
      depends_on: [],
      parallel_group: "gather",
      input_template: {},
    },
    {
      id: "generate_guide",
      type: "agent",
      name: "Generate a new-contributor onboarding guide",
      depends_on: ["get_repo_structure", "get_framework_detection", "search_existing_docs", "get_health_report"],
      parallel_group: null,
      input_template: {},
    },
    {
      id: "validate_guide",
      type: "validation",
      name: "Validate the onboarding guide is grounded in gathered data",
      depends_on: ["generate_guide"],
      parallel_group: null,
      input_template: {},
    },
  ];
}
