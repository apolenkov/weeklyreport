import { PeriodsTab } from "../../period";
import { ReopenTab } from "../../review";
import type { AdminTab } from "../model/admin-tab-dependencies";
import type { MockReminder } from "../model/admin-types";
import type { MappedAdminSnapshot, MockSettings } from "../model/admin-types";
import { ActionLogTab } from "./action-log-tab";
import { ActivitiesTab } from "./activities-tab";
import { AdminQueryIssue } from "./admin-query-issue";
import { AdminTabSkeleton } from "./admin-skeleton";
import { GroupsTab } from "./groups-tab";
import { JobsTab } from "./jobs-tab";
import { ProductsTab } from "./products-tab";
import { RemindersTab } from "./reminders-tab";
import { SettingsTab } from "./settings-tab";
import { UsersTab } from "./users-tab";

interface AdminPanelContentProps {
  readonly activeTab: AdminTab;
  readonly productFilter?: string | null;
  readonly data?: MappedAdminSnapshot;
  readonly settings?: MockSettings;
  readonly snapshotError: boolean;
  readonly settingsError: boolean;
  readonly retrySnapshot: () => void;
  readonly retrySettings: () => void;
}

function SettingsContent(props: AdminPanelContentProps) {
  if (props.settingsError) {
    return (
      <AdminQueryIssue
        description="Settings could not be loaded."
        onRetry={props.retrySettings}
      />
    );
  }
  return props.settings ? (
    <SettingsTab settings={props.settings} />
  ) : (
    <AdminTabSkeleton variant="form" />
  );
}

function groupRulesByPolicyId(rules: readonly MockReminder[]) {
  return rules.reduce<Readonly<Record<string, readonly MockReminder[]>>>(
    (groups, rule) =>
      rule.policyId === null
        ? groups
        : {
            ...groups,
            [rule.policyId]: [...(groups[rule.policyId] ?? []), rule],
          },
    {},
  );
}

function RemindersContent(props: AdminPanelContentProps) {
  if (props.snapshotError || props.settingsError) {
    const retry = () => {
      if (props.snapshotError) props.retrySnapshot();
      if (props.settingsError) props.retrySettings();
    };
    return (
      <AdminQueryIssue
        description="Reminder policies and their timezone settings must both be available."
        onRetry={retry}
      />
    );
  }
  if (!props.data || !props.settings) {
    return <AdminTabSkeleton variant="table" />;
  }

  return (
    <RemindersTab
      policies={props.data.policies}
      derivedRulesByPolicyId={groupRulesByPolicyId(props.data.reminders)}
      defaultTimezone={props.settings.defaultTimezone}
    />
  );
}

function SnapshotContent(props: AdminPanelContentProps) {
  if (props.snapshotError) {
    return (
      <AdminQueryIssue
        description="Admin data could not be loaded."
        onRetry={props.retrySnapshot}
      />
    );
  }
  if (!props.data) return <AdminTabSkeleton variant="table" />;

  if (props.activeTab === "users") {
    return <UsersTab users={props.data.users} groups={props.data.groups} />;
  }
  if (props.activeTab === "groups") {
    return (
      <GroupsTab
        groups={props.data.groups}
        users={props.data.users}
        products={props.data.products}
      />
    );
  }
  if (props.activeTab === "activities") {
    return (
      <ActivitiesTab
        groups={props.data.groups}
        users={props.data.users}
        products={props.data.products}
      />
    );
  }
  return (
    <ProductsTab
      products={props.data.products}
      users={props.data.users}
      productFilter={props.productFilter}
    />
  );
}

export function AdminPanelContent(props: AdminPanelContentProps) {
  switch (props.activeTab) {
    case "settings":
      return <SettingsContent {...props} />;
    case "reminders":
      return <RemindersContent {...props} />;
    case "periods":
      return <PeriodsTab />;
    case "reopen":
      return <ReopenTab />;
    case "jobs":
      return <JobsTab />;
    case "actions":
      return <ActionLogTab />;
    default:
      return <SnapshotContent {...props} />;
  }
}
