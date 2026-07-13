import type { PlanStepPayload } from "../../ai/agents/agentClient.ts";
import { buildArchitectureReviewPlan } from "./architectureReview.workflow.ts";
import { buildIssueTriagePlan } from "./issueTriage.workflow.ts";
import { buildOnboardingGuidePlan } from "./onboardingGuide.workflow.ts";
import { buildPrReviewPlan } from "./prReview.workflow.ts";

export interface WorkflowParamDescriptor {
  key: string;
  label: string;
  type: "number" | "string";
  required: boolean;
}

export interface WorkflowDescriptor {
  key: string;
  name: string;
  description: string;
  params: WorkflowParamDescriptor[];
  buildPlan: (params: Record<string, unknown>) => PlanStepPayload[];
}

const WORKFLOWS: WorkflowDescriptor[] = [
  {
    key: "architecture-review",
    name: "Architecture Review",
    description: "Reviews a repository's architecture, dependencies, and health scores to summarize strengths and risks.",
    params: [],
    buildPlan: buildArchitectureReviewPlan,
  },
  {
    key: "onboarding-guide",
    name: "Onboarding Guide",
    description: "Generates a new-contributor onboarding guide from the repository's structure, frameworks, docs, and health.",
    params: [],
    buildPlan: buildOnboardingGuidePlan,
  },
  {
    key: "pr-review",
    name: "Pull Request Review",
    description:
      "Reviews an open pull request's diff, CI/CD status, and dependency changes (checked against OSV.dev), and produces a safe-to-merge verdict.",
    params: [{ key: "prNumber", label: "Pull request number", type: "number", required: true }],
    buildPlan: buildPrReviewPlan,
  },
  {
    key: "issue-triage",
    name: "Issue Triage",
    description: "Investigates a GitHub issue's likely root cause and affected code, and produces a triage summary.",
    params: [{ key: "issueNumber", label: "Issue number", type: "number", required: true }],
    buildPlan: buildIssueTriagePlan,
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
