import { z } from 'zod';

export const roleSchema = z.enum(['lead', 'head', 'viewer']);

export const userSessionSchema = z.object({
  userId: z.string().uuid(),
  email: z.email(),
  name: z.string().min(1),
  role: roleSchema,
  activeReportId: z.string().uuid().nullable().optional(),
  activeReportSectionId: z.string().uuid().nullable().optional(),
});

export type Role = z.infer<typeof roleSchema>;
export type UserSession = z.infer<typeof userSessionSchema>;
