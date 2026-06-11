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
  projectId: z.uuid(),
  type: itemTypeSchema,
  text: safeText({ max: 500 }),
  tag: safeText({ max: 50 }),
  workflowStatus: itemWorkflowStatusSchema,
  carriedOver: z.boolean().default(false),
  completed: z.boolean().nullable().optional(),
  priorityRank: z.number().int().min(1).nullable().optional(),
  stageIds: stageIdsField,
});

export const riskInputSchema = z.object({
  id: z.uuid().optional(),
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
});

export const decisionInputSchema = z.object({
  id: z.uuid().optional(),
  text: safeText({ max: 500 }),
  owner: safeText({ max: 200 }),
  deadline: z.coerce.date().nullable().optional(),
  impact: safeText({ max: 500 }),
  resolvedAt: z.coerce.date().nullable().optional(),
  stageIds: stageIdsField,
  productId: z.uuid().nullable().optional(),
});

export const draftSaveSchema = z.object({
  reportSectionId: z.uuid(),
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
// userId=author). Empty array == author has no stake on this project,
// in which case the lead-form renders the project's stages as
// `unassigned` chips with assignee=null.
export const ownedStageSchema = z.object({
  stageId: z.uuid(),
  stageName: z.string().min(1),
  sortOrder: z.number().int().min(0),
  status: trafficLightStatusSchema.nullable().optional(),
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
  items: z.array(itemInputSchema),
  risks: z.array(riskReadModelSchema),
  decisions: z.array(decisionInputSchema),
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
export type SubmissionDashboardRow = z.infer<
  typeof submissionDashboardRowSchema
>;

export type DraftSaveValidationErrorCode =
  | "SECTION_ALREADY_SUBMITTED"
  | "MISSING_TRAFFIC_LIGHT"
  | "MISSING_CURRENT_ITEM";

export interface DraftSaveValidationError {
  code: DraftSaveValidationErrorCode;
  message: string;
}

export function validateSubmitInput(
  section: ReportSectionReadModel,
  input: SubmitSectionInput | SubmitSectionPayload,
): DraftSaveValidationError[] {
  if (section.status === "submitted") {
    return [
      {
        code: "SECTION_ALREADY_SUBMITTED",
        message: "Section has already been submitted.",
      },
    ];
  }

  const errors: DraftSaveValidationError[] = [];

  for (const project of section.projects) {
    const matchingStatus = input.projectStatuses.find(
      (status) => status.projectId === project.projectId,
    );

    if (!matchingStatus?.status) {
      errors.push({
        code: "MISSING_TRAFFIC_LIGHT",
        message: `Project ${project.projectName} must have a traffic light status.`,
      });
    }

    const hasCurrentItem = input.items.some(
      (item) => item.projectId === project.projectId && item.type === "current",
    );

    if (!hasCurrentItem) {
      errors.push({
        code: "MISSING_CURRENT_ITEM",
        message: `Project ${project.projectName} needs at least one Current Week item.`,
      });
    }
  }

  return errors;
}
