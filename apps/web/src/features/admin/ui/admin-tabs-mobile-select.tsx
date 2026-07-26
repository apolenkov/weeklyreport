"use client";

import { useRouter } from "next/navigation";

import { ADMIN_TABS, type AdminTab } from "../model/admin-tab-dependencies";

// Keyed by AdminTab so a new canonical tab is a type error here, never a
// silently missing option; ADMIN_TABS stays the single source of order.
const TAB_LABELS: Record<AdminTab, string> = {
  users: "Users",
  groups: "Groups",
  products: "Products",
  activities: "Activities",
  periods: "Periods",
  reminders: "Reminders",
  reopen: "Reopen",
  jobs: "Jobs",
  actions: "Actions",
  settings: "Settings",
};

interface Props {
  readonly activeTab: AdminTab;
}

// Native select triggers the OS picker — better at 375px than a 5-button row.
export function AdminTabsMobileSelect({ activeTab }: Props) {
  const router = useRouter();

  return (
    <select
      className="block h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm font-medium text-[var(--color-foreground)] sm:hidden"
      value={activeTab}
      onChange={(e) => router.push(`/admin?tab=${e.target.value}`)}
      aria-label="Admin tab"
    >
      {ADMIN_TABS.map((tab) => (
        <option key={tab} value={tab}>
          {TAB_LABELS[tab]}
        </option>
      ))}
    </select>
  );
}
