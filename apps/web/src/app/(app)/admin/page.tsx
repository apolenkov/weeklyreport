'use client';

import { trpc } from '../../../lib/trpc';
import { QueryError } from '../../../components/common/query-error';
import { AppShell } from '../../../components/navigation/app-shell';
import { AdminPanel } from '../../../components/admin/admin-panel';
import type {
  AdminProject,
  AdminReminderRule,
  AdminSnapshot,
  AdminUser,
  ReportPeriod,
} from '@customreport/shared';

export default function AdminPage() {
  const snapshotQuery = trpc.admin.snapshot.useQuery();
  const utils = trpc.useUtils();

  const saveUserMutation = trpc.admin.saveUser.useMutation({
    onSuccess: () => utils.admin.snapshot.invalidate(),
  });
  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => utils.admin.snapshot.invalidate(),
  });
  const saveProjectMutation = trpc.admin.saveProject.useMutation({
    onSuccess: () => utils.admin.snapshot.invalidate(),
  });
  const savePeriodMutation = trpc.admin.savePeriod.useMutation({
    onSuccess: () => utils.admin.snapshot.invalidate(),
  });
  const saveReminderRuleMutation = trpc.admin.saveReminderRule.useMutation({
    onSuccess: () => utils.admin.snapshot.invalidate(),
  });
  const executeReminderMutation = trpc.reminders.execute.useMutation({
    onSuccess: () => utils.admin.snapshot.invalidate(),
  });
  const carryOverMutation = trpc.carryOver.execute.useMutation();

  if (snapshotQuery.isLoading) return <p>Loading...</p>;
  if (snapshotQuery.isError)
    return (
      <QueryError
        error={snapshotQuery.error}
        onRetry={() => snapshotQuery.refetch()}
      />
    );

  const snapshot = snapshotQuery.data as AdminSnapshot;

  async function handleUpsertUser(user: AdminUser): Promise<AdminSnapshot> {
    await saveUserMutation.mutateAsync(user);
    const fresh = await utils.admin.snapshot.fetch();
    return fresh as AdminSnapshot;
  }

  async function handleRemoveUser(userId: string): Promise<AdminSnapshot> {
    await deleteUserMutation.mutateAsync({ userId });
    const fresh = await utils.admin.snapshot.fetch();
    return fresh as AdminSnapshot;
  }

  async function handleUpsertProject(
    project: AdminProject,
  ): Promise<AdminSnapshot> {
    await saveProjectMutation.mutateAsync(project);
    const fresh = await utils.admin.snapshot.fetch();
    return fresh as AdminSnapshot;
  }

  async function handleUpsertPeriod(
    period: ReportPeriod,
  ): Promise<AdminSnapshot> {
    await savePeriodMutation.mutateAsync(period);
    const fresh = await utils.admin.snapshot.fetch();
    return fresh as AdminSnapshot;
  }

  async function handleUpsertReminderRule(
    rule: AdminReminderRule,
  ): Promise<AdminSnapshot> {
    await saveReminderRuleMutation.mutateAsync(rule);
    const fresh = await utils.admin.snapshot.fetch();
    return fresh as AdminSnapshot;
  }

  async function handleRequestReminderExecution(
    ruleId: string,
    recipientEmail: string,
  ): Promise<AdminSnapshot> {
    await executeReminderMutation.mutateAsync({ ruleId, recipientEmail });
    const fresh = await utils.admin.snapshot.fetch();
    return fresh as AdminSnapshot;
  }

  async function handleRunCarryOver(): Promise<boolean> {
    const periods = snapshot.periods;
    if (periods.length < 2) return false;

    const sourceReportId = periods[periods.length - 2]?.id;
    const targetReportId = periods[periods.length - 1]?.id;
    if (!sourceReportId || !targetReportId) return false;

    try {
      await carryOverMutation.mutateAsync({ sourceReportId, targetReportId });
      return true;
    } catch {
      return false;
    }
  }

  return (
    <AppShell activeReportId={null} currentPath="/admin" role="head">
      <AdminPanel
        initialSnapshot={snapshot}
        onRemoveUser={handleRemoveUser}
        onRunCarryOver={handleRunCarryOver}
        onRequestReminderExecution={handleRequestReminderExecution}
        onUpsertPeriod={handleUpsertPeriod}
        onUpsertProject={handleUpsertProject}
        onUpsertReminderRule={handleUpsertReminderRule}
        onUpsertUser={handleUpsertUser}
      />
    </AppShell>
  );
}
