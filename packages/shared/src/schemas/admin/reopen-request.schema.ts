import { z } from "zod";

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
