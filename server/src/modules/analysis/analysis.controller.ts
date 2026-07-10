import type { FindingCategory, FindingSeverity } from "@prisma/client";
import type { Request, Response } from "express";
import { NotFoundError } from "../../common/errors/AppError.ts";
import { sendSuccess } from "../../common/response/formatResponse.ts";
import { analysisService } from "./analysis.service.ts";

function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

export const analysisController = {
  async trigger(req: Request, res: Response) {
    await analysisService.enqueueAnalysis(getParam(req, "repositoryId"), "MANUAL", req.dbUser!.id);
    sendSuccess(res, { triggered: true }, 202);
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
    const category = req.query.category as FindingCategory | undefined;
    const severity = req.query.severity as FindingSeverity | undefined;
    const findings = await analysisService.listFindings(getParam(req, "repositoryId"), category, severity);
    sendSuccess(res, findings);
  },

  async history(req: Request, res: Response) {
    const history = await analysisService.listHistory(getParam(req, "repositoryId"));
    sendSuccess(res, history);
  },
};
