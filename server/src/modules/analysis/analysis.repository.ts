import type { AnalysisStatus, FindingCategory, FindingSeverity, Prisma, SyncTrigger } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";
import type { AiAnalysisResult } from "./analysis.types.ts";

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
        },
      });

      if (result.findings.length > 0) {
        await tx.finding.createMany({
          data: result.findings.map((f) => ({
            analysisId: id,
            category: f.category as FindingCategory,
            type: f.type,
            severity: f.severity as FindingSeverity,
            title: f.title,
            explanation: f.explanation,
            suggestedFix: f.suggested_fix,
            confidence: f.confidence,
            filePath: f.file_path,
            startLine: f.start_line,
            endLine: f.end_line,
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

  listHistory(repositoryId: string, limit: number) {
    return prisma.repositoryAnalysis.findMany({
      where: { repositoryId, status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  },

  listFindings(analysisId: string, category?: FindingCategory, severity?: FindingSeverity) {
    return prisma.finding.findMany({
      where: { analysisId, ...(category ? { category } : {}), ...(severity ? { severity } : {}) },
      orderBy: [{ severity: "desc" }, { createdAt: "asc" }],
    });
  },

  findFindingById(id: string) {
    return prisma.finding.findUnique({ where: { id } });
  },

  countActiveStatuses(repositoryId: string): Promise<number> {
    return prisma.repositoryAnalysis.count({ where: { repositoryId, status: { in: ["PENDING", "RUNNING"] } } });
  },
};
