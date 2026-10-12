import { z } from "zod";

import { safeText } from "../primitives/report-primitives.schema.js";
import {
  linkedProductSchema,
  MAX_ACTIVITY_NAME_LENGTH,
} from "../report-sections/section.schema.js";

const MAX_JIRA_ACCOUNT_LENGTH = 100;
const MAX_LINKED_PRODUCTS = 50;
const MAX_JIRA_ACCOUNTS = 20;
// Ids are byte-compared TEXT generated lowercase; fold case once at the wire.
const canonicalUuid = z.uuid().toLowerCase();
const activityNameSchema = safeText({ max: MAX_ACTIVITY_NAME_LENGTH });
const jiraAccountSchema = safeText({ max: MAX_JIRA_ACCOUNT_LENGTH });

/** Describes a stage-less reporting activity and its display-only product links. */
export const projectActivitySchema = z
  .object({
    id: z.uuid(),
    name: activityNameSchema,
    groupId: z.uuid(),
    // M:N label-only product links from linkedProductIds — never feeds product health.
    // Same record the section read model carries, so the two halves can't drift.
    linkedProducts: z.array(linkedProductSchema).readonly().default([]),
    jiraAccounts: z.array(jiraAccountSchema).readonly().default([]),
    archived: z.boolean(),
    leadIds: z.array(z.uuid()).readonly().default([]),
  })
  .readonly();

const projectActivityCreateObjectSchema = z.object({
  name: activityNameSchema,
  groupId: canonicalUuid,
  // Reject duplicates at the wire after case folding.
  linkedProductIds: z
    .array(canonicalUuid)
    .max(MAX_LINKED_PRODUCTS)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "linkedProductIds must not contain duplicates",
    })
    .readonly()
    .default([]),
  jiraAccounts: z
    .array(jiraAccountSchema)
    .max(MAX_JIRA_ACCOUNTS)
    .readonly()
    .default([]),
});

/** Accepts the editable fields used to create a reporting activity. */
export const projectActivityCreateSchema =
  projectActivityCreateObjectSchema.readonly();

/** Accepts a reporting-activity update identified by activity id. */
export const projectActivityUpdateSchema = projectActivityCreateObjectSchema
  .extend({ id: canonicalUuid })
  .readonly();

/** Accepts an archive-state change for one reporting activity. */
export const projectActivityArchiveSchema = z
  .object({
    id: canonicalUuid,
    archived: z.boolean(),
  })
  .readonly();

/** The (activity, lead) attachment edge for attach/detach mutations. */
export const projectActivityLeadEdgeSchema = z
  .object({
    activityId: canonicalUuid,
    leadId: canonicalUuid,
  })
  .readonly();

/** Stage-less reporting unit attached to leads and optionally labelled by products. */
export type ProjectActivity = z.infer<typeof projectActivitySchema>;
/** Create command with editable activity fields and readonly product/lead links. */
export type ProjectActivityCreateInput = z.infer<
  typeof projectActivityCreateSchema
>;
/** Update command keyed by activity id; name and groupId are supplied, while omitted editable arrays default to empty. */
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
