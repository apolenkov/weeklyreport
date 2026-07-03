import { z } from "zod";

import { safeText } from "./report-primitives.schema";

/**
 * A Project Activity — an admin-provisioned, stage-less reporting unit beside
 * Products. Carries the authoritative owning `groupId`, M:N label-only product
 * links, and plain-text Jira account references (no integration). `leads` lists
 * the attached lead ids (M:M — many leads report one activity).
 */
export const projectActivitySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(200),
  groupId: z.uuid(),
  // activity-first-class: M:N label-only product links (id + name), replacing the
  // former single nullable projectId. Reconciled by the admin CRUD from
  // `linkedProductIds`. Label-only — never feeds product health.
  linkedProducts: z
    .array(z.object({ productId: z.uuid(), productName: z.string().min(1) }))
    .default([]),
  jiraAccounts: z.array(z.string().min(1).max(100)).default([]),
  archived: z.boolean(),
  leadIds: z.array(z.uuid()).default([]),
});

export const projectActivityCreateSchema = z.object({
  name: safeText({ max: 200 }),
  groupId: z.uuid(),
  // activity-first-class: 0..N product links (was a single nullable projectId).
  linkedProductIds: z.array(z.uuid()).max(50).default([]),
  jiraAccounts: z
    .array(safeText({ max: 100 }))
    .max(20)
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
