import { z } from "zod";

import { safeText } from "../primitives/report-primitives.schema";
import { linkedProductSchema } from "../report-sections/section.schema";

const MAX_ACTIVITY_NAME_LENGTH = 200;
const MAX_JIRA_ACCOUNT_LENGTH = 100;
const MAX_LINKED_PRODUCTS = 50;
const MAX_JIRA_ACCOUNTS = 20;

/** Describes a stage-less reporting activity and its display-only product links. */
export const projectActivitySchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(MAX_ACTIVITY_NAME_LENGTH),
    groupId: z.uuid(),
    // M:N label-only product links from linkedProductIds — never feeds product health.
    // Same record the section read model carries, so the two halves can't drift.
    linkedProducts: z.array(linkedProductSchema).readonly().default([]),
    jiraAccounts: z
      .array(z.string().min(1).max(MAX_JIRA_ACCOUNT_LENGTH))
      .readonly()
      .default([]),
    archived: z.boolean(),
    leadIds: z.array(z.uuid()).readonly().default([]),
  })
  .readonly();

const projectActivityCreateObjectSchema = z.object({
  name: safeText({ max: MAX_ACTIVITY_NAME_LENGTH }),
  groupId: z.uuid(),
  // Reject duplicates at the wire; lowercase for case-sensitive @@unique comparisons.
  linkedProductIds: z
    .array(z.uuid())
    .max(MAX_LINKED_PRODUCTS)
    .refine(
      (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
      { message: "linkedProductIds must not contain duplicates" },
    )
    .transform((ids) => ids.map((id) => id.toLowerCase()))
    .readonly()
    .default([]),
  jiraAccounts: z
    .array(safeText({ max: MAX_JIRA_ACCOUNT_LENGTH }))
    .max(MAX_JIRA_ACCOUNTS)
    .readonly()
    .default([]),
});

/** Accepts the editable fields used to create a reporting activity. */
export const projectActivityCreateSchema =
  projectActivityCreateObjectSchema.readonly();

/** Accepts a reporting-activity update identified by activity id. */
export const projectActivityUpdateSchema = projectActivityCreateObjectSchema
  .extend({ id: z.uuid() })
  .readonly();

/** Accepts an archive-state change for one reporting activity. */
export const projectActivityArchiveSchema = z
  .object({
    id: z.uuid(),
    archived: z.boolean(),
  })
  .readonly();

/** The (activity, lead) attachment edge for attach/detach mutations. */
export const projectActivityLeadEdgeSchema = z
  .object({
    activityId: z.uuid(),
    leadId: z.uuid(),
  })
  .readonly();

/** Stage-less reporting unit attached to leads and optionally labelled by products. */
export type ProjectActivity = z.infer<typeof projectActivitySchema>;
/** Create command with editable activity fields and readonly product/lead links. */
export type ProjectActivityCreateInput = z.infer<
  typeof projectActivityCreateSchema
>;
/** Update command keyed by activity id; omitted editable fields remain unchanged. */
export type ProjectActivityUpdateInput = z.infer<
  typeof projectActivityUpdateSchema
>;
/** Archive command pairing one activity id with its target archive state. */
export type ProjectActivityArchiveInput = z.infer<
  typeof projectActivityArchiveSchema
>;
/** Immutable activity-to-lead attachment identity. */
export type ProjectActivityLeadEdge = z.infer<
  typeof projectActivityLeadEdgeSchema
>;
