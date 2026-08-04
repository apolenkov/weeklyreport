"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import { mapAdminSnapshot } from "../model/admin";
import {
  ADMIN_TAB_QUERY_DEPENDENCIES,
  type AdminTab,
} from "../model/admin-tab-dependencies";
import { AdminPanelContent } from "./admin-panel-content";

interface AdminPanelProps {
  readonly activeTab: AdminTab;
  readonly productFilter?: string | null;
}

interface QueryErrorState {
  readonly enabled: boolean;
  readonly error: unknown;
  readonly isError: boolean;
  readonly label: string;
}

function useAdminQueryErrorToast(state: QueryErrorState): void {
  useEffect(() => {
    if (!state.enabled || !state.isError) return;
    const detail =
      state.error instanceof Error ? `: ${state.error.message}` : "";
    toast.error(`Failed to load ${state.label}${detail}`);
  }, [state.enabled, state.error, state.isError, state.label]);
}

export function AdminPanel({ activeTab, productFilter }: AdminPanelProps) {
  const trpc = useTRPC();
  const dependencies = ADMIN_TAB_QUERY_DEPENDENCIES[activeTab];
  const snapshotQuery = useQuery({
    ...trpc.admin.snapshot.queryOptions(),
    enabled: dependencies.snapshot,
  });
  const settingsQuery = useQuery({
    ...trpc.admin.getSettings.queryOptions(),
    enabled: dependencies.settings,
  });

  useAdminQueryErrorToast({
    enabled: dependencies.snapshot,
    error: snapshotQuery.error,
    isError: snapshotQuery.isError,
    label: "admin data",
  });
  useAdminQueryErrorToast({
    enabled: dependencies.settings,
    error: settingsQuery.error,
    isError: settingsQuery.isError,
    label: "settings",
  });

  const data = snapshotQuery.data
    ? mapAdminSnapshot(snapshotQuery.data)
    : undefined;
  return (
    <div data-testid="admin-panel">
      <AdminPanelContent
        activeTab={activeTab}
        productFilter={productFilter}
        data={data}
        settings={settingsQuery.data}
        snapshotError={dependencies.snapshot && snapshotQuery.isError}
        settingsError={dependencies.settings && settingsQuery.isError}
        retrySnapshot={() => {
          void snapshotQuery.refetch().catch(() => undefined);
        }}
        retrySettings={() => {
          void settingsQuery.refetch().catch(() => undefined);
        }}
      />
    </div>
  );
}
