"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
// Cross-slice: this dispatch container composes the period and review slices.
import { PeriodsTab } from "../../period/ui/periods-tab";
import { ReopenTab } from "../../review/ui/reopen-tab";
import { mapAdminSettings, mapAdminSnapshot } from "../model/admin";
import { ActionLogTab } from "./action-log-tab";
import { AdminTabSkeleton } from "./admin-skeleton";
import { GroupsTab } from "./groups-tab";
import { JobsTab } from "./jobs-tab";
import { ProductsTab } from "./products-tab";
import { RemindersTab } from "./reminders-tab";
import { SettingsTab } from "./settings-tab";
import { UsersTab } from "./users-tab";

interface AdminPanelProps {
  readonly activeTab: string;
  readonly productFilter?: string | null;
}

/**
 * Admin Panel container. Lifts the snapshot + settings queries into the parent
 * so the child tabs can stay focused on form/table behavior while mutations
 * invalidate the shared admin snapshot.
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
      {activeTab === "settings" &&
        (!settings ? (
          <AdminTabSkeleton variant="form" />
        ) : (
          <SettingsTab settings={settings} />
        ))}

      {/* Reopen tab is self-contained — it owns its own queries, doesn't need
          the snapshot/settings context that the other tabs share. */}
      {activeTab === "reopen" && <ReopenTab />}

      {/* Jobs tab is also self-contained — it consumes the BullMQ-backed
          `admin.jobs.listFailed` query directly and doesn't need the admin
          snapshot. */}
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
            {activeTab === "users" && (
              <UsersTab users={data.users} groups={data.groups} />
            )}
            {activeTab === "groups" && (
              <GroupsTab
                groups={data.groups}
                users={data.users}
                products={data.products}
              />
            )}
            {activeTab === "products" && (
              <ProductsTab
                products={data.products}
                users={data.users}
                productFilter={productFilter}
              />
            )}
            {/* PeriodsTab owns its own queries (admin.listPeriodsByState) so
                it pulls richer rows than the shared admin snapshot can
                carry — no props needed. */}
            {activeTab === "periods" && <PeriodsTab />}
            {activeTab === "reminders" &&
              (() => {
                // Group rules by their owning policy for the read-only
                // expander on each policy row. Rules whose `policyId` is
                // `null` (legacy) are skipped — the policy editor has no row
                // to attach them to.
                const derivedRulesByPolicyId: Record<
                  string,
                  typeof data.reminders
                > = {};
                for (const rule of data.reminders) {
                  if (rule.policyId === null) continue;
                  const bucket = derivedRulesByPolicyId[rule.policyId] ?? [];
                  bucket.push(rule);
                  derivedRulesByPolicyId[rule.policyId] = bucket;
                }
                return (
                  <RemindersTab
                    policies={data.policies}
                    derivedRulesByPolicyId={derivedRulesByPolicyId}
                    // Seed the new-reminder form's timezone from AppSettings.
                    // Falls back to Europe/Moscow when settings haven't loaded
                    // yet (handled inside emptyPolicyForm).
                    defaultTimezone={settings?.defaultTimezone}
                  />
                );
              })()}
            {!["users", "groups", "products", "periods", "reminders"].includes(
              activeTab,
            ) && <UsersTab users={data.users} groups={data.groups} />}
          </>
        )}
    </div>
  );
}
