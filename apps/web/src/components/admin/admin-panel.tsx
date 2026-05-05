'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../lib/trpc-context';
import { mapAdminSnapshot, mapAdminSettings } from '../../lib/mappers';

import { UsersTab } from './users-tab';
import { ProductsTab } from './products-tab';
import { PeriodsTab } from './periods-tab';
import { RemindersTab } from './reminders-tab';
import { SettingsTab } from './settings-tab';
import { ReopenTab } from './reopen-tab';
import { AdminTabSkeleton } from './admin-skeleton';

type AdminPanelProps = {
  readonly activeTab: string;
};

/**
 * Admin Panel container. Lifts the snapshot + settings queries into the parent
 * so the 5 child tabs can stay presentational. Mutations remain unwired —
 * Phase 22 will replace each tab's local-state mutations with real tRPC calls.
 */
export function AdminPanel({ activeTab }: AdminPanelProps) {
  const trpc = useTRPC();

  const snapshotQuery = useQuery(trpc.admin.snapshot.queryOptions());
  const settingsQuery = useQuery(trpc.admin.getSettings.queryOptions());

  useEffect(() => {
    if (snapshotQuery.isError) {
      toast.error(
        snapshotQuery.error instanceof Error
          ? `Failed to load admin data: ${snapshotQuery.error.message}`
          : 'Failed to load admin data',
      );
    }
  }, [snapshotQuery.isError, snapshotQuery.error]);

  useEffect(() => {
    if (settingsQuery.isError) {
      toast.error(
        settingsQuery.error instanceof Error
          ? `Failed to load settings: ${settingsQuery.error.message}`
          : 'Failed to load settings',
      );
    }
  }, [settingsQuery.isError, settingsQuery.error]);

  const data = snapshotQuery.data ? mapAdminSnapshot(snapshotQuery.data) : undefined;
  const settings = settingsQuery.data ? mapAdminSettings(settingsQuery.data) : undefined;

  if (activeTab === 'settings') {
    if (!settings) {
      return <AdminTabSkeleton variant="form" />;
    }
    return <SettingsTab settings={settings} />;
  }

  // Reopen tab is self-contained — it owns its own queries, doesn't need
  // the snapshot/settings context that the other tabs share.
  if (activeTab === 'reopen') {
    return <ReopenTab />;
  }

  if (!data) {
    return <AdminTabSkeleton variant="table" />;
  }

  switch (activeTab) {
    case 'users':
      return <UsersTab users={data.users} />;
    case 'products':
      return <ProductsTab products={data.products} users={data.users} />;
    case 'periods':
      return <PeriodsTab periods={data.periods} />;
    case 'reminders':
      return <RemindersTab reminders={data.reminders} />;
    default:
      return <UsersTab users={data.users} />;
  }
}
