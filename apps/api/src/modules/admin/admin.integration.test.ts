import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  createTestPrisma,
  cleanDatabase,
  seedTestData,
  disconnectTestPrisma,
  TEST_IDS,
} from '../../test-utils/prisma-test-helper';
import { AdminPrismaRepository } from './admin.prisma-repository';
import { expectDefined } from '../../test-utils/expect-defined.js';

describe('AdminPrismaRepository (integration)', () => {
  const prisma = createTestPrisma();
  let repo: AdminPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new AdminPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it('getSnapshot returns users, projects, periods, and rules', async () => {
    // Create a reminder rule
    await prisma.reminderRule.create({
      data: {
        id: TEST_IDS.reminderRule,
        kind: 'deadline',
        fireAt: new Date('2026-04-11T09:00:00.000Z'),
        timezone: 'Europe/Moscow',
        status: 'active',
        version: 1,
        reportId: testData.report.id,
      },
    });

    const snapshot = await repo.getSnapshot();

    expect(snapshot.users.length).toBeGreaterThanOrEqual(2); // head + lead
    expect(snapshot.projects.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.periods.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.reminderRules.length).toBeGreaterThanOrEqual(1);

    // Verify user fields
    const leadUser = snapshot.users.find((u) => u.email === 'lead1@test.local');
    expect(leadUser).toBeDefined();
    expect(expectDefined(leadUser).name).toBe('Test Lead 1');
    expect(expectDefined(leadUser).role).toBe('lead');

    // Verify project fields
    const proj = snapshot.projects.find((p) => p.name === 'Test Project 1');
    expect(proj).toBeDefined();
    expect(expectDefined(proj).leadId).toBe(testData.lead.id);
    expect(expectDefined(proj).leadName).toBe('Test Lead 1');

    // Verify period fields
    const period = snapshot.periods.find((p) => p.id === testData.report.id);
    expect(period).toBeDefined();
    expect(expectDefined(period).status).toBe('draft');
  });

  it('saveSnapshot updates entities correctly', async () => {
    const snapshot = await repo.getSnapshot();

    // Modify the snapshot: update the lead's name
    const updatedUsers = snapshot.users.map((u) =>
      u.id === testData.lead.id ? { ...u, name: 'Updated Lead Name' } : u,
    );

    // Add a new project
    const updatedProjects = [
      ...snapshot.projects,
      {
        id: TEST_IDS.newProject,
        name: 'New Admin Project',
        archived: false,
        leadId: testData.lead.id,
        leadName: 'Updated Lead Name',
      },
    ];

    const updatedSnapshot = {
      ...snapshot,
      users: updatedUsers,
      projects: updatedProjects,
    };

    const saved = await repo.saveSnapshot(updatedSnapshot);

    // Verify the lead name was updated
    const savedLead = saved.users.find((u) => u.id === testData.lead.id);
    expect(expectDefined(savedLead).name).toBe('Updated Lead Name');

    // Verify the new project was created
    const savedProject = saved.projects.find((p) => p.id === TEST_IDS.newProject);
    expect(savedProject).toBeDefined();
    expect(expectDefined(savedProject).name).toBe('New Admin Project');
  });

  // -------------------------------------------------------------------
  // UFB-054 (Phase 56-B): Group ↔ Product M:M repository methods
  //
  // The seeded `lead` user belongs to `group`; the seeded `project` is
  // led by that user. After the 56-A backfill there is one auto-created
  // `GroupProduct` row mapping the seeded group to the seeded project.
  // These tests assert the four explicit-mutation methods behave
  // idempotently against that real baseline.
  // -------------------------------------------------------------------

  it('attachProductToGroup is idempotent and detach removes the edge (UFB-054)', async () => {
    // The seed test cleanDatabase wipes GroupProduct too if the helper
    // is up to date; we explicitly cleanup edges for this scenario.
    await prisma.groupProduct.deleteMany({});

    const attached = await repo.attachProductToGroup({
      groupId: testData.lead.reportingGroupId,
      productId: testData.project.id,
    });
    expect(attached.groupId).toBe(testData.lead.reportingGroupId);
    expect(attached.productId).toBe(testData.project.id);

    // Re-attach returns the same logical row (same tuple) — idempotent.
    const reattached = await repo.attachProductToGroup({
      groupId: testData.lead.reportingGroupId,
      productId: testData.project.id,
    });
    expect(reattached.id).toBe(attached.id);

    // listProductGroups and listGroupProducts reflect the edge.
    const groupsForProduct = await repo.listProductGroups(
      testData.project.id,
    );
    expect(groupsForProduct.map((g) => g.id)).toContain(
      testData.lead.reportingGroupId,
    );

    const productsForGroup = await repo.listGroupProducts(
      testData.lead.reportingGroupId,
    );
    expect(productsForGroup.map((p) => p.id)).toContain(testData.project.id);

    // Detach is a no-op safe operation.
    await repo.detachProductFromGroup({
      groupId: testData.lead.reportingGroupId,
      productId: testData.project.id,
    });
    await repo.detachProductFromGroup({
      groupId: testData.lead.reportingGroupId,
      productId: testData.project.id,
    });

    const after = await repo.listProductGroups(testData.project.id);
    expect(after.map((g) => g.id)).not.toContain(
      testData.lead.reportingGroupId,
    );
  });
});
