"use client";

import { useRouter } from "next/navigation";

import type { AdminTab } from "../model/admin-tab-dependencies";

// Native select triggers the OS picker — better at 375px than a 5-button row.
const TABS: readonly { value: AdminTab; label: string }[] = [
  { value: "users", label: "Users" },
  { value: "groups", label: "Groups" },
  { value: "products", label: "Products" },
  { value: "periods", label: "Periods" },
  { value: "reminders", label: "Reminders" },
  { value: "reopen", label: "Reopen" },
  { value: "jobs", label: "Jobs" },
  { value: "actions", label: "Actions" },
  { value: "settings", label: "Settings" },
];

interface Props {
  readonly activeTab: AdminTab;
}

export function AdminTabsMobileSelect({ activeTab }: Props) {
  const router = useRouter();

  return (
    <select
      className="block h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm font-medium text-[var(--color-foreground)] sm:hidden"
      value={activeTab}
      onChange={(e) => router.push(`/admin?tab=${e.target.value}`)}
      aria-label="Admin tab"
    >
      {TABS.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
