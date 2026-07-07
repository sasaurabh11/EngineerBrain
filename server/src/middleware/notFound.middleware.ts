import type { Request, Response } from "express";
import { sendError } from "../common/response/formatResponse.ts";

export function notFoundHandler(req: Request, res: Response) {
  sendError(res, 404, `Route ${req.method} ${req.originalUrl} not found`, "ROUTE_NOT_FOUND");
}
