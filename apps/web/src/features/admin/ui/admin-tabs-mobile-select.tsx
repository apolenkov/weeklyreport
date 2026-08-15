"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { TabCountPill } from "../../../shared/ui/tabs/tab-count-pill";
import { ADMIN_TABS, type AdminTab } from "../model/admin-tab-dependencies";

const DLQ_COUNT_POLL_MS = 30_000;

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

interface MobileAlertLinkProps {
  readonly accessibleCount: string;
  readonly count: number;
  readonly href: string;
  readonly label: string;
  readonly testId: string;
}

function MobileAlertLink({
  accessibleCount,
  count,
  href,
  label,
  testId,
}: MobileAlertLinkProps) {
  return (
    <Link
      href={href}
      className="relative inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
    >
      {label}
      <TabCountPill ariaLabel={accessibleCount} count={count} testId={testId} />
    </Link>
  );
}

function AdminTabsMobileAlerts() {
  const trpc = useTRPC();
  const reopenCountQuery = useQuery(
    trpc.admin.pendingReopenCount.queryOptions(undefined, {
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    }),
  );
  const dlqCountQuery = useQuery({
    ...trpc.admin.dlqCount.queryOptions(),
    refetchInterval: DLQ_COUNT_POLL_MS,
  });
  const reopenCount = reopenCountQuery.data?.count ?? 0;
  const dlqCount = dlqCountQuery.data?.count ?? 0;

  if (reopenCount <= 0 && dlqCount <= 0) return null;

  return (
    <nav aria-label="Admin alerts" className="flex flex-wrap gap-3 lg:hidden">
      {reopenCount > 0 ? (
        <MobileAlertLink
          accessibleCount={
            reopenCount === 1
              ? "1 pending reopen request"
              : `${reopenCount} pending reopen requests`
          }
          count={reopenCount}
          href="/admin?tab=reopen"
          label="Reopen"
          testId="mobile-reopen-tab-count"
        />
      ) : null}
      {dlqCount > 0 ? (
        <MobileAlertLink
          accessibleCount={
            dlqCount === 1
              ? "1 failed job in DLQ"
              : `${dlqCount} failed jobs in DLQ`
          }
          count={dlqCount}
          href="/admin?tab=jobs"
          label="Jobs"
          testId="mobile-jobs-tab-count"
        />
      ) : null}
    </nav>
  );
}

// Native select triggers the OS picker — better at 375px than a 5-button row.
export function AdminTabsMobileSelect({ activeTab }: Props) {
  const router = useRouter();

  return (
    <>
      <select
        className="block h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm font-medium text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 lg:hidden"
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
      <AdminTabsMobileAlerts />
    </>
  );
}
