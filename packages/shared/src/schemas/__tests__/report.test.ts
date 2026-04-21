import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import {
  draftSaveSchema,
  submitSectionSchema,
  itemInputSchema,
  riskInputSchema,
  decisionInputSchema,
  priorityInputSchema,
  trafficLightStatusSchema,
  itemTypeSchema,
  itemWorkflowStatusSchema,
  reportSectionStatusSchema,
  reportStatusSchema,
  carryOverStatusSchema,
  assembledReportSchema,
  reportPeriodSchema,
  projectStatusInputSchema,
  portfolioOverviewSchema,
  archiveReportSummarySchema,
  validateSubmitInput,
  type ReportSectionReadModel,
} from '../report';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const uuid = () => randomUUID();
const PROJECT_UUID = uuid();

const validItem = () => ({
  projectId: uuid(),
  type: 'current' as const,
  text: 'Ship feature X',
  tag: 'feature',
  workflowStatus: 'in_progress' as const,
});

const validRisk = () => ({
  projectId: uuid(),
  risk: 'Deadline may slip',
  impact: 'Revenue loss',
  mitigation: 'Hire contractor',
});

const validDecision = () => ({
  text: 'Upgrade to PostgreSQL 16',
  owner: 'Alice',
  impact: 'Better performance',
});

const validPriority = (rank: number) => ({
  rank,
  text: `Priority number ${rank}`,
});

const validDraft = () => ({
  reportSectionId: uuid(),
  projectStatuses: [{ projectId: PROJECT_UUID, status: 'green' as const }],
  items: [validItem()],
  risks: [validRisk()],
  decisions: [validDecision()],
  priorities: [validPriority(1)],
});

const validSubmit = () => ({
  ...validDraft(),
  confirmed: true as const,
  priorities: [validPriority(1), validPriority(2), validPriority(3)],
});

// Helper to generate arrays of a given size
const makeItems = (count: number) =>
  Array.from({ length: count }, () => validItem());

const makeRisks = (count: number) =>
  Array.from({ length: count }, () => validRisk());

const makeDecisions = (count: number) =>
  Array.from({ length: count }, () => validDecision());

const makePriorities = (count: number) =>
  Array.from({ length: count }, (_, i) => validPriority((i % 3) + 1));

// ---------------------------------------------------------------------------
// Group 1: draftSaveSchema boundaries
// ---------------------------------------------------------------------------

describe('draftSaveSchema', () => {
  it('accepts a valid minimal draft input', () => {
    const result = draftSaveSchema.safeParse(validDraft());
    expect(result.success).toBe(true);
  });

  it('accepts items array with 0 elements (empty draft OK)', () => {
    const draft = { ...validDraft(), items: [] };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it('accepts items array with exactly 100 elements (at boundary)', () => {
    const draft = { ...validDraft(), items: makeItems(100) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it('rejects items array with 101 elements (exceeds max)', () => {
    const draft = { ...validDraft(), items: makeItems(101) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(false);
  });

  it('accepts risks array with 100 elements (at boundary)', () => {
    const draft = { ...validDraft(), risks: makeRisks(100) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it('rejects risks array with 101 elements', () => {
    const draft = { ...validDraft(), risks: makeRisks(101) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(false);
  });

  it('accepts decisions array with 100 elements (at boundary)', () => {
    const draft = { ...validDraft(), decisions: makeDecisions(100) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it('rejects decisions array with 101 elements', () => {
    const draft = { ...validDraft(), decisions: makeDecisions(101) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(false);
  });

  it('accepts priorities array with 50 elements (max boundary)', () => {
    const draft = { ...validDraft(), priorities: makePriorities(50) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(true);
  });

  it('rejects priorities array with 51 elements (exceeds max)', () => {
    const draft = { ...validDraft(), priorities: makePriorities(51) };
    const result = draftSaveSchema.safeParse(draft);
    expect(result.success).toBe(false);
  });

  it('defaults status to draft when not provided', () => {
    const result = draftSaveSchema.safeParse(validDraft());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft');
    }
  });
});

// ---------------------------------------------------------------------------
// Group 2: itemInputSchema — safeText boundaries
// ---------------------------------------------------------------------------

describe('itemInputSchema — safeText', () => {
  it('accepts item text with exactly 1 visible character', () => {
    const item = { ...validItem(), text: 'A' };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('rejects item text with 0 characters (empty string)', () => {
    const item = { ...validItem(), text: '' };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it('accepts item text at max length (500 chars)', () => {
    const item = { ...validItem(), text: 'A'.repeat(500) };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('rejects item text exceeding max length (501 chars)', () => {
    const item = { ...validItem(), text: 'A'.repeat(501) };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it('rejects item text containing null byte \\u0000', () => {
    const item = { ...validItem(), text: 'Hello\u0000World' };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Text must not contain null bytes');
    }
  });

  it('rejects item text that is only zero-width spaces \\u200B', () => {
    const item = { ...validItem(), text: '\u200B\u200B\u200B' };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Text must contain visible characters');
    }
  });

  it('accepts item text with zero-width space mixed with real text', () => {
    const item = { ...validItem(), text: '\u200BHello' };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('rejects item text that is only whitespace', () => {
    const item = { ...validItem(), text: '   ' };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it('rejects item text that is only \\uFEFF (BOM)', () => {
    const item = { ...validItem(), text: '\uFEFF' };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it('accepts tag with exactly 1 character', () => {
    const item = { ...validItem(), tag: 'X' };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('rejects tag with 51 characters (exceeds max 50)', () => {
    const item = { ...validItem(), tag: 'A'.repeat(51) };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it('rejects tag containing null byte', () => {
    const item = { ...validItem(), tag: 'bug\u0000fix' };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 3: riskInputSchema — safeText on risk/impact/mitigation
// ---------------------------------------------------------------------------

describe('riskInputSchema — safeText', () => {
  it('accepts a valid risk', () => {
    const result = riskInputSchema.safeParse(validRisk());
    expect(result.success).toBe(true);
  });

  it('rejects risk text with null byte', () => {
    const risk = { ...validRisk(), risk: 'Risk\u0000here' };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });

  it('rejects impact text with null byte', () => {
    const risk = { ...validRisk(), impact: 'Impact\u0000here' };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });

  it('rejects mitigation text with null byte', () => {
    const risk = { ...validRisk(), mitigation: 'Mitigate\u0000here' };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });

  it('rejects risk text that is only zero-width spaces', () => {
    const risk = { ...validRisk(), risk: '\u200B\u200C\u200D' };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 4: decisionInputSchema — safeText
// ---------------------------------------------------------------------------

describe('decisionInputSchema — safeText', () => {
  it('accepts a valid decision', () => {
    const result = decisionInputSchema.safeParse(validDecision());
    expect(result.success).toBe(true);
  });

  it('rejects decision text with null byte', () => {
    const d = { ...validDecision(), text: 'Decide\u0000this' };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(false);
  });

  it('rejects owner with null byte', () => {
    const d = { ...validDecision(), owner: 'Bob\u0000Smith' };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(false);
  });

  it('rejects owner exceeding 200 chars', () => {
    const d = { ...validDecision(), owner: 'A'.repeat(201) };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(false);
  });

  it('accepts deadline as null', () => {
    const d = { ...validDecision(), deadline: null };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(true);
  });

  it('accepts resolvedAt as null', () => {
    const d = { ...validDecision(), resolvedAt: null };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(true);
  });

  it('coerces deadline string to Date', () => {
    const d = { ...validDecision(), deadline: '2026-04-15' };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(true);
    if (result.success && result.data.deadline) {
      expect(result.data.deadline).toBeInstanceOf(Date);
    }
  });
});

// ---------------------------------------------------------------------------
// Group 5: submitSectionSchema boundaries
// ---------------------------------------------------------------------------

describe('submitSectionSchema', () => {
  it('accepts valid submit with 3 unique priority ranks', () => {
    const result = submitSectionSchema.safeParse(validSubmit());
    expect(result.success).toBe(true);
  });

  it('rejects submit with duplicate rank values (BUG-002)', () => {
    const submit = {
      ...validSubmit(),
      priorities: [
        validPriority(1),
        validPriority(1),
        validPriority(2),
      ],
    };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });

  it('rejects submit with 0 priorities', () => {
    const submit = { ...validSubmit(), priorities: [] };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });

  it('accepts submit with 1 priority (dynamic: min 1)', () => {
    const submit = {
      ...validSubmit(),
      priorities: [validPriority(1)],
    };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(true);
  });

  it('accepts submit with 5 priorities (dynamic: no upper limit)', () => {
    const submit = {
      ...validSubmit(),
      priorities: [
        validPriority(1),
        validPriority(2),
        validPriority(3),
        validPriority(4),
        validPriority(5),
      ],
    };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(true);
  });

  it('accepts valid traffic light values (green/yellow/red)', () => {
    for (const status of ['green', 'yellow', 'red'] as const) {
      const submit = {
        ...validSubmit(),
        projectStatuses: [{ projectId: PROJECT_UUID, status }],
      };
      const result = submitSectionSchema.safeParse(submit);
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid traffic light value', () => {
    const submit = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID, status: 'blue' }],
    };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });

  it('rejects submit with no traffic light status (BUG-020)', () => {
    const submit = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID }],
    };
    // In submitSectionSchema, status is required (not optional)
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });

  it('requires confirmed to be true', () => {
    const submit = { ...validSubmit(), confirmed: false };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });

  it('requires at least 1 projectStatus', () => {
    const submit = { ...validSubmit(), projectStatuses: [] };
    const result = submitSectionSchema.safeParse(submit);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 6: priorityInputSchema — text validation
// ---------------------------------------------------------------------------

describe('priorityInputSchema', () => {
  it('accepts priority text with visible characters', () => {
    const result = priorityInputSchema.safeParse(validPriority(1));
    expect(result.success).toBe(true);
  });

  it('rejects priority text that is only whitespace', () => {
    const p = { rank: 1, text: '   ' };
    const result = priorityInputSchema.safeParse(p);
    expect(result.success).toBe(false);
  });

  it('rejects priority text that is only zero-width spaces (BUG-013)', () => {
    const p = { rank: 1, text: '\u200B\u200B' };
    const result = priorityInputSchema.safeParse(p);
    expect(result.success).toBe(false);
  });

  it('rejects priority text with null byte', () => {
    const p = { rank: 1, text: 'P1\u0000Task' };
    const result = priorityInputSchema.safeParse(p);
    expect(result.success).toBe(false);
  });

  it('accepts rank at min boundary (1)', () => {
    const result = priorityInputSchema.safeParse({ rank: 1, text: 'Go' });
    expect(result.success).toBe(true);
  });

  it('accepts rank 3', () => {
    const result = priorityInputSchema.safeParse({ rank: 3, text: 'Go' });
    expect(result.success).toBe(true);
  });

  it('accepts rank 10 (dynamic: no upper limit)', () => {
    const result = priorityInputSchema.safeParse({ rank: 10, text: 'Go' });
    expect(result.success).toBe(true);
  });

  it('rejects rank below min (0)', () => {
    const result = priorityInputSchema.safeParse({ rank: 0, text: 'Go' });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer rank (1.5)', () => {
    const result = priorityInputSchema.safeParse({ rank: 1.5, text: 'Go' });
    expect(result.success).toBe(false);
  });

  it('accepts text at max boundary (200 chars)', () => {
    const result = priorityInputSchema.safeParse({ rank: 1, text: 'A'.repeat(200) });
    expect(result.success).toBe(true);
  });

  it('rejects text exceeding max (201 chars)', () => {
    const result = priorityInputSchema.safeParse({ rank: 1, text: 'A'.repeat(201) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 7: Enum schemas
// ---------------------------------------------------------------------------

describe('enum schemas', () => {
  it('trafficLightStatusSchema accepts green/yellow/red', () => {
    expect(trafficLightStatusSchema.safeParse('green').success).toBe(true);
    expect(trafficLightStatusSchema.safeParse('yellow').success).toBe(true);
    expect(trafficLightStatusSchema.safeParse('red').success).toBe(true);
  });

  it('trafficLightStatusSchema rejects unknown value', () => {
    expect(trafficLightStatusSchema.safeParse('blue').success).toBe(false);
    expect(trafficLightStatusSchema.safeParse('').success).toBe(false);
  });

  it('itemTypeSchema accepts current/next', () => {
    expect(itemTypeSchema.safeParse('current').success).toBe(true);
    expect(itemTypeSchema.safeParse('next').success).toBe(true);
  });

  it('itemTypeSchema rejects unknown value', () => {
    expect(itemTypeSchema.safeParse('previous').success).toBe(false);
  });

  it('itemWorkflowStatusSchema accepts done/in_progress/blocked', () => {
    expect(itemWorkflowStatusSchema.safeParse('done').success).toBe(true);
    expect(itemWorkflowStatusSchema.safeParse('in_progress').success).toBe(true);
    expect(itemWorkflowStatusSchema.safeParse('blocked').success).toBe(true);
  });

  it('itemWorkflowStatusSchema rejects unknown value', () => {
    expect(itemWorkflowStatusSchema.safeParse('cancelled').success).toBe(false);
  });

  it('reportSectionStatusSchema accepts draft/submitted', () => {
    expect(reportSectionStatusSchema.safeParse('draft').success).toBe(true);
    expect(reportSectionStatusSchema.safeParse('submitted').success).toBe(true);
  });

  it('reportStatusSchema accepts draft/published', () => {
    expect(reportStatusSchema.safeParse('draft').success).toBe(true);
    expect(reportStatusSchema.safeParse('published').success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group 8: carryOverStatusSchema (BUG-006)
// ---------------------------------------------------------------------------

describe('carryOverStatusSchema (BUG-006)', () => {
  it('accepts "completed"', () => {
    expect(carryOverStatusSchema.safeParse('completed').success).toBe(true);
  });

  it('accepts "pending" (newly added)', () => {
    expect(carryOverStatusSchema.safeParse('pending').success).toBe(true);
  });

  it('accepts "failed" (newly added)', () => {
    expect(carryOverStatusSchema.safeParse('failed').success).toBe(true);
  });

  it('rejects "unknown"', () => {
    expect(carryOverStatusSchema.safeParse('unknown').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(carryOverStatusSchema.safeParse('').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 9: Date validation — reportDate() (BUG-016)
// ---------------------------------------------------------------------------

describe('reportDate via assembledReportSchema (BUG-016)', () => {
  const validAssembled = () => ({
    reportId: uuid(),
    periodStart: '2026-04-01',
    periodEnd: '2026-04-07',
    deadline: '2026-04-05',
    status: 'draft' as const,
    portfolioOverview: {
      status: 'green' as const,
      totals: { green: 3, yellow: 1, red: 0 },
    },
    sections: [],
  });

  it('accepts dates in year 2026', () => {
    const result = assembledReportSchema.safeParse(validAssembled());
    expect(result.success).toBe(true);
  });

  it('accepts date at boundary year 2000', () => {
    const input = {
      ...validAssembled(),
      periodStart: '2000-01-01',
    };
    const result = assembledReportSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects date in year 1999 (before 2000)', () => {
    const input = {
      ...validAssembled(),
      periodStart: '1999-12-31',
    };
    const result = assembledReportSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects date in year 1969 (pre-epoch)', () => {
    const input = {
      ...validAssembled(),
      periodStart: '1969-07-20',
    };
    const result = assembledReportSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects epoch 0 date (1970-01-01, before 2000)', () => {
    const input = {
      ...validAssembled(),
      periodStart: '1970-01-01',
    };
    const result = assembledReportSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('reportDate via reportPeriodSchema', () => {
  const validPeriod = () => ({
    id: uuid(),
    periodStart: '2026-04-01',
    periodEnd: '2026-04-07',
    deadline: '2026-04-05',
    status: 'draft' as const,
  });

  it('accepts valid period with dates in 2026', () => {
    const result = reportPeriodSchema.safeParse(validPeriod());
    expect(result.success).toBe(true);
  });

  it('rejects periodStart before 2000', () => {
    const input = { ...validPeriod(), periodStart: '1998-01-01' };
    const result = reportPeriodSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects periodEnd before 2000', () => {
    const input = { ...validPeriod(), periodEnd: '1995-06-15' };
    const result = reportPeriodSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects deadline before 2000', () => {
    const input = { ...validPeriod(), deadline: '1990-01-01' };
    const result = reportPeriodSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 10: projectStatusInputSchema
// ---------------------------------------------------------------------------

describe('projectStatusInputSchema', () => {
  it('accepts valid projectId with optional status', () => {
    const result = projectStatusInputSchema.safeParse({ projectId: uuid() });
    expect(result.success).toBe(true);
  });

  it('accepts valid projectId with status', () => {
    const result = projectStatusInputSchema.safeParse({
      projectId: uuid(),
      status: 'yellow',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID projectId', () => {
    const result = projectStatusInputSchema.safeParse({
      projectId: 'not-a-uuid',
      status: 'green',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 11: portfolioOverviewSchema
// ---------------------------------------------------------------------------

describe('portfolioOverviewSchema', () => {
  it('accepts valid overview', () => {
    const result = portfolioOverviewSchema.safeParse({
      status: 'green',
      totals: { green: 5, yellow: 2, red: 0 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative totals', () => {
    const result = portfolioOverviewSchema.safeParse({
      status: 'green',
      totals: { green: -1, yellow: 0, red: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer totals', () => {
    const result = portfolioOverviewSchema.safeParse({
      status: 'red',
      totals: { green: 1.5, yellow: 0, red: 0 },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 12: archiveReportSummarySchema — reportDate usage
// ---------------------------------------------------------------------------

describe('archiveReportSummarySchema', () => {
  it('accepts valid archive summary', () => {
    const result = archiveReportSummarySchema.safeParse({
      reportId: uuid(),
      periodStart: '2026-01-01',
      periodEnd: '2026-01-07',
      publishedAt: '2026-01-08',
      publishedByName: 'Alice',
      portfolioStatus: 'green',
    });
    expect(result.success).toBe(true);
  });

  it('rejects publishedAt before 2000', () => {
    const result = archiveReportSummarySchema.safeParse({
      reportId: uuid(),
      periodStart: '2026-01-01',
      periodEnd: '2026-01-07',
      publishedAt: '1999-12-31',
      publishedByName: 'Alice',
      portfolioStatus: 'green',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 13: validateSubmitInput function
// ---------------------------------------------------------------------------

describe('validateSubmitInput', () => {
  const makeSection = (overrides: Partial<ReportSectionReadModel> = {}): ReportSectionReadModel => ({
    reportSectionId: uuid(),
    reportId: uuid(),
    authorId: uuid(),
    authorName: 'Test Lead',
    status: 'draft',
    submittedAt: null,
    projects: [
      {
        projectId: PROJECT_UUID,
        projectName: 'Project Alpha',
        trafficLight: null,
      },
    ],
    items: [],
    risks: [],
    decisions: [],
    priorities: [],
    ...overrides,
  });

  it('returns SECTION_ALREADY_SUBMITTED for submitted section', () => {
    const section = makeSection({ status: 'submitted' });
    const input = validSubmit();
    const errors = validateSubmitInput(section, input as any);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('SECTION_ALREADY_SUBMITTED');
  });

  it('returns MISSING_TRAFFIC_LIGHT when project has no status', () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID }],
      items: [{ ...validItem(), projectId: PROJECT_UUID, type: 'current' as const }],
    };
    const errors = validateSubmitInput(section, input as any);
    expect(errors.some((e) => e.code === 'MISSING_TRAFFIC_LIGHT')).toBe(true);
  });

  it('returns MISSING_CURRENT_ITEM when project has no current items', () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID, status: 'green' as const }],
      items: [],
    };
    const errors = validateSubmitInput(section, input as any);
    expect(errors.some((e) => e.code === 'MISSING_CURRENT_ITEM')).toBe(true);
  });

  it('returns MISSING_PRIORITIES when priorities have blank text', () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID, status: 'green' as const }],
      items: [{ ...validItem(), projectId: PROJECT_UUID, type: 'current' as const }],
      priorities: [
        { rank: 1, text: '  ' },
        { rank: 2, text: 'OK' },
      ],
    };
    const errors = validateSubmitInput(section, input as any);
    expect(errors.some((e) => e.code === 'MISSING_PRIORITIES')).toBe(true);
  });

  it('returns MISSING_PRIORITIES when priorities array is empty', () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID, status: 'green' as const }],
      items: [{ ...validItem(), projectId: PROJECT_UUID, type: 'current' as const }],
      priorities: [],
    };
    const errors = validateSubmitInput(section, input as any);
    expect(errors.some((e) => e.code === 'MISSING_PRIORITIES')).toBe(true);
  });

  it('returns no errors for valid input', () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID, status: 'green' as const }],
      items: [{ ...validItem(), projectId: PROJECT_UUID, type: 'current' as const }],
    };
    const errors = validateSubmitInput(section, input as any);
    expect(errors).toHaveLength(0);
  });
});
