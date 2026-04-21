import { describe, expect, it } from 'vitest';

import type {
  CarryOverExecution,
  CarryOverRecord,
  ReportSectionReadModel,
} from '@customreport/shared';

import {
  CarryOverDomainError,
  CarryOverService,
  type CarryOverRepository,
  type CarryOverResult,
} from './carry-over.service';

// ---------------------------------------------------------------------------
// Fixture IDs
// ---------------------------------------------------------------------------

const sourceReportId = 'aaaa0000-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const targetReportId = 'bbbb0000-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const leadAlphaId = '11110000-1111-4111-8111-111111111111';
const leadBetaId = '22220000-2222-4222-8222-222222222222';
const leadGammaId = '33330000-3333-4333-8333-333333333333';

const projectAlphaId = 'cccc0000-cccc-4ccc-8ccc-cccccccccccc';
const projectBetaId = 'dddd0000-dddd-4ddd-8ddd-dddddddddddd';

// ---------------------------------------------------------------------------
// Fixture section builder
// ---------------------------------------------------------------------------

function makeSection(overrides: Partial<ReportSectionReadModel> & {
  reportSectionId: string;
  reportId: string;
  authorId: string;
  authorName: string;
}): ReportSectionReadModel {
  return {
    status: 'submitted',
    submittedAt: new Date('2026-04-09T10:00:00.000Z'),
    projects: [
      {
        projectId: projectAlphaId,
        projectName: 'Project Alpha',
        trafficLight: 'green',
      },
    ],
    items: [],
    risks: [],
    decisions: [],
    priorities: [
      { id: crypto.randomUUID(), rank: 1, text: 'Priority one' },
      { id: crypto.randomUUID(), rank: 2, text: 'Priority two' },
      { id: crypto.randomUUID(), rank: 3, text: 'Priority three' },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Source sections with varied item types
// ---------------------------------------------------------------------------

const sourceAlpha: ReportSectionReadModel = makeSection({
  reportSectionId: 'a1a10000-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
  reportId: sourceReportId,
  authorId: leadAlphaId,
  authorName: 'Lead Alpha',
  items: [
    {
      id: 'e1e10000-e1e1-4e1e-8e1e-e1e1e1e1e1e1',
      projectId: projectAlphaId,
      type: 'next',
      text: 'Alpha next item — should carry',
      tag: 'feature',
      workflowStatus: 'in_progress',
      carriedOver: false,
    },
    {
      id: 'e2e20000-e2e2-4e2e-8e2e-e2e2e2e2e2e2',
      projectId: projectAlphaId,
      type: 'current',
      text: 'Alpha current item — should NOT carry',
      tag: 'support',
      workflowStatus: 'done',
      carriedOver: false,
    },
    {
      id: 'e3e30000-e3e3-4e3e-8e3e-e3e3e3e3e3e3',
      projectId: projectAlphaId,
      type: 'next',
      text: 'Alpha already-carried next — should NOT carry again',
      tag: 'tech-debt',
      workflowStatus: 'in_progress',
      carriedOver: true,
    },
  ],
  decisions: [
    {
      id: 'f1f10000-f1f1-4f1f-8f1f-f1f1f1f1f1f1',
      text: 'Unresolved decision alpha',
      owner: 'Department Head',
      deadline: null,
      impact: 'Needs escalation',
      resolvedAt: null,
    },
    {
      id: 'f2f20000-f2f2-4f2f-8f2f-f2f2f2f2f2f2',
      text: 'Resolved decision alpha',
      owner: 'Department Head',
      deadline: new Date('2026-04-01T00:00:00.000Z'),
      impact: 'Already handled',
      resolvedAt: new Date('2026-04-05T12:00:00.000Z'),
    },
  ],
});

const sourceBeta: ReportSectionReadModel = makeSection({
  reportSectionId: 'b1b10000-b1b1-4b1b-8b1b-b1b1b1b1b1b1',
  reportId: sourceReportId,
  authorId: leadBetaId,
  authorName: 'Lead Beta',
  projects: [
    {
      projectId: projectBetaId,
      projectName: 'Project Beta',
      trafficLight: 'yellow',
    },
  ],
  items: [
    {
      id: 'e4e40000-e4e4-4e4e-8e4e-e4e4e4e4e4e4',
      projectId: projectBetaId,
      type: 'next',
      text: 'Beta next item — should carry',
      tag: 'bugfix',
      workflowStatus: 'blocked',
      carriedOver: false,
    },
  ],
  decisions: [
    {
      id: 'f3f30000-f3f3-4f3f-8f3f-f3f3f3f3f3f3',
      text: 'Unresolved decision beta',
      owner: 'Lead Beta',
      deadline: new Date('2026-05-01T00:00:00.000Z'),
      impact: 'Blocks deployment',
      resolvedAt: null,
    },
  ],
});

const sourceGamma: ReportSectionReadModel = makeSection({
  reportSectionId: 'c1c10000-c1c1-4c1c-8c1c-c1c1c1c1c1c1',
  reportId: sourceReportId,
  authorId: leadGammaId,
  authorName: 'Lead Gamma',
  items: [
    {
      id: 'e5e50000-e5e5-4e5e-8e5e-e5e5e5e5e5e5',
      projectId: projectAlphaId,
      type: 'next',
      text: 'Gamma next item — should carry',
      tag: 'infra',
      workflowStatus: 'in_progress',
      carriedOver: false,
    },
  ],
  decisions: [],
});

// ---------------------------------------------------------------------------
// In-memory repository factory
// ---------------------------------------------------------------------------

function createInMemoryRepository(opts: {
  sourceSections: ReportSectionReadModel[];
  targetSections: ReportSectionReadModel[];
}): CarryOverRepository {
  const executions = new Map<string, CarryOverExecution>();
  const savedRecords: CarryOverRecord[] = [];

  return {
    async findExecutionByDedupeKey(dedupeKey: string): Promise<CarryOverExecution | null> {
      for (const execution of executions.values()) {
        if (execution.dedupeKey === dedupeKey) {
          return structuredClone(execution);
        }
      }
      return null;
    },

    async getSourceSections(): Promise<ReportSectionReadModel[]> {
      return opts.sourceSections.map((s) => structuredClone(s));
    },

    async getTargetSections(): Promise<ReportSectionReadModel[]> {
      return opts.targetSections.map((s) => structuredClone(s));
    },

    async saveCarryOver(
      execution: CarryOverExecution,
      records: CarryOverRecord[],
      targetSection: ReportSectionReadModel,
    ): Promise<CarryOverResult> {
      executions.set(execution.id, structuredClone(execution));
      savedRecords.push(...structuredClone(records));
      return {
        execution: structuredClone(execution),
        records: structuredClone(records),
        targetSection: structuredClone(targetSection),
      };
    },
  };
}

function makeTargetSection(source: ReportSectionReadModel): ReportSectionReadModel {
  return makeSection({
    reportSectionId: crypto.randomUUID(),
    reportId: targetReportId,
    authorId: source.authorId,
    authorName: source.authorName,
    status: 'draft',
    submittedAt: null,
    projects: structuredClone(source.projects),
    items: [],
    decisions: [],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CarryOverService — contract tests', () => {
  // -----------------------------------------------------------------------
  // Validation / guard clauses
  // -----------------------------------------------------------------------

  it('throws when source === target report', async () => {
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [makeTargetSection(sourceAlpha)],
    });
    const service = new CarryOverService(repo);

    await expect(
      service.executeCarryOver(sourceReportId, sourceReportId),
    ).rejects.toThrow(CarryOverDomainError);

    await expect(
      service.executeCarryOver(sourceReportId, sourceReportId),
    ).rejects.toThrow('Carry-over requires different source and target reports.');
  });

  it('throws when no source sections', async () => {
    const repo = createInMemoryRepository({
      sourceSections: [],
      targetSections: [makeTargetSection(sourceAlpha)],
    });
    const service = new CarryOverService(repo);

    await expect(
      service.executeCarryOver(sourceReportId, targetReportId),
    ).rejects.toThrow(CarryOverDomainError);

    await expect(
      service.executeCarryOver(sourceReportId, targetReportId),
    ).rejects.toThrow('Carry-over requires both source and target sections.');
  });

  it('throws when no target sections', async () => {
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [],
    });
    const service = new CarryOverService(repo);

    await expect(
      service.executeCarryOver(sourceReportId, targetReportId),
    ).rejects.toThrow(CarryOverDomainError);

    await expect(
      service.executeCarryOver(sourceReportId, targetReportId),
    ).rejects.toThrow('Carry-over requires both source and target sections.');
  });

  // -----------------------------------------------------------------------
  // Item carry-over logic
  // -----------------------------------------------------------------------

  it('carries `next` items as `current` with carriedOver=true', async () => {
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    // sourceAlpha has 1 eligible next item (non-carried-over)
    const carriedItems = result.targetSection.items.filter((i) => i.carriedOver);
    expect(carriedItems).toHaveLength(1);
    expect(carriedItems[0]!.text).toBe('Alpha next item — should carry');
    expect(carriedItems[0]!.type).toBe('current');
    expect(carriedItems[0]!.carriedOver).toBe(true);
  });

  it('does NOT carry `current` items', async () => {
    // sourceAlpha has a current item: "Alpha current item — should NOT carry"
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    const currentTexts = result.targetSection.items.map((i) => i.text);
    expect(currentTexts).not.toContain('Alpha current item — should NOT carry');
  });

  it('does NOT carry already carried-over items', async () => {
    // sourceAlpha has a next item with carriedOver=true: should be skipped
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    const texts = result.targetSection.items.map((i) => i.text);
    expect(texts).not.toContain('Alpha already-carried next — should NOT carry again');
    // Only the 1 eligible next item should appear
    expect(result.targetSection.items).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Decision carry-over logic
  // -----------------------------------------------------------------------

  it('carries unresolved decisions (resolvedAt === null)', async () => {
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    const carriedDecisions = result.targetSection.decisions;
    expect(carriedDecisions).toHaveLength(1);
    expect(carriedDecisions[0]!.text).toBe('Unresolved decision alpha');
    expect(carriedDecisions[0]!.resolvedAt).toBeNull();
  });

  it('does NOT carry resolved decisions', async () => {
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    const decisionTexts = result.targetSection.decisions.map((d) => d.text);
    expect(decisionTexts).not.toContain('Resolved decision alpha');
  });

  // -----------------------------------------------------------------------
  // Deduplication / idempotency
  // -----------------------------------------------------------------------

  it('deduplicates: returns existing execution on second call', async () => {
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo);

    const first = await service.executeCarryOver(sourceReportId, targetReportId);
    const second = await service.executeCarryOver(sourceReportId, targetReportId);

    // Same execution ID returned
    expect(second.execution.id).toBe(first.execution.id);
    expect(second.execution.dedupeKey).toBe(`${sourceReportId}:${targetReportId}`);
    // Idempotent replay returns empty records
    expect(second.records).toHaveLength(0);
    // First call should have created records
    expect(first.records.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // Multi-section / authorId matching
  // -----------------------------------------------------------------------

  it('matches sections by authorId', async () => {
    const targetAlpha = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [targetAlpha],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    // Target section matched via authorId — items and decisions appear
    expect(result.targetSection.authorId).toBe(leadAlphaId);
    expect(result.targetSection.items.length).toBeGreaterThan(0);
    expect(result.targetSection.decisions.length).toBeGreaterThan(0);
  });

  it('handles multiple sections from different leads', async () => {
    const targetAlpha = makeTargetSection(sourceAlpha);
    const targetBeta = makeTargetSection(sourceBeta);
    const targetGamma = makeTargetSection(sourceGamma);

    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha, sourceBeta, sourceGamma],
      targetSections: [targetAlpha, targetBeta, targetGamma],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    // sourceAlpha: 1 next item + 1 unresolved decision = 2 records
    // sourceBeta: 1 next item + 1 unresolved decision = 2 records
    // sourceGamma: 1 next item + 0 decisions = 1 record
    // Total: 5 records
    expect(result.records).toHaveLength(5);
    expect(result.execution.carriedItemCount).toBe(3);
    expect(result.execution.carriedDecisionCount).toBe(2);
    expect(result.execution.status).toBe('completed');
  });

  // -----------------------------------------------------------------------
  // Edge case: empty items/decisions
  // -----------------------------------------------------------------------

  it('empty items/decisions = 0 carried counts', async () => {
    // Source section with only current items and only resolved decisions
    const sourceEmpty: ReportSectionReadModel = makeSection({
      reportSectionId: 'd1d10000-d1d1-4d1d-8d1d-d1d1d1d1d1d1',
      reportId: sourceReportId,
      authorId: leadAlphaId,
      authorName: 'Lead Alpha',
      items: [
        {
          id: 'e6e60000-e6e6-4e6e-8e6e-e6e6e6e6e6e6',
          projectId: projectAlphaId,
          type: 'current',
          text: 'Only current item here',
          tag: 'support',
          workflowStatus: 'done',
          carriedOver: false,
        },
      ],
      decisions: [
        {
          id: 'f4f40000-f4f4-4f4f-8f4f-f4f4f4f4f4f4',
          text: 'Already resolved decision',
          owner: 'Lead Alpha',
          deadline: null,
          impact: 'Done',
          resolvedAt: new Date('2026-04-01T12:00:00.000Z'),
        },
      ],
    });

    const target = makeTargetSection(sourceEmpty);
    const repo = createInMemoryRepository({
      sourceSections: [sourceEmpty],
      targetSections: [target],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    expect(result.execution.carriedItemCount).toBe(0);
    expect(result.execution.carriedDecisionCount).toBe(0);
    expect(result.records).toHaveLength(0);
    // Target section should have no carried items or decisions
    expect(result.targetSection.items).toHaveLength(0);
    expect(result.targetSection.decisions).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // P0/P1 Regression — carry-over edge cases (EDGE-SM-020..024)
  // -----------------------------------------------------------------------

  it('carry-over creates items in target section (EDGE-SM-020)', async () => {
    const target = makeTargetSection(sourceAlpha);
    expect(target.items).toHaveLength(0); // target starts empty

    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    // Target section now has carried items
    expect(result.targetSection.items.length).toBeGreaterThan(0);
  });

  it('carry-over marks items as carriedOver=true (EDGE-SM-022)', async () => {
    const target = makeTargetSection(sourceAlpha);
    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha],
      targetSections: [target],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    // All items in target from carry-over should be marked carriedOver
    const carriedItems = result.targetSection.items.filter((i) => i.carriedOver);
    expect(carriedItems.length).toBeGreaterThan(0);
    expect(result.targetSection.items.every((i) => i.carriedOver)).toBe(true);
  });

  it('carry-over with source having no eligible items produces 0 items (EDGE-SM-024)', async () => {
    // Source with only current items (no next items to carry)
    const sourceNoNext: ReportSectionReadModel = makeSection({
      reportSectionId: 'x1x10000-x1x1-4x1x-8x1x-x1x1x1x1x1x1',
      reportId: sourceReportId,
      authorId: leadAlphaId,
      authorName: 'Lead Alpha',
      items: [
        {
          id: 'e7e70000-e7e7-4e7e-8e7e-e7e7e7e7e7e7',
          projectId: projectAlphaId,
          type: 'current',
          text: 'Current only',
          tag: 'feature',
          workflowStatus: 'done',
          carriedOver: false,
        },
      ],
      decisions: [],
    });
    const target = makeTargetSection(sourceNoNext);
    const repo = createInMemoryRepository({
      sourceSections: [sourceNoNext],
      targetSections: [target],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    expect(result.execution.carriedItemCount).toBe(0);
    expect(result.execution.carriedDecisionCount).toBe(0);
    expect(result.targetSection.items).toHaveLength(0);
  });

  it('sets carriedItemCount and carriedDecisionCount correctly', async () => {
    const targetAlpha = makeTargetSection(sourceAlpha);
    const targetBeta = makeTargetSection(sourceBeta);

    const repo = createInMemoryRepository({
      sourceSections: [sourceAlpha, sourceBeta],
      targetSections: [targetAlpha, targetBeta],
    });
    const service = new CarryOverService(repo);

    const result = await service.executeCarryOver(sourceReportId, targetReportId);

    // sourceAlpha: 1 eligible next item, 1 unresolved decision
    // sourceBeta:  1 eligible next item, 1 unresolved decision
    expect(result.execution.carriedItemCount).toBe(2);
    expect(result.execution.carriedDecisionCount).toBe(2);

    // Total records = 2 items + 2 decisions = 4
    expect(result.records).toHaveLength(4);

    // Verify record structure — each record has the right source/target report IDs
    for (const record of result.records) {
      expect(record.sourceReportId).toBe(sourceReportId);
      expect(record.targetReportId).toBe(targetReportId);
      expect(record.status).toBe('completed');
      expect(record.carriedAt).toBeInstanceOf(Date);
    }

    // Item records have sourceItemId + targetItemId set, decision fields null
    const itemRecords = result.records.filter((r) => r.sourceItemId !== null);
    expect(itemRecords).toHaveLength(2);
    for (const r of itemRecords) {
      expect(r.targetItemId).not.toBeNull();
      expect(r.sourceDecisionId).toBeNull();
      expect(r.targetDecisionId).toBeNull();
    }

    // Decision records have sourceDecisionId + targetDecisionId set, item fields null
    const decisionRecords = result.records.filter((r) => r.sourceDecisionId !== null);
    expect(decisionRecords).toHaveLength(2);
    for (const r of decisionRecords) {
      expect(r.targetDecisionId).not.toBeNull();
      expect(r.sourceItemId).toBeNull();
      expect(r.targetItemId).toBeNull();
    }
  });
});
