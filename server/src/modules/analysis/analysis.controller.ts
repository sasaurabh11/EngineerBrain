import type { Request, Response } from "express";
import { NotFoundError } from "../../common/errors/AppError.ts";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { analysisService } from "./analysis.service.ts";
import { listFindingsQuerySchema, listHistoryQuerySchema, trendQuerySchema } from "./analysis.validation.ts";
import { generateJsonReport, generateMarkdownReport } from "./analysis.report.ts";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

export const analysisController = {
  async trigger(req: Request, res: Response) {
    await analysisService.enqueueAnalysis(getParam(req, "repositoryId"), "MANUAL", req.dbUser!.id);
    sendSuccess(res, { triggered: true }, 202);
  },

  async retry(req: Request, res: Response) {
    await analysisService.retryAnalysis(getParam(req, "repositoryId"), getParam(req, "analysisId"));
    sendSuccess(res, { retried: true }, 202);
  },

  async cancel(req: Request, res: Response) {
    await analysisService.cancelAnalysis(getParam(req, "repositoryId"), getParam(req, "analysisId"));
    sendSuccess(res, { cancelled: true });
  },

  async status(req: Request, res: Response) {
    const status = await analysisService.getLatestStatus(getParam(req, "repositoryId"));
    sendSuccess(res, status);
  },

  async latest(req: Request, res: Response) {
    const analysis = await analysisService.getLatestCompleted(getParam(req, "repositoryId"));
    if (!analysis) {
      throw new NotFoundError("No completed analysis found for this repository");
    }
    sendSuccess(res, analysis);
  },

  async findings(req: Request, res: Response) {
    const query = listFindingsQuerySchema.query.parse(req.query);
    const { items, pageInfo } = await analysisService.listFindings(getParam(req, "repositoryId"), query);
    sendSuccess(res, { items, pageInfo });
  },

  async history(req: Request, res: Response) {
    const query = listHistoryQuerySchema.query.parse(req.query);
    const { items, pageInfo } = await analysisService.listHistory(getParam(req, "repositoryId"), query);
    sendSuccess(res, { items, pageInfo });
  },

  async trend(req: Request, res: Response) {
    const query = trendQuerySchema.query.parse(req.query);
    const trend = await analysisService.getTrend(getParam(req, "repositoryId"), query.limit);
    sendSuccess(res, trend);
  },

  async reportJson(req: Request, res: Response) {
    const report = await generateJsonReport(getParam(req, "repositoryId"));
    res.setHeader("Content-Disposition", 'attachment; filename="analysis-report.json"');
    sendSuccess(res, report);
  },

  async reportMarkdown(req: Request, res: Response) {
    const markdown = await generateMarkdownReport(getParam(req, "repositoryId"));
    res.setHeader("Content-Type", "text/markdown");
    res.setHeader("Content-Disposition", 'attachment; filename="analysis-report.md"');
    res.send(markdown);
  },
};
