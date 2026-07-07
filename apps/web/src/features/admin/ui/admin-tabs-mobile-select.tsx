"use client";

import { useRouter } from "next/navigation";

/**
 * Native <select> for admin-tab navigation at narrow
 * widths. The desktop anchor-tab list (apps/web/src/app/(app)/admin/page.tsx)
 * stays untouched; this component renders only at sm- viewports via the
 * `sm:hidden` Tailwind class.
 *
 * Native select is the right primitive on touch: it triggers the OS picker
 * (iOS wheel, Android bottom sheet), which is far more accessible than a
 * 5-button row at 375px.
 */

type AdminTab =
  | "users"
  | "groups"
  | "products"
  | "periods"
  | "reminders"
  | "reopen"
  | "jobs"
  | "actions"
  | "settings";

const TABS: readonly { value: AdminTab; label: string }[] = [
  { value: "users", label: "Users" },
  { value: "groups", label: "Groups" },
  { value: "products", label: "Products" },
  // Period lifecycle list (Active/Archive split).
  { value: "periods", label: "Periods" },
  { value: "reminders", label: "Reminders" },
  { value: "reopen", label: "Reopen" },
  // BullMQ DLQ admin UI — failed-job list + retry.
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
