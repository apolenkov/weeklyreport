import { describe, expect, it } from 'vitest';

import type {
  AdminSnapshot,
  UserSession,
} from '@customreport/shared';

import { adminRouter } from './admin.router';
import {
  AdminAccessError,
  AdminService,
  type AdminRepository,
} from './admin.service';

const headSession: UserSession = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'head@customreport.local',
  name: 'Department Head',
  role: 'head',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: null,
};

const leadSession: UserSession = {
  userId: '33333333-3333-4333-8333-333333333333',
  email: 'lead1@customreport.local',
  name: 'Lead 1',
  role: 'lead',
  activeReportId: '22222222-2222-4222-8222-222222222222',
  activeReportSectionId: '11111111-1111-4111-8111-111111111111',
};

const initialSnapshot: AdminSnapshot = {
  users: [
    {
      id: headSession.userId,
      email: headSession.email,
      name: headSession.name,
      role: 'head',
    },
  ],
  projects: [],
  periods: [],
  reminderRules: [],
  reminderExecutions: [],
};

function createRepository(snapshot: AdminSnapshot): AdminRepository {
  let currentSnapshot = structuredClone(snapshot);

  return {
    async getSnapshot() {
      return structuredClone(currentSnapshot);
    },
    async saveSnapshot(nextSnapshot) {
      currentSnapshot = structuredClone(nextSnapshot);
      return structuredClone(currentSnapshot);
    },
  };
}

describe('AdminService', () => {
  it('adds and removes users', async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    const withLead = await service.upsertUser({
      email: leadSession.email,
      id: leadSession.userId,
      name: leadSession.name,
      role: 'lead',
    });

    expect(withLead.users).toHaveLength(2);

    const withoutLead = await service.removeUser(leadSession.userId);

    expect(withoutLead.users).toHaveLength(1);
  });

  it('creates projects, periods, and reminder rules', async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    const withProject = await service.upsertProject({
      archived: false,
      id: '44444444-4444-4444-8444-444444444444',
      leadId: leadSession.userId,
      leadName: leadSession.name,
      name: 'Project 1',
    });
    const withPeriod = await service.upsertPeriod({
      deadline: new Date('2026-04-17T15:00:00.000Z'),
      id: '55555555-5555-4555-8555-555555555555',
      periodEnd: new Date('2026-04-19T23:59:59.000Z'),
      periodStart: new Date('2026-04-13T00:00:00.000Z'),
      status: 'draft',
    });
    const withRule = await service.upsertReminderRule({
      fireAt: new Date('2026-04-17T09:00:00.000Z'),
      id: '66666666-6666-4666-8666-666666666666',
      kind: 'deadline',
      reportId: '55555555-5555-4555-8555-555555555555',
      status: 'active',
      timezone: 'Europe/Moscow',
      version: 1,
    });

    expect(withProject.projects).toHaveLength(1);
    expect(withPeriod.periods).toHaveLength(1);
    expect(withRule.reminderRules).toHaveLength(1);
  });

  it('rejects non-head access in the router layer', async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    await expect(
      adminRouter.getSnapshot({ adminService: service, session: leadSession }),
    ).rejects.toBeInstanceOf(AdminAccessError);
  });
});

  describe('removeUser — DB deletion via repository', () => {
    it('removes the user from the snapshot users list', async () => {
      const snapshotWithLead: AdminSnapshot = {
        ...initialSnapshot,
        users: [
          ...initialSnapshot.users,
          {
            id: leadSession.userId,
            email: leadSession.email,
            name: leadSession.name,
            role: 'lead',
          },
        ],
      };
      const service = new AdminService(createRepository(snapshotWithLead));
      const result = await service.removeUser(leadSession.userId);

      // Verify the user was removed from the snapshot
      expect(result.users).toHaveLength(1);
      expect(result.users.find((u) => u.id === leadSession.userId)).toBeUndefined();
    });

    it('preserves other users when one is removed', async () => {
      const snapshotWithMultipleUsers: AdminSnapshot = {
        ...initialSnapshot,
        users: [
          ...initialSnapshot.users,
          {
            id: leadSession.userId,
            email: leadSession.email,
            name: leadSession.name,
            role: 'lead',
          },
          {
            id: '44444444-4444-4444-8444-444444444444',
            email: 'lead2@customreport.local',
            name: 'Lead 2',
            role: 'lead',
          },
        ],
      };
      const service = new AdminService(createRepository(snapshotWithMultipleUsers));
      const result = await service.removeUser(leadSession.userId);

      expect(result.users).toHaveLength(2);
      expect(result.users.find((u) => u.id === leadSession.userId)).toBeUndefined();
      expect(result.users.find((u) => u.email === 'lead2@customreport.local')).toBeDefined();
    });

    it('handles removal of non-existent user gracefully (no-op)', async () => {
      const service = new AdminService(createRepository(initialSnapshot));
      const result = await service.removeUser('99999999-9999-4999-8999-999999999999');

      // User didn't exist, so snapshot remains unchanged
      expect(result.users).toHaveLength(1);
    });
  });

  describe('removeProject — archive behavior', () => {
    it('archives the project instead of deleting it', async () => {
      const snapshotWithProject: AdminSnapshot = {
        ...initialSnapshot,
        projects: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            name: 'Project 1',
            archived: false,
            leadId: headSession.userId,
            leadName: headSession.name,
          },
        ],
      };
      const service = new AdminService(createRepository(snapshotWithProject));
      const result = await service.removeProject('44444444-4444-4444-8444-444444444444');

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0]?.archived).toBe(true);
    });
  });

  describe('removeReminderRule — deletion', () => {
    it('removes the reminder rule from the snapshot', async () => {
      const snapshotWithRule: AdminSnapshot = {
        ...initialSnapshot,
        reminderRules: [
          {
            id: '66666666-6666-4666-8666-666666666666',
            reportId: '22222222-2222-4222-8222-222222222222',
            kind: 'deadline',
            fireAt: new Date('2026-04-17T09:00:00.000Z'),
            timezone: 'Europe/Moscow',
            status: 'active',
            version: 1,
          },
        ],
      };
      const service = new AdminService(createRepository(snapshotWithRule));
      const result = await service.removeReminderRule('66666666-6666-4666-8666-666666666666');

      expect(result.reminderRules).toHaveLength(0);
    });
  });

describe('adminRouter', () => {
  it('returns the admin snapshot for head users', async () => {
    const service = new AdminService(createRepository(initialSnapshot));

    await expect(
      adminRouter.getSnapshot({ adminService: service, session: headSession }),
    ).resolves.toMatchObject({ users: [{ role: 'head' }] });
  });
});
