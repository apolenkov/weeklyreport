"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
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
  readonly href: string;
  readonly testId: string;
}

function MobileAlertLink({
  accessibleCount,
  href,
  testId,
}: MobileAlertLinkProps) {
  return (
    <Link
      href={href}
      className="relative inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
    >
      <span data-testid={testId}>{accessibleCount}</span>
    </Link>
  );
}

interface MobileAlertProps extends Omit<
  MobileAlertLinkProps,
  "accessibleCount"
> {
  readonly count: number;
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
      accessibleCount={
        unavailable
          ? unavailableCount
          : count === 1
            ? singularCount
            : `${count} ${pluralCount}`
      }
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
        testId="mobile-reopen-tab-count"
        unavailable={reopenUnavailable}
        unavailableCount="Pending reopen count unavailable"
      />
      <MobileAlert
        singularCount="1 failed job in DLQ"
        pluralCount="failed jobs in DLQ"
        count={dlqCount}
        href="/admin?tab=jobs"
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
      <label
        htmlFor="admin-tab-select"
        className="block text-xs font-medium text-[var(--color-muted-foreground)] lg:hidden"
      >
        Admin tab
      </label>
      <select
        id="admin-tab-select"
        className="mt-1 block h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm font-medium text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 lg:hidden"
        value={activeTab}
        onChange={(e) => router.push(`/admin?tab=${e.target.value}`)}
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
