'use client';

import { AppShell } from '../../../components/navigation/app-shell';
import { AdminPanel } from '../../../components/admin/admin-panel';
import {
  defaultSnapshot,
  markAdminReminderSent,
  persistAdminSnapshot,
  readAdminSnapshot,
  removeAdminUser,
  requestAdminReminderExecution,
  upsertAdminProject,
  upsertAdminReminderRule,
  upsertAdminUser,
  upsertReportPeriod,
} from '../../../components/admin/admin-runtime';
import {
  buildCarriedOverLeadSection,
  persistLeadSection,
  readStoredLeadSection,
} from '../../../components/report-section/section-storage';
import { defaultHeadSession, readBrowserSession } from '../../../lib/dev-session';
import { useBrowserState } from '../../../lib/use-browser-state';
import type {
  AdminProject,
  AdminReminderRule,
  AdminUser,
  ReportPeriod,
} from '@customreport/shared';

export default function AdminPage() {
  const [session] = useBrowserState(defaultHeadSession, () => readBrowserSession(defaultHeadSession));
  const [snapshot, setSnapshot] = useBrowserState(defaultSnapshot, readAdminSnapshot);

  async function handleUpsertUser(user: AdminUser) {
    const next = persistAdminSnapshot(upsertAdminUser(snapshot, user));
    setSnapshot(next);
    return next;
  }

  async function handleRemoveUser(userId: string) {
    const next = persistAdminSnapshot(removeAdminUser(snapshot, userId));
    setSnapshot(next);
    return next;
  }

  async function handleUpsertProject(project: AdminProject) {
    const next = persistAdminSnapshot(upsertAdminProject(snapshot, project));
    setSnapshot(next);
    return next;
  }

  async function handleUpsertPeriod(period: ReportPeriod) {
    const next = persistAdminSnapshot(upsertReportPeriod(snapshot, period));
    setSnapshot(next);
    return next;
  }

  async function handleUpsertReminderRule(rule: AdminReminderRule) {
    const next = persistAdminSnapshot(upsertAdminReminderRule(snapshot, rule));
    setSnapshot(next);
    return next;
  }

  async function handleRequestReminderExecution(
    ruleId: string,
    recipientEmail: string,
  ) {
    const queuedSnapshot = persistAdminSnapshot(
      requestAdminReminderExecution(snapshot, ruleId, recipientEmail),
    );
    setSnapshot(queuedSnapshot);

    const latestExecution = queuedSnapshot.reminderExecutions
      .filter((row) => row.ruleId === ruleId)
      .at(-1);

    if (!latestExecution) {
      return queuedSnapshot;
    }

    const sentSnapshot = persistAdminSnapshot(
      markAdminReminderSent(queuedSnapshot, latestExecution.id),
    );
    setSnapshot(sentSnapshot);

    return sentSnapshot;
  }

  async function handleRunCarryOver() {
    const nextPeriod = snapshot.periods.at(-1);

    if (!nextPeriod) {
      return false;
    }

    const sourceSection = readStoredLeadSection();
    const carriedSection = buildCarriedOverLeadSection(sourceSection, nextPeriod.id);
    const existingSection = readStoredLeadSection();
    const hasMatchingCarryOver = existingSection.reportId === nextPeriod.id
      && existingSection.items.some((item) => item.carriedOver);

    if (hasMatchingCarryOver) {
      return true;
    }

    persistLeadSection(carriedSection);
    return true;
  }

  return (
    <AppShell activeReportId={session.activeReportId} currentPath="/admin" role={session.role}>
      {session.role !== 'head' ? (
        <p>Access denied. Admin panel is available only to head users.</p>
      ) : (
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
      )}
    </AppShell>
  );
}
