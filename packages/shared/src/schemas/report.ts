import { z } from 'zod';

import { roleSchema } from './auth';

export const trafficLightStatusSchema = z.enum(['green', 'yellow', 'red']);
export const itemTypeSchema = z.enum(['current', 'next']);
export const itemWorkflowStatusSchema = z.enum(['done', 'in_progress', 'blocked']);
export const reportSectionStatusSchema = z.enum(['draft', 'submitted']);

export const projectStatusInputSchema = z.object({
  projectId: z.string().uuid(),
  status: trafficLightStatusSchema.optional(),
});

export const itemInputSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  type: itemTypeSchema,
  text: z.string().min(1).max(500),
  tag: z.string().min(1).max(50),
  workflowStatus: itemWorkflowStatusSchema,
  carriedOver: z.boolean().default(false),
  completed: z.boolean().nullable().optional(),
});

export const riskInputSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  risk: z.string().min(1).max(500),
  impact: z.string().min(1).max(500),
  mitigation: z.string().min(1).max(500),
});

export const decisionInputSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string().min(1).max(500),
  owner: z.string().min(1).max(200),
  deadline: z.coerce.date().nullable().optional(),
  impact: z.string().min(1).max(500),
  resolvedAt: z.coerce.date().nullable().optional(),
});

export const priorityInputSchema = z.object({
  id: z.string().uuid().optional(),
  rank: z.number().int().min(1).max(3),
  text: z.string().min(1).max(200),
});

export const draftSaveSchema = z.object({
  reportSectionId: z.string().uuid(),
  status: reportSectionStatusSchema.default('draft'),
  projectStatuses: z.array(projectStatusInputSchema),
  items: z.array(itemInputSchema),
  risks: z.array(riskInputSchema),
  decisions: z.array(decisionInputSchema),
  priorities: z.array(priorityInputSchema),
});

export const submitSectionSchema = draftSaveSchema.extend({
  confirmed: z.literal(true),
  projectStatuses: z.array(projectStatusInputSchema.extend({
    status: trafficLightStatusSchema,
  })).min(1),
  priorities: z.array(priorityInputSchema).length(3),
});

export const projectReadModelSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string().min(1),
  trafficLight: trafficLightStatusSchema.nullable(),
});

export const reportSectionReadModelSchema = z.object({
  reportSectionId: z.string().uuid(),
  reportId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string().min(1),
  status: reportSectionStatusSchema,
  submittedAt: z.coerce.date().nullable(),
  projects: z.array(projectReadModelSchema),
  items: z.array(itemInputSchema),
  risks: z.array(riskInputSchema),
  decisions: z.array(decisionInputSchema),
  priorities: z.array(priorityInputSchema),
});

export const submissionDashboardRowSchema = z.object({
  leadId: z.string().uuid(),
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
export type ReportSectionReadModel = z.infer<typeof reportSectionReadModelSchema>;
export type SubmissionDashboardRow = z.infer<typeof submissionDashboardRowSchema>;

export type DraftSaveValidationErrorCode =
  | 'SECTION_ALREADY_SUBMITTED'
  | 'MISSING_TRAFFIC_LIGHT'
  | 'MISSING_CURRENT_ITEM'
  | 'MISSING_PRIORITIES';

export type DraftSaveValidationError = {
  code: DraftSaveValidationErrorCode;
  message: string;
};

export function validateSubmitInput(
  section: ReportSectionReadModel,
  input: SubmitSectionInput | SubmitSectionPayload,
): DraftSaveValidationError[] {
  if (section.status === 'submitted') {
    return [
      {
        code: 'SECTION_ALREADY_SUBMITTED',
        message: 'Section has already been submitted.',
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
        code: 'MISSING_TRAFFIC_LIGHT',
        message: `Project ${project.projectName} must have a traffic light status.`,
      });
    }

    const hasCurrentItem = input.items.some(
      (item) => item.projectId === project.projectId && item.type === 'current',
    );

    if (!hasCurrentItem) {
      errors.push({
        code: 'MISSING_CURRENT_ITEM',
        message: `Project ${project.projectName} needs at least one Current Week item.`,
      });
    }
  }

  if (
    input.priorities.length !== 3 ||
    input.priorities.some((priority) => priority.text.trim().length === 0)
  ) {
    errors.push({
      code: 'MISSING_PRIORITIES',
      message: 'Top 3 priorities must be filled before submit.',
    });
  }

  return errors;
}
