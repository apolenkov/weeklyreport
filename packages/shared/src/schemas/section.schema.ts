import { z } from "zod";

import { roleSchema } from "./auth";
import {
  itemTypeSchema,
  itemWorkflowStatusSchema,
  reportSectionStatusSchema,
  requiredStageIdsField,
  riskSeveritySchema,
  safeText,
  stageIdsField,
  trafficLightStatusSchema,
} from "./report-primitives.schema";
import {
  recordCommentViewSchema,
  sectionReviewViewSchema,
} from "./review.schema";

export const projectStatusInputSchema = z.object({
  projectId: z.uuid(),
  status: trafficLightStatusSchema.optional(),
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
  projectId: z.uuid(),
  type: itemTypeSchema,
  text: safeText({ max: 500 }),
  tag: safeText({ max: 50 }),
  workflowStatus: itemWorkflowStatusSchema,
  carriedOver: z.boolean().default(false),
  completed: z.boolean().nullable().optional(),
  priorityRank: z.number().int().min(1).nullable().optional(),
  // enforce-item-decision-stage-schema: an item must always carry ≥1 concrete
  // SDLC stage, mirroring riskInputSchema. BREAKING for API callers (or stale
  // clients) that submit stage-less items.
  stageIds: requiredStageIdsField,
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
  projectId: z.uuid(),
  risk: safeText({ max: 500 }),
  impact: safeText({ max: 500 }),
  mitigation: safeText({ max: 500 }),
  severity: riskSeveritySchema.optional(),
  // require-risk-stage (D1): a risk must always carry ≥1 concrete SDLC
  // stage. BREAKING for API callers that submit risks without stages.
  stageIds: requiredStageIdsField,
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
  // enforce-item-decision-stage-schema: a decision must always carry ≥1
  // concrete SDLC stage, mirroring riskInputSchema. BREAKING for API callers
  // (or stale clients) that submit stage-less decisions.
  stageIds: requiredStageIdsField,
  productId: z.uuid().nullable().optional(),
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

export const draftSaveSchema = z.object({
  reportSectionId: z.uuid(),
  // Optimistic-concurrency expected version: the row revision the client
  // loaded. The repository compare-and-sets on it and 409s a stale write.
  version: z.number().int().min(1),
  status: reportSectionStatusSchema.default("draft"),
  projectStatuses: z.array(projectStatusInputSchema),
  stageStatuses: z.array(stageStatusInputSchema).default([]),
  items: z.array(itemInputSchema).max(100),
  risks: z.array(riskInputSchema).max(100),
  decisions: z.array(decisionInputSchema).max(100),
});

export const submitSectionSchema = draftSaveSchema.extend({
  confirmed: z.literal(true),
  projectStatuses: z
    .array(
      projectStatusInputSchema.extend({
        status: trafficLightStatusSchema,
      }),
    )
    .min(1),
});

// 35-04: per-project list of stages owned by the section author on this
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
   * fixtures and contract-test factories that pre-date 35-04 still
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

// 35-03: role label of the section author, surfaced end-to-end so the
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
  // UFB-047 / Phase 49-01: `departmentName` removed. Consumers that
  // need a brand label now read it from the per-request session
  // (`auth.me.organization.shortName` / `.fullName`) — the section
  // read-model no longer carries a redundant per-section copy.
  status: reportSectionStatusSchema,
  submittedAt: z.coerce.date().nullable(),
  // UFB-049 / Phase 50-B: stamped true by submitSection when
  // `now > Report.deadline` at submit-time (regardless of grace). Drives
  // a "late" badge on the head dashboard + lead form. Optional in the
  // inferred TS type so legacy fixtures + Phase 35+ test payloads that
  // pre-date 50-B still construct ReportSectionReadModel without
  // breaking. Consumers treat `late === true` only — undefined/false
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
export type ReferencedProject = z.infer<typeof referencedProjectSchema>;
export type OwnedStage = z.infer<typeof ownedStageSchema>;
export type StageSetEntry = z.infer<typeof stageSetEntrySchema>;
export type SubmissionDashboardRow = z.infer<
  typeof submissionDashboardRowSchema
>;
