"use client";

import { useQuery } from "@tanstack/react-query";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
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

  useQueryErrorHandler(
    {
      isError: dependencies.snapshot && snapshotQuery.isError,
      error: snapshotQuery.error,
      isSuccess: snapshotQuery.isSuccess,
    },
    {
      component: "AdminPanel",
      event: "admin.snapshot.load_failed",
      procedure: "admin.snapshot",
      toastPrefix: "Failed to load admin data",
    },
  );
  useQueryErrorHandler(
    {
      isError: dependencies.settings && settingsQuery.isError,
      error: settingsQuery.error,
      isSuccess: settingsQuery.isSuccess,
    },
    {
      component: "AdminPanel",
      event: "admin.get_settings.load_failed",
      procedure: "admin.getSettings",
      toastPrefix: "Failed to load settings",
    },
  );

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
