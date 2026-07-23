import { z } from "zod";

import { safeText } from "./report-primitives.schema";

const MAX_ACTIVITY_NAME_LENGTH = 200;
const MAX_JIRA_ACCOUNT_LENGTH = 100;
const MAX_LINKED_PRODUCTS = 50;
const MAX_JIRA_ACCOUNTS = 20;

/**
 * A Project Activity — an admin-provisioned, stage-less reporting unit beside
 * Products. Carries the authoritative owning `groupId`, M:N label-only product
 * links, and plain-text Jira account references (no integration). `leads` lists
 * the attached lead ids (M:M — many leads report one activity).
 */
export const projectActivitySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(MAX_ACTIVITY_NAME_LENGTH),
  groupId: z.uuid(),
  // activity-first-class: M:N label-only product links (id + name), replacing the
  // former single nullable projectId. Reconciled by the admin CRUD from
  // `linkedProductIds`. Label-only — never feeds product health.
  linkedProducts: z
    .array(z.object({ productId: z.uuid(), productName: z.string().min(1) }))
    .default([]),
  jiraAccounts: z
    .array(z.string().min(1).max(MAX_JIRA_ACCOUNT_LENGTH))
    .default([]),
  archived: z.boolean(),
  leadIds: z.array(z.uuid()).default([]),
});

export const projectActivityCreateSchema = z.object({
  name: safeText({ max: 200 }),
  groupId: z.uuid(),
  // 0..N label-only product links. Reject an in-payload duplicate at the wire
  // boundary so it never reaches the ProjectActivityProduct
  // @@unique([activityId, productId]) constraint as a 500. The column is
  // case-sensitive text, so ids are lowercased here into the canonical form
  // every downstream comparison operates on.
  linkedProductIds: z
    .array(z.uuid())
    .max(MAX_LINKED_PRODUCTS)
    .refine(
      (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
      { message: "linkedProductIds must not contain duplicates" },
    )
    .transform((ids) => ids.map((id) => id.toLowerCase()))
    .default([]),
  jiraAccounts: z
    .array(safeText({ max: MAX_JIRA_ACCOUNT_LENGTH }))
    .max(MAX_JIRA_ACCOUNTS)
    .default([]),
});

export const projectActivityUpdateSchema = projectActivityCreateSchema.extend({
  id: z.uuid(),
});

export const projectActivityArchiveSchema = z.object({
  id: z.uuid(),
  archived: z.boolean(),
});

/** The (activity, lead) attachment edge for attach/detach mutations. */
export const projectActivityLeadEdgeSchema = z.object({
  activityId: z.uuid(),
  leadId: z.uuid(),
});

export type ProjectActivity = z.infer<typeof projectActivitySchema>;
export type ProjectActivityCreateInput = z.infer<
  typeof projectActivityCreateSchema
>;
export type ProjectActivityUpdateInput = z.infer<
  typeof projectActivityUpdateSchema
>;
export type ProjectActivityArchiveInput = z.infer<
  typeof projectActivityArchiveSchema
>;
export type ProjectActivityLeadEdge = z.infer<
  typeof projectActivityLeadEdgeSchema
>;
