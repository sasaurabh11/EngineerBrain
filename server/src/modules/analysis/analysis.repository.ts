import type { AnalysisStatus, FindingCategory, FindingSeverity, Prisma, SyncTrigger } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";
import type { AiAnalysisResult, ListFindingsQuery, ListHistoryQuery } from "./analysis.types.ts";

// Findings only carry a severity-shaped priority ("CRITICAL".."INFO"), so
// sorting by it reuses the same ordering as severity - highest first when desc.
const _SEVERITY_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, INFO: 0 };

export const analysisRepository = {
  create(repositoryId: string, trigger: SyncTrigger, triggeredById: string | null, commitSha: string | null) {
    return prisma.repositoryAnalysis.create({
      data: { repositoryId, trigger, triggeredById, commitSha, status: "PENDING" },
    });
  },

  markRunning(id: string) {
    return prisma.repositoryAnalysis.update({ where: { id }, data: { status: "RUNNING" } });
  },

  markFailed(id: string, errorMessage: string) {
    return prisma.repositoryAnalysis.update({
      where: { id },
      data: { status: "FAILED", completedAt: new Date(), errorMessage },
    });
  },

  markRetryRequested(id: string) {
    return prisma.repositoryAnalysis.update({
      where: { id },
      data: { status: "PENDING", retryCount: { increment: 1 }, errorMessage: null, completedAt: null },
    });
  },

  markCancelled(id: string) {
    return prisma.repositoryAnalysis.update({
      where: { id },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
  },

  async complete(id: string, result: AiAnalysisResult): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.repositoryAnalysis.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          overallScore: result.overall_score,
          architectureScore: result.architecture_score,
          securityScore: result.security_score,
          performanceScore: result.performance_score,
          maintainabilityScore: result.maintainability_score,
          scalabilityScore: result.scalability_score,
          modularityScore: result.modularity_score,
          layeringScore: result.layering_score,
          documentationScore: result.documentation_score,
          complexityScore: result.complexity_score,
          technicalDebtScore: result.technical_debt_score,
          architectureSummary: result.architecture_summary,
        },
      });

      if (result.findings.length > 0) {
        await tx.finding.createMany({
          data: result.findings.map((f) => ({
            analysisId: id,
            category: f.category as FindingCategory,
            type: f.type,
            severity: f.severity as FindingSeverity,
            priority: (f.priority ?? null) as FindingSeverity | null,
            title: f.title,
            explanation: f.explanation,
            evidence: f.evidence,
            suggestedFix: f.suggested_fix,
            estimatedImpact: f.estimated_impact,
            confidence: f.confidence,
            filePath: f.file_path,
            startLine: f.start_line,
            endLine: f.end_line,
            relatedFiles: f.related_files,
            relatedClasses: f.related_classes,
            relatedFunctions: f.related_functions,
            metadata: f.metadata as Prisma.InputJsonValue,
          })),
        });
      }
    }, { timeout: 60_000 });
  },

  findLatestByRepository(repositoryId: string) {
    return prisma.repositoryAnalysis.findFirst({
      where: { repositoryId, status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
    });
  },

  findLatestAny(repositoryId: string) {
    return prisma.repositoryAnalysis.findFirst({
      where: { repositoryId },
      orderBy: { startedAt: "desc" },
    });
  },

  findById(id: string) {
    return prisma.repositoryAnalysis.findUnique({ where: { id } });
  },

  async listHistory(repositoryId: string, query: ListHistoryQuery) {
    const where = { repositoryId, status: "COMPLETED" as AnalysisStatus };
    const [items, totalCount] = await Promise.all([
      prisma.repositoryAnalysis.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.repositoryAnalysis.count({ where }),
    ]);
    return { items, totalCount };
  },

  async listFindings(analysisId: string, query: ListFindingsQuery) {
    const where = {
      analysisId,
      ...(query.category ? { category: query.category as FindingCategory } : {}),
      ...(query.severity ? { severity: query.severity as FindingSeverity } : {}),
      ...(query.priority ? { priority: query.priority as FindingSeverity } : {}),
    };

    // Prisma can't order by a semantic severity rank directly, only by the
    // enum's declaration order - so sort in-memory when the caller wants
    // "priority"/"severity" ranked by real severity meaning, not DB order.
    if (query.sortBy === "priority") {
      const all = await prisma.finding.findMany({ where });
      const rank = (f: (typeof all)[number]) => _SEVERITY_ORDER[f.priority ?? f.severity] ?? 0;
      all.sort((a, b) => (query.sortOrder === "asc" ? rank(a) - rank(b) : rank(b) - rank(a)));
      const totalCount = all.length;
      const items = all.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
      return { items, totalCount };
    }

    const orderBy = { [query.sortBy]: query.sortOrder } as Prisma.FindingOrderByWithRelationInput;
    const [items, totalCount] = await Promise.all([
      prisma.finding.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.finding.count({ where }),
    ]);
    return { items, totalCount };
  },

  findFindingById(id: string) {
    return prisma.finding.findUnique({ where: { id } });
  },

  /** Unpaginated - for internal callers (AI Gateway tools) that need the full
   * set to filter/rank in memory, as opposed to the paginated REST endpoint. */
  listAllFindings(analysisId: string, category?: FindingCategory) {
    return prisma.finding.findMany({
      where: { analysisId, ...(category ? { category } : {}) },
      orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
    });
  },

  countActiveStatuses(repositoryId: string): Promise<number> {
    return prisma.repositoryAnalysis.count({ where: { repositoryId, status: { in: ["PENDING", "RUNNING"] } } });
  },
};
