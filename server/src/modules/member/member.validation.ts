import { z } from "zod";

export const updateMemberRoleSchema = {
  body: z.object({
    role: z.enum(["OWNER", "ADMIN", "MANAGER", "DEVELOPER", "QA", "VIEWER"]),
  }),
};
