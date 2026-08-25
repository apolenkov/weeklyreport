import { z } from "zod";

import { roleSchema } from "../auth/auth";
import {
  reportSectionStatusSchema,
  trafficLightStatusSchema,
} from "../primitives/report-primitives.schema";
import { sectionReviewViewSchema } from "../review/review.schema";
import {
  activityStatusInputSchema,
  decisionReadModelSchema,
  decisionWriteSchema,
  itemReadModelSchema,
  itemWriteSchema,
  linkedProductSchema,
  projectStatusInputSchema,
  riskReadModelSchema,
  riskWriteSchema,
  sectionActivitySchema,
  stageStatusInputSchema,
} from "./section-record.schema";

export {
  activityStatusInputSchema,
  decisionInputSchema,
  decisionReadModelSchema,
  decisionWriteSchema,
  itemInputSchema,
  itemReadModelSchema,
  itemWriteSchema,
  linkedProductSchema,
  projectStatusInputSchema,
  riskInputSchema,
  riskReadModelSchema,
  riskWriteSchema,
  sectionActivitySchema,
  stageStatusInputSchema,
} from "./section-record.schema";

// Payload guard against pathological section-save array sizes.
const MAX_RECORDS_PER_SECTION_SAVE = 100;

const draftSaveObjectSchema = z.object({
  reportSectionId: z.uuid(),
  // Optimistic-concurrency expected version: the row revision the client
  // loaded. The repository compare-and-sets on it and 409s a stale write.
  version: z.number().int().min(1),
  status: z.literal("draft").default("draft"),
  projectStatuses: z
    .array(projectStatusInputSchema)
    .max(MAX_RECORDS_PER_SECTION_SAVE)
    .readonly(),
  stageStatuses: z
    .array(stageStatusInputSchema)
    .max(MAX_RECORDS_PER_SECTION_SAVE)
    .readonly()
    .default([]),
  // Activity-status slice beside projectStatuses.
  activityStatuses: z
    .array(activityStatusInputSchema)
    .max(MAX_RECORDS_PER_SECTION_SAVE)
    .readonly()
    .default([]),
  items: z.array(itemWriteSchema).max(MAX_RECORDS_PER_SECTION_SAVE).readonly(),
  risks: z.array(riskWriteSchema).max(MAX_RECORDS_PER_SECTION_SAVE).readonly(),
  decisions: z
    .array(decisionWriteSchema)
    .max(MAX_RECORDS_PER_SECTION_SAVE)
    .readonly(),
});

/** Accepts the complete editable state persisted by a section draft save. */
export const draftSaveSchema = draftSaveObjectSchema.readonly();

/** Accepts a complete section submission with required status confirmations. */
export const submitSectionSchema = draftSaveObjectSchema
  .extend({
    confirmed: z.literal(true),
    // May be empty for activity-only sections; omitted activities need server-side checks.
    projectStatuses: z
      .array(
        projectStatusInputSchema.unwrap().extend({
          status: trafficLightStatusSchema,
        }),
      )
      .max(MAX_RECORDS_PER_SECTION_SAVE)
      .readonly(),
    activityStatuses: z
      .array(
        activityStatusInputSchema.unwrap().extend({
          status: trafficLightStatusSchema,
        }),
      )
      .max(MAX_RECORDS_PER_SECTION_SAVE)
      .readonly()
      .default([]),
  })
  .readonly();

// Display-only stage grid metadata; saveSection writes status only from ownedStages.
const stageSetEntryObjectSchema = z.object({
  stageId: z.uuid(),
  stageName: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

/** Describes one stage displayed in a product's read-only stage grid. */
export const stageSetEntrySchema = stageSetEntryObjectSchema.readonly();

// Author's StageAssignment rows for this product; empty means no stake.
/** Describes a stage assigned to the section author for one product. */
export const ownedStageSchema = stageSetEntryObjectSchema
  .extend({
    status: trafficLightStatusSchema.nullable().optional(),
  })
  .readonly();

const projectReadModelObjectSchema = z.object({
  projectId: z.uuid(),
  projectName: z.string().min(1),
  trafficLight: trafficLightStatusSchema.nullable(),
  // Author-owned stages; an empty array means no stake.
  ownedStages: z.array(ownedStageSchema).readonly().default([]),
  // All assigned stages on the product (read-only grid).
  stageSet: z.array(stageSetEntrySchema).readonly().default([]),
  // Frozen owner group for published cross-group decisions; null is never cross-group.
  ownerGroupId: z.uuid().nullable().default(null),
});

/** Describes an author-visible product and its reporting-stage context. */
export const projectReadModelSchema = projectReadModelObjectSchema.readonly();

// Name-only for products outside author-owned projects — not in `projects` (avoids write leakage).
/** Identifies a product referenced by records outside the author's products. */
export const referencedProjectSchema = z
  .object({
    projectId: z.uuid(),
    projectName: z.string().min(1),
  })
  .readonly();

const reportSectionReadModelObjectSchema = z.object({
  reportSectionId: z.uuid(),
  reportId: z.uuid(),
  authorId: z.uuid(),
  authorName: z.string().min(1),
  authorRole: roleSchema.default("lead"),
  // Optimistic concurrency: client echoes this; repository bumps on each write.
  version: z.number().int().min(1),
  status: reportSectionStatusSchema,
  submittedAt: z.coerce.date().nullable(),
  // True when submitted after deadline.
  late: z.boolean().default(false),
  projects: z.array(projectReadModelSchema).readonly(),
  // Extra product names outside author-owned projects.
  referencedProjects: z.array(referencedProjectSchema).readonly().default([]),
  items: z.array(itemReadModelSchema).readonly(),
  risks: z.array(riskReadModelSchema).readonly(),
  decisions: z.array(decisionReadModelSchema).readonly(),
  activities: z.array(sectionActivitySchema).readonly().default([]),
  // Read-only verdicts; isCurrent means judgedVersion === version.
  reviews: z.array(sectionReviewViewSchema.readonly()).readonly().default([]),
  // Live weekly-report UI hints only — server re-derives group for mutations.
  groupId: z.uuid().nullable().optional(),
  groupName: z.string().min(1).nullable().optional(),
  canReview: z.boolean().optional(),
});

/** Describes the complete section state returned to report clients. */
export const reportSectionReadModelSchema =
  reportSectionReadModelObjectSchema.readonly();

/** Describes one lead's submission state in the head dashboard. */
export const submissionDashboardRowSchema = z
  .object({
    leadId: z.uuid(),
    leadName: z.string().min(1),
    role: roleSchema,
    projectNames: z.array(z.string().min(1)).readonly(),
    status: reportSectionStatusSchema,
    submittedAt: z.coerce.date().nullable(),
  })
  .readonly();

/** Raw client payload accepted by the draft-save decoder. */
export type DraftSavePayload = z.input<typeof draftSaveSchema>;
/** Validated draft state used by section write operations. */
export type DraftSaveInput = z.infer<typeof draftSaveSchema>;
/** Raw client payload accepted by the section-submit decoder. */
export type SubmitSectionPayload = z.input<typeof submitSectionSchema>;
/** Validated section submission used by write operations. */
export type SubmitSectionInput = z.infer<typeof submitSectionSchema>;
/** Complete section state exposed to report clients. */
export type ReportSectionReadModel = z.infer<
  typeof reportSectionReadModelSchema
>;
/** Product context exposed inside a section read model. */
export type ProjectReadModel = z.infer<typeof projectReadModelSchema>;
/** Department activity and its derived reporting status. */
export type SectionActivity = z.infer<typeof sectionActivitySchema>;
/** Product identity linked to a department activity. */
export type LinkedProduct = z.infer<typeof linkedProductSchema>;
/** Writable status and note for one department activity. */
export type ActivityStatusInput = z.infer<typeof activityStatusInputSchema>;
/** Product identity referenced outside the author's assigned products. */
export type ReferencedProject = z.infer<typeof referencedProjectSchema>;
/** Reporting stage assigned to the section author. */
export type OwnedStage = z.infer<typeof ownedStageSchema>;
/** Stage identity displayed in a product's read-only grid. */
export type StageSetEntry = z.infer<typeof stageSetEntrySchema>;
/** Lead submission state displayed in the head dashboard. */
export type SubmissionDashboardRow = z.infer<
  typeof submissionDashboardRowSchema
>;
