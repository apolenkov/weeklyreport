import { z } from "zod";

import { roleSchema } from "../auth/auth";

/** Fixed tRPC classifications that may cross the durable audit boundary. */
export const actionLogFailureReasonSchema = z.enum([
  "PARSE_ERROR",
  "BAD_REQUEST",
  "INTERNAL_SERVER_ERROR",
  "NOT_IMPLEMENTED",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
  "UNAUTHORIZED",
  "PAYMENT_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_SUPPORTED",
  "TIMEOUT",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "UNPROCESSABLE_CONTENT",
  "PRECONDITION_REQUIRED",
  "TOO_MANY_REQUESTS",
  "CLIENT_CLOSED_REQUEST",
]);

const actionLogEventShape = {
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  userId: z.string().min(1),
  role: roleSchema.nullable(),
  procedure: z.string().min(1),
  targetId: z.string().min(1).nullable(),
  ip: z.string().min(1).nullable(),
  correlationId: z.string().min(1),
  durationMs: z.number().int().min(0),
} as const;

const successfulActionLogEventSchema = z.strictObject({
  ...actionLogEventShape,
  status: z.literal("success"),
  reason: z.null(),
});

const failedActionLogEventSchema = z.strictObject({
  ...actionLogEventShape,
  status: z.literal("fail"),
  reason: actionLogFailureReasonSchema,
});

/** Exact admin-visible action-log projection; no raw payload fields are admitted. */
export const adminActionLogEventSchema = z
  .discriminatedUnion("status", [
    successfulActionLogEventSchema,
    failedActionLogEventSchema,
  ])
  .readonly();

/** Strict cursor page returned by the admin Action Log procedure. */
export const adminActionLogPageSchema = z
  .strictObject({
    items: z.array(adminActionLogEventSchema).readonly(),
    nextCursor: z.string().min(1).nullable(),
  })
  .readonly();

/** Immutable allowlisted audit event exposed only to administrators. */
export type AdminActionLogEvent = z.infer<typeof adminActionLogEventSchema>;
/** Immutable cursor page of administrator-visible audit events. */
export type AdminActionLogPage = z.infer<typeof adminActionLogPageSchema>;
