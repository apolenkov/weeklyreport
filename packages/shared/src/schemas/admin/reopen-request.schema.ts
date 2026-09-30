import { z } from "zod";

const DEFAULT_REOPEN_REQUEST_PAGE_LIMIT = 50;
const MAX_REOPEN_REQUEST_PAGE_LIMIT = 100;
const MAX_REOPEN_REQUEST_SEARCH_LENGTH = 500;

/** Why a lead cannot request a section reopen; the read model ships it to the UI. */
export type ReopenBlockedReason =
  | "not_submitted"
  | "period_archived"
  | "period_closed"
  | "pending_request_exists";

/** Filters supported by the admin reopen-request list endpoint. */
export const reopenRequestStatusFilterSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "all",
]);

/** Status filter accepted by the admin reopen-request list endpoint. */
export type ReopenRequestStatusFilter = z.infer<
  typeof reopenRequestStatusFilterSchema
>;

/** Stable compound position in the newest-first reopen-request history. */
export const reopenRequestCursorSchema = z
  .strictObject({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
  })
  .readonly();

/** Query contract for one scoped page of reopen requests. */
export const reopenRequestListInputSchema = z
  .strictObject({
    status: reopenRequestStatusFilterSchema.default("pending"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_REOPEN_REQUEST_PAGE_LIMIT)
      .default(DEFAULT_REOPEN_REQUEST_PAGE_LIMIT),
    cursor: reopenRequestCursorSchema.nullable().optional(),
    search: z.string().trim().max(MAX_REOPEN_REQUEST_SEARCH_LENGTH).optional(),
    // TanStack tRPC injects this transport field for every forward page.
    direction: z.literal("forward").optional(),
  })
  .prefault({});

/** Stable compound cursor used to continue reopen-request traversal. */
export type ReopenRequestCursor = z.infer<typeof reopenRequestCursorSchema>;

/** Normalized server query for one scoped page of reopen requests. */
export type ReopenRequestListInput = z.infer<
  typeof reopenRequestListInputSchema
>;
