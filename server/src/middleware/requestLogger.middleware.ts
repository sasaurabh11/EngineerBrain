import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger.ts";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = performance.now();

  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
}
