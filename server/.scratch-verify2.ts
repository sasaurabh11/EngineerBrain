import { taskService } from "./src/modules/tasks/task.service.ts";
import { prisma } from "./src/database/prisma.ts";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const repo = await prisma.repository.findFirst({ where: { fullName: "sasaurabh11/Nova-Agent" } });
  if (!repo) throw new Error("repo not found");
  console.log("repo:", repo.id, repo.organizationId);

  const owner = await prisma.organizationMember.findFirst({ where: { organizationId: repo.organizationId, role: "OWNER" } });
  if (!owner) throw new Error("owner not found");

  console.log("\n=== 1. Trigger issue-triage on real open issue #1 ===");
  let task = await taskService.enqueueTask(repo.organizationId, owner.userId, "Verification: triage issue #1", repo.id, "issue-triage", {
    issueNumber: 1,
  });
  console.log("task id:", task.id, "status:", task.status);

  const deadline = Date.now() + 120_000;
  while (!["COMPLETED", "FAILED"].includes(task.status) && Date.now() < deadline) {
    await sleep(3000);
    task = await taskService.getTask(repo.organizationId, task.id);
    console.log("  ...", task.status, task.progress + "%");
  }

  console.log("\n=== Final task status:", task.status, "===");
  if (task.resultSummary) {
    console.log(task.resultSummary);
    console.log("\nContains a code block:", task.resultSummary.includes("```"));
  }
  if (task.errorMessage) console.log("ERROR:", task.errorMessage);

  console.log("\n=== 2. Extended GET /tasks filters - should find exactly this task ===");
  const filtered = await taskService.listTasks(repo.organizationId, {
    repositoryId: repo.id,
    workflowKey: "issue-triage",
    issueNumber: 1,
    page: 1,
    pageSize: 5,
  });
  console.log("matching tasks:", filtered.items.length, filtered.items.map((t) => t.id));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
