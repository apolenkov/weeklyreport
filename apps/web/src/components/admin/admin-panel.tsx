"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "../../lib/trpc-context";
import { mapAdminSnapshot, mapAdminSettings } from "../../lib/mappers";

import { UsersTab } from "./users-tab";
import { ProductsTab } from "./products-tab";
import { RemindersTab } from "./reminders-tab";
import { SettingsTab } from "./settings-tab";
import { ReopenTab } from "./reopen-tab";
import { JobsTab } from "./jobs-tab";
import { ActionLogTab } from "./action-log-tab";
import { AdminTabSkeleton } from "./admin-skeleton";

type AdminPanelProps = {
  readonly activeTab: string;
  readonly productFilter?: string | null;
};

/**
 * Admin Panel container. Lifts the snapshot + settings queries into the parent
 * so the child tabs can stay presentational. Mutations remain unwired —
 * Phase 22 will replace each tab's local-state mutations with real tRPC calls.
 */
export function AdminPanel({ activeTab, productFilter }: AdminPanelProps) {
  const trpc = useTRPC();

  const snapshotQuery = useQuery(trpc.admin.snapshot.queryOptions());
  const settingsQuery = useQuery(trpc.admin.getSettings.queryOptions());

  useEffect(() => {
    if (snapshotQuery.isError) {
      toast.error(
        snapshotQuery.error instanceof Error
          ? `Failed to load admin data: ${snapshotQuery.error.message}`
          : "Failed to load admin data",
      );
    }
  }, [snapshotQuery.isError, snapshotQuery.error]);

  useEffect(() => {
    if (settingsQuery.isError) {
      toast.error(
        settingsQuery.error instanceof Error
          ? `Failed to load settings: ${settingsQuery.error.message}`
          : "Failed to load settings",
      );
    }
  }, [settingsQuery.isError, settingsQuery.error]);

  const data = snapshotQuery.data
    ? mapAdminSnapshot(snapshotQuery.data)
    : undefined;
  const settings = settingsQuery.data
    ? mapAdminSettings(settingsQuery.data)
    : undefined;

  return (
    <div data-testid="admin-panel">
      {activeTab === "settings" && (
        <>
          {!settings ? (
            <AdminTabSkeleton variant="form" />
          ) : (
            <SettingsTab settings={settings} />
          )}
        </>
      )}

      {/* Reopen tab is self-contained — it owns its own queries, doesn't need
          the snapshot/settings context that the other tabs share. */}
      {activeTab === "reopen" && <ReopenTab />}

      {/* Phase 35-06: Jobs tab is also self-contained — it consumes the
          BullMQ-backed `admin.jobs.listFailed` query directly and doesn't
          need the admin snapshot. */}
      {activeTab === "jobs" && <JobsTab />}

      {activeTab === "actions" && <ActionLogTab />}

      {!data &&
        activeTab !== "settings" &&
        activeTab !== "reopen" &&
        activeTab !== "jobs" &&
        activeTab !== "actions" && <AdminTabSkeleton variant="table" />}

      {data &&
        activeTab !== "settings" &&
        activeTab !== "reopen" &&
        activeTab !== "jobs" &&
        activeTab !== "actions" && (
          <>
            {activeTab === "users" && <UsersTab users={data.users} />}
            {activeTab === "products" && (
              <ProductsTab
                products={data.products}
                users={data.users}
                productFilter={productFilter}
              />
            )}
            {activeTab === "reminders" && (
              <RemindersTab reminders={data.reminders} periods={data.periods} />
            )}
            {!["users", "products", "reminders"].includes(activeTab) && (
              <UsersTab users={data.users} />
            )}
          </>
        )}
    </div>
  );
}
