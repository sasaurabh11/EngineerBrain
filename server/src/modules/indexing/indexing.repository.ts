import { randomUUID } from "node:crypto";
import type { ChunkKind, GraphEdgeType, IndexStatus, SymbolKind, SyncTrigger } from "@prisma/client";
import { prisma } from "../../database/prisma.ts";
import type { AiIndexResult } from "./indexing.types.ts";

export const indexingRepository = {
  getOrCreateIndex(repositoryId: string) {
    return prisma.repositoryIndex.upsert({
      where: { repositoryId },
      create: { repositoryId, status: "PENDING" },
      update: {},
    });
  },

  getIndex(repositoryId: string) {
    return prisma.repositoryIndex.findUnique({ where: { repositoryId } });
  },

  updateIndexStatus(
    repositoryId: string,
    status: IndexStatus,
    extra?: { lastIndexedCommitSha?: string; detectedFrameworks?: string[] },
  ) {
    return prisma.repositoryIndex.update({
      where: { repositoryId },
      data: {
        status,
        ...(status === "INDEXED" ? { lastIndexedAt: new Date() } : {}),
        ...(extra?.lastIndexedCommitSha ? { lastIndexedCommitSha: extra.lastIndexedCommitSha } : {}),
        ...(extra?.detectedFrameworks ? { detectedFrameworks: extra.detectedFrameworks } : {}),
      },
    });
  },

  createJob(repositoryId: string, trigger: SyncTrigger, triggeredById: string | null) {
    return prisma.indexingJob.create({
      data: { repositoryId, trigger, triggeredById, status: "PENDING" },
    });
  },

  markJobRunning(id: string) {
    return prisma.indexingJob.update({ where: { id }, data: { status: "RUNNING" } });
  },

  markJobSuccess(id: string, filesProcessed: number) {
    return prisma.indexingJob.update({
      where: { id },
      data: { status: "SUCCESS", completedAt: new Date(), filesProcessed },
    });
  },

  markJobFailed(id: string, errorMessage: string) {
    return prisma.indexingJob.update({
      where: { id },
      data: { status: "FAILED", completedAt: new Date(), errorMessage },
    });
  },

  listPreviousFiles(repositoryId: string) {
    return prisma.repositoryFile.findMany({
      where: { repositoryId },
      select: { path: true, contentHash: true },
    });
  },

  async persistIndexResult(repositoryId: string, result: AiIndexResult): Promise<void> {
    await prisma.$transaction(
      async (tx) => {
        const touchedPaths = [...result.changed_files.map((f) => f.path), ...result.deleted_file_paths];

        if (touchedPaths.length > 0) {
          await tx.repositoryFile.deleteMany({ where: { repositoryId, path: { in: touchedPaths } } });
        }

        if (result.changed_files.length === 0) {
          return;
        }

        const fileIdByPath = new Map(result.changed_files.map((file) => [file.path, randomUUID()]));

        await tx.repositoryFile.createMany({
          data: result.changed_files.map((file) => ({
            id: fileIdByPath.get(file.path)!,
            repositoryId,
            path: file.path,
            language: file.language,
            sizeBytes: file.size_bytes,
            linesOfCode: file.lines_of_code,
            contentHash: file.content_hash,
          })),
        });

        const rootSymbols = result.symbols.filter((s) => s.parent_id === null);
        const childSymbols = result.symbols.filter((s) => s.parent_id !== null);

        if (rootSymbols.length > 0) {
          await tx.codeSymbol.createMany({
            data: rootSymbols.map((s) => ({
              id: s.id,
              repositoryId,
              fileId: fileIdByPath.get(s.file_path)!,
              parentSymbolId: null,
              kind: s.kind as SymbolKind,
              name: s.name,
              startLine: s.start_line,
              endLine: s.end_line,
              signature: s.signature,
              docComment: s.doc_comment,
              metadata: s.metadata as never,
            })),
          });
        }

        if (childSymbols.length > 0) {
          await tx.codeSymbol.createMany({
            data: childSymbols.map((s) => ({
              id: s.id,
              repositoryId,
              fileId: fileIdByPath.get(s.file_path)!,
              parentSymbolId: s.parent_id,
              kind: s.kind as SymbolKind,
              name: s.name,
              startLine: s.start_line,
              endLine: s.end_line,
              signature: s.signature,
              docComment: s.doc_comment,
              metadata: s.metadata as never,
            })),
          });
        }

        if (result.chunks.length > 0) {
          await tx.chunk.createMany({
            data: result.chunks.map((c) => ({
              id: c.id,
              repositoryId,
              fileId: fileIdByPath.get(c.file_path)!,
              symbolId: c.symbol_id,
              kind: c.kind as ChunkKind,
              content: c.content,
              tokenCount: c.token_count,
              startLine: c.start_line,
              endLine: c.end_line,
              embeddingStatus: c.embedded ? "EMBEDDED" : "PENDING",
            })),
          });
        }

        if (result.graph_edges.length > 0) {
          await tx.codeGraphEdge.createMany({
            data: result.graph_edges.map((e) => ({
              repositoryId,
              sourceSymbolId: e.source_symbol_id,
              targetSymbolId: e.target_symbol_id,
              targetPackageName: e.target_package_name,
              edgeType: e.edge_type as GraphEdgeType,
            })),
          });
        }

        if (result.api_endpoints.length > 0) {
          await tx.apiEndpoint.createMany({
            data: result.api_endpoints.map((e) => ({
              repositoryId,
              symbolId: e.symbol_id,
              method: e.method,
              path: e.path,
              framework: e.framework,
            })),
          });
        }
      },
      { timeout: 60_000 },
    );
  },

  listFiles(repositoryId: string) {
    return prisma.repositoryFile.findMany({ where: { repositoryId }, orderBy: { path: "asc" } });
  },

  listSymbolsByKind(repositoryId: string, kinds: string[]) {
    return prisma.codeSymbol.findMany({
      where: { repositoryId, kind: { in: kinds as SymbolKind[] } },
      include: { file: { select: { path: true } } },
      orderBy: { startLine: "asc" },
    });
  },

  listGraphEdges(repositoryId: string) {
    return prisma.codeGraphEdge.findMany({ where: { repositoryId } });
  },

  listApiEndpoints(repositoryId: string) {
    return prisma.apiEndpoint.findMany({ where: { repositoryId } });
  },

  countAggregates(repositoryId: string) {
    return Promise.all([
      prisma.repositoryFile.count({ where: { repositoryId } }),
      prisma.codeSymbol.count({ where: { repositoryId } }),
      prisma.chunk.count({ where: { repositoryId } }),
    ]);
  },
};
