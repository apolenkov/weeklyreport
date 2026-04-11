'use client';

import { trpc } from '../../../lib/trpc';
import { QueryError } from '../../../components/common/query-error';
import { AppShell } from '../../../components/navigation/app-shell';
import { AdminPanel } from '../../../components/admin/admin-panel';
import type {
  AdminProject,
  AdminReminderRule,
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

  const snapshot = snapshotQuery.data;

  if (!snapshot) return <p>No admin data available.</p>;

  async function handleUpsertUser(user: AdminUser) {
    await saveUserMutation.mutateAsync(user);
    return utils.admin.snapshot.fetch();
  }

  async function handleRemoveUser(userId: string) {
    await deleteUserMutation.mutateAsync({ userId });
    return utils.admin.snapshot.fetch();
  }

  async function handleUpsertProject(project: AdminProject) {
    await saveProjectMutation.mutateAsync(project);
    return utils.admin.snapshot.fetch();
  }

  async function handleUpsertPeriod(period: ReportPeriod) {
    await savePeriodMutation.mutateAsync(period);
    return utils.admin.snapshot.fetch();
  }

  async function handleUpsertReminderRule(rule: AdminReminderRule) {
    await saveReminderRuleMutation.mutateAsync(rule);
    return utils.admin.snapshot.fetch();
  }

  async function handleRequestReminderExecution(
    ruleId: string,
    recipientEmail: string,
  ) {
    await executeReminderMutation.mutateAsync({ ruleId, recipientEmail });
    return utils.admin.snapshot.fetch();
  }

  async function handleRunCarryOver(): Promise<boolean> {
    if (!snapshot) return false;
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
