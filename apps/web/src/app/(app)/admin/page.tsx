'use client';

import { Alert, AlertDescription, AlertTitle } from '@customreport/ui';
import type {
  AdminProject,
  AdminReminderRule,
  AdminUser,
  ReportPeriod,
} from '@customreport/shared';
import { AlertCircle } from 'lucide-react';

import { trpc } from '../../../lib/trpc';
import { QueryError } from '../../../components/common/query-error';
import { AppShell } from '../../../components/navigation/app-shell';
import { AdminPanel } from '../../../components/admin/admin-panel';
import {
  PageTitleSkeleton,
  TableSkeleton,
} from '../../../components/common/page-skeleton';

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

  if (snapshotQuery.isLoading)
    return (
      <AppShell activeReportId={null} currentPath="/admin" role="head">
        <div className="space-y-6">
          <PageTitleSkeleton />
          <TableSkeleton />
        </div>
      </AppShell>
    );

  if (snapshotQuery.isError)
    return (
      <AppShell activeReportId={null} currentPath="/admin" role="head">
        <QueryError
          error={snapshotQuery.error}
          onRetry={() => snapshotQuery.refetch()}
        />
      </AppShell>
    );

  const snapshot = snapshotQuery.data;

  if (!snapshot)
    return (
      <AppShell activeReportId={null} currentPath="/admin" role="head">
        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>No data</AlertTitle>
              <AlertDescription>
                No admin data available. Check that the server is running
                and try again.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </AppShell>
    );

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
