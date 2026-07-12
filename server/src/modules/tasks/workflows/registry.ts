import type { PlanStepPayload } from "../../ai/agents/agentClient.ts";
import { buildArchitectureReviewPlan } from "./architectureReview.workflow.ts";
import { buildOnboardingGuidePlan } from "./onboardingGuide.workflow.ts";

export interface WorkflowDescriptor {
  key: string;
  name: string;
  description: string;
  buildPlan: () => PlanStepPayload[];
}

const WORKFLOWS: WorkflowDescriptor[] = [
  {
    key: "architecture-review",
    name: "Architecture Review",
    description: "Reviews a repository's architecture, dependencies, and health scores to summarize strengths and risks.",
    buildPlan: buildArchitectureReviewPlan,
  },
  {
    key: "onboarding-guide",
    name: "Onboarding Guide",
    description: "Generates a new-contributor onboarding guide from the repository's structure, frameworks, docs, and health.",
    buildPlan: buildOnboardingGuidePlan,
  },
];

const workflowsByKey = new Map(WORKFLOWS.map((w) => [w.key, w]));

export const workflowRegistry = {
  all(): WorkflowDescriptor[] {
    return WORKFLOWS;
  },
  get(key: string): WorkflowDescriptor | undefined {
    return workflowsByKey.get(key);
  },
};
