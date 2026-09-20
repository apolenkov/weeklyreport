"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { TabCountPill } from "../../../shared/ui/tabs/tab-count-pill";
import {
  ADMIN_TAB_LABELS,
  ADMIN_TABS,
  type AdminTab,
} from "../model/admin-tab-dependencies";

const DLQ_COUNT_POLL_MS = 30_000;

interface Props {
  readonly activeTab: AdminTab;
}

interface MobileAlertLinkProps {
  readonly accessibleCount: string;
  readonly count: number;
  readonly href: string;
  readonly label: string;
  readonly testId: string;
  readonly unavailable?: boolean;
}

function MobileAlertLink({
  accessibleCount,
  count,
  href,
  label,
  testId,
  unavailable = false,
}: MobileAlertLinkProps) {
  return (
    <Link
      href={href}
      className="relative inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
    >
      {label}
      <TabCountPill
        ariaLabel={accessibleCount}
        count={count}
        testId={testId}
        unavailable={unavailable}
      />
    </Link>
  );
}

interface MobileAlertProps extends Omit<
  MobileAlertLinkProps,
  "accessibleCount" | "unavailable"
> {
  readonly singularCount: string;
  readonly pluralCount: string;
  readonly unavailable: boolean;
  readonly unavailableCount: string;
}

function MobileAlert({
  count,
  singularCount,
  pluralCount,
  unavailable,
  unavailableCount,
  ...linkProps
}: MobileAlertProps) {
  if (!unavailable && count <= 0) return null;
  return (
    <MobileAlertLink
      {...linkProps}
      count={count}
      accessibleCount={
        unavailable
          ? unavailableCount
          : count === 1
            ? singularCount
            : `${count} ${pluralCount}`
      }
      unavailable={unavailable}
    />
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
  useQueryErrorHandler(reopenCountQuery, {
    component: "AdminTabsMobileAlerts",
    event: "admin.pending_reopen_count.load_failed",
    procedure: "admin.pendingReopenCount",
  });
  useQueryErrorHandler(dlqCountQuery, {
    component: "AdminTabsMobileAlerts",
    event: "admin.dlq_count.load_failed",
    procedure: "admin.dlqCount",
  });

  const reopenCount = reopenCountQuery.data?.count ?? 0;
  const dlqCount = dlqCountQuery.data?.count ?? 0;
  const reopenUnavailable = reopenCountQuery.isError;
  const dlqUnavailable = dlqCountQuery.isError;

  if (
    !reopenUnavailable &&
    !dlqUnavailable &&
    reopenCount <= 0 &&
    dlqCount <= 0
  ) {
    return null;
  }

  return (
    <nav aria-label="Admin alerts" className="flex flex-wrap gap-3 lg:hidden">
      <MobileAlert
        singularCount="1 pending reopen request"
        pluralCount="pending reopen requests"
        count={reopenCount}
        href="/admin?tab=reopen"
        label="Reopen"
        testId="mobile-reopen-tab-count"
        unavailable={reopenUnavailable}
        unavailableCount="Pending reopen count unavailable"
      />
      <MobileAlert
        singularCount="1 failed job in DLQ"
        pluralCount="failed jobs in DLQ"
        count={dlqCount}
        href="/admin?tab=jobs"
        label="Jobs"
        testId="mobile-jobs-tab-count"
        unavailable={dlqUnavailable}
        unavailableCount="Failed job count unavailable"
      />
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
            {ADMIN_TAB_LABELS[tab]}
          </option>
        ))}
      </select>
      <AdminTabsMobileAlerts />
    </>
  );
}
