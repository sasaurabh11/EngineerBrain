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
          await tx.apiEndpoint.deleteMany({ where: { repositoryId, filePath: { in: touchedPaths } } });
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
          const unresolvedPaths = [
            ...new Set(
              result.graph_edges
                .map((e) => e.target_file_path)
                .filter((path): path is string => path !== null && !fileIdByPath.has(path)),
            ),
          ];

          const targetFileIdByPath = new Map<string, string>(fileIdByPath);
          if (unresolvedPaths.length > 0) {
            const existingFiles = await tx.repositoryFile.findMany({
              where: { repositoryId, path: { in: unresolvedPaths } },
              select: { id: true, path: true },
            });
            for (const file of existingFiles) {
              targetFileIdByPath.set(file.path, file.id);
            }
          }

          await tx.codeGraphEdge.createMany({
            data: result.graph_edges.map((e) => ({
              repositoryId,
              sourceSymbolId: e.source_symbol_id,
              targetSymbolId: e.target_symbol_id,
              targetPackageName: e.target_package_name,
              targetFileId: e.target_file_path ? (targetFileIdByPath.get(e.target_file_path) ?? null) : null,
              edgeType: e.edge_type as GraphEdgeType,
            })),
          });
        }

        if (result.api_endpoints.length > 0) {
          await tx.apiEndpoint.createMany({
            data: result.api_endpoints.map((e) => ({
              repositoryId,
              symbolId: e.symbol_id,
              filePath: e.file_path,
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

  findFilesByPaths(repositoryId: string, paths: string[]) {
    return prisma.repositoryFile.findMany({ where: { repositoryId, path: { in: paths } } });
  },

  findDependents(repositoryId: string, fileIds: string[]) {
    return prisma.codeGraphEdge.findMany({
      where: {
        repositoryId,
        OR: [{ targetFileId: { in: fileIds } }, { targetSymbol: { fileId: { in: fileIds } } }],
      },
      include: {
        sourceSymbol: { select: { name: true, kind: true, file: { select: { path: true } } } },
        targetSymbol: { select: { name: true, kind: true, file: { select: { path: true } } } },
        targetFile: { select: { path: true } },
      },
    });
  },

  listSymbolsByKind(repositoryId: string, kinds: string[]) {
    return prisma.codeSymbol.findMany({
      where: { repositoryId, kind: { in: kinds as SymbolKind[] } },
      include: { file: { select: { path: true } } },
      orderBy: { startLine: "asc" },
    });
  },

  findSymbolsByName(repositoryId: string, kinds: string[], name: string, take = 5) {
    return prisma.codeSymbol.findMany({
      where: { repositoryId, kind: { in: kinds as SymbolKind[] }, name: { contains: name, mode: "insensitive" } },
      include: { file: { select: { path: true } } },
      take,
    });
  },

  listGraphEdges(repositoryId: string) {
    return prisma.codeGraphEdge.findMany({ where: { repositoryId } });
  },

  listGraphEdgesWithNames(repositoryId: string) {
    return prisma.codeGraphEdge.findMany({
      where: { repositoryId },
      include: {
        sourceSymbol: { select: { name: true, kind: true } },
        targetSymbol: { select: { name: true, kind: true } },
      },
    });
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
