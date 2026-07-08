import { z } from "zod";

export const createInvitationSchema = {
  body: z.object({
    email: z.string().trim().toLowerCase().email(),
    role: z.enum(["OWNER", "ADMIN", "MANAGER", "DEVELOPER", "QA", "VIEWER"]),
  }),
};
