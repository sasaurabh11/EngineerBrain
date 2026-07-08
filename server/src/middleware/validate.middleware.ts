import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      // Express 5's req.query is a getter with no setter, so we validate for
      // correctness but can't write the parsed/transformed result back to it.
      if (schemas.query) schemas.query.parse(req.query);
      next();
    } catch (err) {
      next(err);
    }
  };
}
