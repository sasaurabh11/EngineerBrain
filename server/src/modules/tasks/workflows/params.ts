import { BadRequestError } from "../../../common/errors/AppError.ts";

export function requireNumberParam(params: Record<string, unknown>, key: string): number {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BadRequestError(`This workflow requires a numeric "${key}" parameter`);
  }
  return value;
}
