import { z } from "zod";

import { roleSchema } from "./auth";
import {
  addItemTypeStatusIssue,
  itemTypeSchema,
  itemWorkflowStatusSchema,
  reportSectionStatusSchema,
  riskSeveritySchema,
  safeText,
  stageIdsField,
  trafficLightStatusSchema,
  writeStageIdsField,
} from "./report-primitives.schema";
import {
  recordCommentViewSchema,
  sectionReviewViewSchema,
} from "./review.schema";

// Payload guard against pathological section-save array sizes.
const MAX_RECORDS_PER_SECTION_SAVE = 100;

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
  note: safeText({ max: 500 }).nullable().optional(),
});

// activity-first-class: one product an activity reports against (label-only).
export const linkedProductSchema = z.object({
  productId: z.uuid(),
  productName: z.string().min(1),
});

// Read-model view of one seeded ActivityStatus row (activity name joined for
// display). `status` is the stored lead-chosen light (nullable to tolerate
// legacy rows, though seeding defaults it green); `derivedStatus` is the
// risk/blocker floor the pill actually renders.
export const sectionActivitySchema = z.object({
  activityId: z.uuid(),
  activityName: z.string().min(1),
  status: trafficLightStatusSchema.nullable(),
  note: z.string().nullable().optional(),
  // activity-first-class: products this activity reports against (M:N, label-
  // only). `.default([])` keeps frozen snapshots + legacy fixtures parsing.
  linkedProducts: z.array(linkedProductSchema).default([]),
  // Risk/blocker-derived status floor (design decision 5): the pill renders this
  // when set, else falls back to `status`. `.default(null)` for snapshot compat.
  derivedStatus: trafficLightStatusSchema.nullable().default(null),
  // The RECORD-ONLY floor (covering risks/blockers), excluding the lead's stored
  // choice — unlike `derivedStatus` which folds it in. The interactive lead pill
  // gates a manual lower on THIS, so a lead can still lower a status they raised
  // themselves when no covering risk holds it up. Optional so legacy fixtures and
  // frozen snapshots that predate it still parse (consumers read `?? null`).
  alarmFloor: trafficLightStatusSchema.nullable().optional(),
});

export const stageStatusInputSchema = z.object({
  projectId: z.uuid(),
  stageId: z.uuid(),
  status: trafficLightStatusSchema.nullable().optional(),
});

export const itemInputSchema = z.object({
  id: z.uuid().optional(),
  // Durable lineage key round-tripped from the read model so identity survives
  // saveSection's delete-recreate. Optional: a brand-new client record has none
  // yet (the DB mints it on first persist); the read model inherits this
  // optionality, mirroring `id`, because mergeSection parses the raw input
  // items against the read-model schema.
  stableId: z.uuid().optional(),
  // XOR parent: exactly one of projectId / activityId. Both nullable/optional at
  // the field level; the itemWriteSchema superRefine enforces the XOR + the
  // conditional stage rule. The DB CHECK is the defence-in-depth backstop.
  projectId: z.uuid().nullable().optional(),
  activityId: z.uuid().nullable().optional(),
  type: itemTypeSchema,
  text: safeText({ max: 500 }),
  tag: safeText({ max: 50 }),
  workflowStatus: itemWorkflowStatusSchema,
  carriedOver: z.boolean().default(false),
  priorityRank: z.number().int().min(1).nullable().optional(),
  // require-paused-item-reason: the lead's reason for pausing. Nullable/optional —
  // legacy paused rows predate it and non-paused items never carry one. The UI
  // requires it when pausing; the schema stays permissive so existing paused rows
  // still round-trip on the next save.
  pausedReason: safeText({ max: 500 }).nullable().optional(),
  // Length-tolerant here; the itemWriteSchema superRefine requires ≥1 stage for a
  // product parent and rejects any stage on an activity parent.
  stageIds: writeStageIdsField,
});

// enforce-item-decision-stage-schema (mirrors riskReadModelSchema): the READ
// model stays tolerant of stage-less legacy item rows so they still load and
// can render the loud "No stage set" marker; only the write path rejects them.
export const itemReadModelSchema = itemInputSchema.extend({
  stageIds: stageIdsField,
  // review-acknowledgement: reviewer comments anchored to this item, surfaced
  // read-only on the section read path. Optional so the write path
  // (itemInputSchema) and legacy fixtures never carry it; the client never
  // round-trips it back (mergeSection drops it on parse).
  comments: z.array(recordCommentViewSchema).optional(),
});

export const riskInputSchema = z.object({
  id: z.uuid().optional(),
  // Durable lineage key round-tripped from the read model (see itemInputSchema).
  stableId: z.uuid().optional(),
  // XOR parent (see itemInputSchema): the riskWriteSchema superRefine enforces it.
  projectId: z.uuid().nullable().optional(),
  activityId: z.uuid().nullable().optional(),
  risk: safeText({ max: 500 }),
  impact: safeText({ max: 500 }),
  mitigation: safeText({ max: 500 }),
  severity: riskSeveritySchema,
  // Length-tolerant; the riskWriteSchema superRefine enforces the conditional
  // stage rule (≥1 for a product parent, none for an activity parent).
  stageIds: writeStageIdsField,
});

// require-risk-stage (D2): the READ model stays tolerant of stage-less
// legacy rows — they must still load so the card can render the loud
// "No stage set" warning instead of crashing the page. Only the write
// path (draft-save/submit via `riskInputSchema`) rejects them.
const riskReadModelSchema = riskInputSchema.extend({
  stageIds: stageIdsField,
  // review-acknowledgement: reviewer comments anchored to this risk (see
  // itemReadModelSchema).
  comments: z.array(recordCommentViewSchema).optional(),
});

export const decisionInputSchema = z.object({
  id: z.uuid().optional(),
  // Durable lineage key round-tripped from the read model (see itemInputSchema).
  stableId: z.uuid().optional(),
  text: safeText({ max: 500 }),
  owner: safeText({ max: 200 }),
  deadline: z.coerce.date().nullable().optional(),
  impact: safeText({ max: 500 }),
  resolvedAt: z.coerce.date().nullable().optional(),
  // Length-tolerant; the decisionWriteSchema superRefine enforces the conditional
  // stage rule (≥1 for a product parent, none for an activity parent).
  stageIds: writeStageIdsField,
  // XOR parent (full parity — an activity owns decisions too). The
  // decisionWriteSchema superRefine enforces exactly-one-parent.
  productId: z.uuid().nullable().optional(),
  activityId: z.uuid().nullable().optional(),
});

// enforce-item-decision-stage-schema (mirrors riskReadModelSchema): the READ
// model tolerates stage-less legacy decision rows so they still load and render
// the loud "No stage set" marker; only the write path rejects them.
export const decisionReadModelSchema = decisionInputSchema.extend({
  stageIds: stageIdsField,
  // review-acknowledgement: reviewer comments anchored to this decision (see
  // itemReadModelSchema).
  comments: z.array(recordCommentViewSchema).optional(),
});

// activity-first-class: exactly one parent (product XOR activity) plus the
// conditional stage rule, enforced per record on the write path. Kept off the
// base input objects so the read models keep `.extend`ing them and the submit
// schema keeps `.extend`ing draftSaveSchema (a superRefine yields a ZodEffects,
// which is not `.extend`able). The DB CHECK is the defence-in-depth backstop.
const addParentXorIssues = (
  value: {
    readonly activityId?: string | null;
    readonly stageIds?: readonly string[];
  },
  productId: string | null | undefined,
  productPath: "projectId" | "productId",
  ctx: z.RefinementCtx,
): void => {
  const { activityId, stageIds } = value;
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
  const stageCount = stageIds?.length ?? 0;
  if (hasProduct && stageCount === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["stageIds"],
      message: "A product-parented record requires at least one stage.",
    });
  }
  if (hasActivity && stageCount > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["stageIds"],
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
  // activity-first-class: relaxed from `.min(1)` — an activity-only section (0
  // products) submits. Present product statuses stay required non-null; the
  // "at least one product OR activity" and "every attached activity has a status"
  // checks are server-authoritative in validateSubmitInput (schema tightening
  // alone cannot catch an OMITTED attached activity).
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

// Per-project list of stages owned by the section author on this
// project. Sourced from `StageAssignment` rows scoped by (projectId,
// userId=author). Empty array == author has no stake on this project.
// unassigned-stage-reporting-exclusion: the lead-form renders the grid from
// `stageSet` (assignments across all leads); a stage the author does not own
// shows foreign-owned, and a stage with no assignment is excluded entirely.
export const ownedStageSchema = z.object({
  stageId: z.uuid(),
  stageName: z.string().min(1),
  sortOrder: z.number().int().min(0),
  status: trafficLightStatusSchema.nullable().optional(),
});

// unassigned-stage-reporting-exclusion: one entry per stage that has an
// assignment to ANY lead on the product (the union across all leads). This is
// READ-ONLY display metadata: it sources the lead-form stage grid so a stage
// with NO assignment is excluded entirely (not rendered as a vacant chip),
// while a stage assigned to another lead renders foreign-owned. It NEVER feeds
// the write path — `saveSection` persists status only from `ownedStages`.
export const stageSetEntrySchema = z.object({
  stageId: z.uuid(),
  stageName: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

export const projectReadModelSchema = z.object({
  projectId: z.uuid(),
  projectName: z.string().min(1),
  trafficLight: trafficLightStatusSchema.nullable(),
  /**
   * Stages this project's section author owns via `StageAssignment`. The
   * lead-form renders the standard 7-stage grid and marks each stage as
   * "mine" iff its name matches one of these. Optional so existing
   * fixtures and contract-test factories that pre-date this field still
   * type-check; missing -> empty array means "no stake on this project"
   * which the lead-form mapper handles symmetrically.
   */
  ownedStages: z.array(ownedStageSchema).optional(),
  /**
   * unassigned-stage-reporting-exclusion: the product's assigned-stage set —
   * every stage with an assignment to ANY lead on the product. READ-ONLY
   * display metadata that sources the lead-form grid (a stage absent from the
   * set is excluded; one present but not in `ownedStages` is foreign-owned).
   * Optional so legacy fixtures and frozen snapshots that pre-date this change
   * still parse; missing -> the mapper falls back to `ownedStages` (own stages
   * only, no foreign chips).
   */
  stageSet: z.array(stageSetEntrySchema).optional(),
  /**
   * The product's natural owner group — its lead's `reportingGroupId`,
   * frozen into every section's `projects[]` entry at snapshot-build time so
   * the published read can decide cross-group access from the snapshot's own
   * data instead of a live re-query. Optional so frozen snapshots and fixtures
   * that pre-date this field still parse; missing/null means "unknown owner"
   * and is NEVER treated as cross-group.
   */
  ownerGroupId: z.uuid().nullable().optional(),
});

// fix-lead-surface-name-resolution: name-only entry for a project that a
// section row (item / risk / decision) references but the section author
// owns no stage on. Carried separately from `projects` on purpose:
// widening `projects` would leak an editable product card
// (`mapLeadProducts`), spurious `ProjectStatus` writes (`saveSection`),
// and submit-validation demands (`validateSubmitInput`). Consumers use it
// for product-name resolution only.
export const referencedProjectSchema = z.object({
  projectId: z.uuid(),
  projectName: z.string().min(1),
});

// Role label of the section author, surfaced end-to-end so the
// /lead/report chrome can switch between "Request Reopen" (lead-on-own-
// section) and "Revoke" (head/admin viewing someone else's section).
// Optional so legacy fixtures continue to parse — consumers that gate
// on the role default to `'lead'` when missing.
export const reportSectionReadModelSchema = z.object({
  reportSectionId: z.uuid(),
  reportId: z.uuid(),
  authorId: z.uuid(),
  authorName: z.string().min(1),
  authorRole: roleSchema.optional(),
  // Optimistic-concurrency row revision the client must echo back in its next
  // save (see draftSaveSchema). Mints at 1; the repository increments it on
  // every successful write and returns the bumped value here.
  version: z.number().int().min(1),
  // `departmentName` is NOT on the section read-model — a redundant
  // per-section copy. Consumers that need a brand label read it from the
  // per-request session (`auth.me.organization.shortName` / `.fullName`).
  status: reportSectionStatusSchema,
  submittedAt: z.coerce.date().nullable(),
  // Stamped true by submitSection when `now > Report.deadline` at
  // submit-time (regardless of grace). Drives a "late" badge on the head
  // dashboard + lead form. Optional in the inferred TS type so legacy
  // fixtures and older test payloads still construct ReportSectionReadModel
  // without breaking. Consumers treat `late === true` only — undefined/false
  // both mean "on time".
  late: z.boolean().optional(),
  projects: z.array(projectReadModelSchema),
  // fix-lead-surface-name-resolution: name source for rows referencing a
  // project outside the author's stage-owned `projects`. Optional so
  // legacy fixtures and pre-existing snapshots still parse; missing means
  // "no extra names" and the mappers fall back exactly as before.
  referencedProjects: z.array(referencedProjectSchema).optional(),
  items: z.array(itemReadModelSchema),
  risks: z.array(riskReadModelSchema),
  decisions: z.array(decisionReadModelSchema),
  // The author's attached Project Activities with their per-period status.
  // `.default([])` keeps older published snapshots (frozen before activities
  // existed) and legacy fixtures parsing.
  activities: z.array(sectionActivitySchema).default([]),
  // review-acknowledgement: per-section verdicts, surfaced read-only. Each
  // carries `isCurrent` (judgedVersion === version) so a re-submitted section
  // reads as awaiting review, not "needs changes". Optional so legacy fixtures
  // and the write path never carry it.
  reviews: z.array(sectionReviewViewSchema).optional(),
  // review-acknowledgement: the section author's reporting group and whether the
  // CURRENT caller is a designated reviewer for it. Stamped ONLY on the live
  // head/viewer weekly-report read (never the write path nor the published
  // snapshot). The client gates the per-record comment composer and the
  // per-section verdict control on `canReview`, and derives the Acknowledge
  // control's group set from the distinct `groupId`s; every mutation still
  // re-derives the group server-side, so these are UI-affordance hints, never
  // the security boundary. Both optional so the write path and legacy fixtures
  // never carry them.
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
