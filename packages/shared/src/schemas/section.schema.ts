import { z } from "zod";

import { roleSchema } from "./auth";
import {
  addItemTypeStatusIssue,
  itemTypeSchema,
  itemWorkflowStatusSchema,
  reportSectionStatusSchema,
  riskSeveritySchema,
  safeText,
  stageNamesField,
  trafficLightStatusSchema,
  writeStageNamesField,
} from "./report-primitives.schema";
import {
  recordCommentViewSchema,
  sectionReviewViewSchema,
} from "./review.schema";

// Payload guard against pathological section-save array sizes.
const MAX_RECORDS_PER_SECTION_SAVE = 100;

// Tighter than safeText's default cap: a tag renders as a single chip label and
// an owner is a person or team name, so both must stay on one line.
const ITEM_TAG_MAX_LENGTH = 50;
const DECISION_OWNER_MAX_LENGTH = 200;

export const projectStatusInputSchema = z.object({
  projectId: z.uuid(),
  status: trafficLightStatusSchema.optional(),
});

// One activity-status slice entry in the section-save payload. Mirrors
// projectStatusInputSchema; `note` is optional free text. The server accepts
// only activityIds already attached/seeded for the section author.
export const activityStatusInputSchema = z.object({
  activityId: z.uuid(),
  status: trafficLightStatusSchema.nullable().optional(),
  note: safeText().nullable().optional(),
});

// One product an activity reports against (label-only).
export const linkedProductSchema = z.object({
  productId: z.uuid(),
  productName: z.string().min(1),
});

// `status` is the stored lead-chosen light, nullable only to tolerate legacy
// rows; the pill renders `derivedStatus`, the risk/blocker floor.
export const sectionActivitySchema = z.object({
  activityId: z.uuid(),
  activityName: z.string().min(1),
  status: trafficLightStatusSchema.nullable(),
  note: z.string().nullable().optional(),
  // Products this activity reports against (M:N, label-
  // only). `.default([])` keeps frozen snapshots + legacy fixtures parsing.
  linkedProducts: z.array(linkedProductSchema).default([]),
  // The risk/blocker-derived status floor is what the pill renders
  // when set, else falls back to `status`. `.default(null)` for snapshot compat.
  derivedStatus: trafficLightStatusSchema.nullable().default(null),
  // Record-only alarm floor (excludes lead's choice); optional for legacy fixtures.
  alarmFloor: trafficLightStatusSchema.nullable().optional(),
});

export const stageStatusInputSchema = z.object({
  projectId: z.uuid(),
  stageId: z.uuid(),
  status: trafficLightStatusSchema.nullable().optional(),
});

export const itemInputSchema = z.object({
  id: z.uuid().optional(),
  // Lineage key so identity survives saveSection delete-recreate; DB mints on first persist.
  stableId: z.uuid().optional(),
  // XOR parent enforced by itemWriteSchema superRefine (DB CHECK is defence-in-depth).
  projectId: z.uuid().nullable().optional(),
  activityId: z.uuid().nullable().optional(),
  type: itemTypeSchema,
  text: safeText(),
  tag: safeText({ max: ITEM_TAG_MAX_LENGTH }),
  workflowStatus: itemWorkflowStatusSchema,
  carriedOver: z.boolean().default(false),
  priorityRank: z.number().int().min(1).nullable().optional(),
  // Optional so legacy paused rows and non-paused items still round-trip; UI requires when pausing.
  pausedReason: safeText().nullable().optional(),
  // Length-tolerant; write superRefine requires stages for product parents only.
  stageNames: writeStageNamesField,
});

// Read path tolerates stage-less legacy rows; write path rejects them.
export const itemReadModelSchema = itemInputSchema.extend({
  stageNames: stageNamesField,
  // Read-only: optional so the write path and legacy fixtures never carry it,
  // and mergeSection drops it on parse rather than round-tripping it back.
  comments: z.array(recordCommentViewSchema).optional(),
});

export const riskInputSchema = z.object({
  id: z.uuid().optional(),
  // Durable lineage key round-tripped from the read model (see itemInputSchema).
  stableId: z.uuid().optional(),
  // XOR parent (see itemInputSchema): the riskWriteSchema superRefine enforces it.
  projectId: z.uuid().nullable().optional(),
  activityId: z.uuid().nullable().optional(),
  risk: safeText(),
  impact: safeText(),
  mitigation: safeText(),
  severity: riskSeveritySchema,
  // Length-tolerant; the riskWriteSchema superRefine enforces the conditional
  // stage rule (≥1 for a product parent, none for an activity parent).
  stageNames: writeStageNamesField,
});

// The read model stays tolerant of stage-less legacy rows so the card can render
// "No stage set" warning instead of crashing the page. Only the write
// path (draft-save/submit via `riskInputSchema`) rejects them.
const riskReadModelSchema = riskInputSchema.extend({
  stageNames: stageNamesField,
  // Reviewer comments anchored to this risk follow the same read-only path as
  // the item read model.
  comments: z.array(recordCommentViewSchema).optional(),
});

export const decisionInputSchema = z.object({
  id: z.uuid().optional(),
  // Durable lineage key round-tripped from the read model (see itemInputSchema).
  stableId: z.uuid().optional(),
  text: safeText(),
  owner: safeText({ max: DECISION_OWNER_MAX_LENGTH }),
  deadline: z.coerce.date().nullable().optional(),
  impact: safeText(),
  resolvedAt: z.coerce.date().nullable().optional(),
  // Length-tolerant; the decisionWriteSchema superRefine enforces the conditional
  // stage rule (≥1 for a product parent, none for an activity parent).
  stageNames: writeStageNamesField,
  // XOR parent (full parity — an activity owns decisions too). The
  // decisionWriteSchema superRefine enforces exactly-one-parent.
  productId: z.uuid().nullable().optional(),
  activityId: z.uuid().nullable().optional(),
});

// The read model tolerates stage-less legacy decision rows so they load and render
// the loud "No stage set" marker; only the write path rejects them.
export const decisionReadModelSchema = decisionInputSchema.extend({
  stageNames: stageNamesField,
  // Reviewer comments anchored to this decision follow the same read-only path as
  // the item read model.
  comments: z.array(recordCommentViewSchema).optional(),
});

// Parent XOR + stages stay off base inputs so read/submit schemas remain .extend-able.
const addParentXorIssues = (
  value: {
    readonly activityId?: string | null | undefined;
    readonly stageNames?: readonly string[] | undefined;
  },
  productId: string | null | undefined,
  productPath: "projectId" | "productId",
  ctx: z.RefinementCtx,
): void => {
  const { activityId, stageNames } = value;
  const hasProduct = productId != null;
  const hasActivity = activityId != null;
  if (hasProduct === hasActivity) {
    ctx.addIssue({
      code: "custom",
      path: [hasActivity ? "activityId" : productPath],
      message:
        "A record must have exactly one parent — a product or an activity.",
    });
  }
  const stageCount = stageNames?.length ?? 0;
  if (hasProduct && stageCount === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["stageNames"],
      message: "A product-parented record requires at least one stage.",
    });
  }
  if (hasActivity && stageCount > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["stageNames"],
      message: "An activity-parented record must not carry a stage.",
    });
  }
};

export const itemWriteSchema = itemInputSchema.superRefine((value, ctx) => {
  addParentXorIssues(value, value.projectId, "projectId", ctx);
  addItemTypeStatusIssue(value.type, value.workflowStatus, ctx);
});

export const riskWriteSchema = riskInputSchema.superRefine((value, ctx) =>
  addParentXorIssues(value, value.projectId, "projectId", ctx),
);

export const decisionWriteSchema = decisionInputSchema.superRefine(
  (value, ctx) => addParentXorIssues(value, value.productId, "productId", ctx),
);

export const draftSaveSchema = z.object({
  reportSectionId: z.uuid(),
  // Optimistic-concurrency expected version: the row revision the client
  // loaded. The repository compare-and-sets on it and 409s a stale write.
  version: z.number().int().min(1),
  status: z.literal("draft").default("draft"),
  projectStatuses: z
    .array(projectStatusInputSchema)
    .max(MAX_RECORDS_PER_SECTION_SAVE),
  stageStatuses: z
    .array(stageStatusInputSchema)
    .max(MAX_RECORDS_PER_SECTION_SAVE)
    .default([]),
  // Activity-status slice beside projectStatuses. Defaulted so pre-existing
  // clients (and fixtures) that omit it keep saving; the server then keeps
  // the seeded statuses unchanged.
  activityStatuses: z
    .array(activityStatusInputSchema)
    .max(MAX_RECORDS_PER_SECTION_SAVE)
    .default([]),
  items: z.array(itemWriteSchema).max(MAX_RECORDS_PER_SECTION_SAVE),
  risks: z.array(riskWriteSchema).max(MAX_RECORDS_PER_SECTION_SAVE),
  decisions: z.array(decisionWriteSchema).max(MAX_RECORDS_PER_SECTION_SAVE),
});

export const submitSectionSchema = draftSaveSchema.extend({
  confirmed: z.literal(true),
  // May be empty for activity-only sections; omitted activities need server-side checks.
  projectStatuses: z
    .array(
      projectStatusInputSchema.extend({
        status: trafficLightStatusSchema,
      }),
    )
    .max(MAX_RECORDS_PER_SECTION_SAVE),
  activityStatuses: z
    .array(
      activityStatusInputSchema.extend({
        status: trafficLightStatusSchema,
      }),
    )
    .max(MAX_RECORDS_PER_SECTION_SAVE)
    .default([]),
});

// Display-only stage grid metadata; saveSection writes status only from ownedStages.
export const stageSetEntrySchema = z.object({
  stageId: z.uuid(),
  stageName: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

// Author's StageAssignment rows for this product; empty means no stake.
export const ownedStageSchema = stageSetEntrySchema.extend({
  status: trafficLightStatusSchema.nullable().optional(),
});

export const projectReadModelSchema = z.object({
  projectId: z.uuid(),
  projectName: z.string().min(1),
  trafficLight: trafficLightStatusSchema.nullable(),
  // Author-owned stages; missing means no stake (optional for legacy fixtures).
  ownedStages: z.array(ownedStageSchema).optional(),
  // All assigned stages on the product (read-only grid); missing falls back to ownedStages.
  stageSet: z.array(stageSetEntrySchema).optional(),
  // Frozen owner group for published cross-group decisions; null is never cross-group.
  ownerGroupId: z.uuid().nullable().optional(),
});

// Name-only for products outside author-owned projects — not in `projects` (avoids write leakage).
export const referencedProjectSchema = z.object({
  projectId: z.uuid(),
  projectName: z.string().min(1),
});

// authorRole drives reopen vs revoke chrome; optional for legacy fixtures (default lead).
export const reportSectionReadModelSchema = z.object({
  reportSectionId: z.uuid(),
  reportId: z.uuid(),
  authorId: z.uuid(),
  authorName: z.string().min(1),
  authorRole: roleSchema.optional(),
  // Optimistic concurrency: client echoes this; repository bumps on each write.
  version: z.number().int().min(1),
  status: reportSectionStatusSchema,
  submittedAt: z.coerce.date().nullable(),
  // True when submitted after deadline; only `late === true` means late.
  late: z.boolean().optional(),
  projects: z.array(projectReadModelSchema),
  // Extra product names outside author-owned projects; optional for legacy fixtures.
  referencedProjects: z.array(referencedProjectSchema).optional(),
  items: z.array(itemReadModelSchema),
  risks: z.array(riskReadModelSchema),
  decisions: z.array(decisionReadModelSchema),
  // default([]) keeps pre-activity published snapshots parsing.
  activities: z.array(sectionActivitySchema).default([]),
  // Read-only verdicts; isCurrent means judgedVersion === version.
  reviews: z.array(sectionReviewViewSchema).optional(),
  // Live weekly-report UI hints only — server re-derives group for mutations.
  groupId: z.uuid().nullable().optional(),
  canReview: z.boolean().optional(),
});

export const submissionDashboardRowSchema = z.object({
  leadId: z.uuid(),
  leadName: z.string().min(1),
  role: roleSchema,
  projectNames: z.array(z.string().min(1)),
  status: reportSectionStatusSchema,
  submittedAt: z.coerce.date().nullable(),
});

export type DraftSavePayload = z.input<typeof draftSaveSchema>;
export type DraftSaveInput = z.infer<typeof draftSaveSchema>;
export type SubmitSectionPayload = z.input<typeof submitSectionSchema>;
export type SubmitSectionInput = z.infer<typeof submitSectionSchema>;
export type ReportSectionReadModel = z.infer<
  typeof reportSectionReadModelSchema
>;
export type ProjectReadModel = z.infer<typeof projectReadModelSchema>;
export type SectionActivity = z.infer<typeof sectionActivitySchema>;
export type LinkedProduct = z.infer<typeof linkedProductSchema>;
export type ActivityStatusInput = z.infer<typeof activityStatusInputSchema>;
export type ReferencedProject = z.infer<typeof referencedProjectSchema>;
export type OwnedStage = z.infer<typeof ownedStageSchema>;
export type StageSetEntry = z.infer<typeof stageSetEntrySchema>;
export type SubmissionDashboardRow = z.infer<
  typeof submissionDashboardRowSchema
>;
