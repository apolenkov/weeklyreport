import Link from "next/link";

import {
  ADMIN_TAB_LABELS,
  ADMIN_TABS,
  AdminPanel,
  AdminTabsMobileSelect,
  isAdminTab,
  JobsTabLabel,
} from "../../../features/admin";
import { ReopenTabLabel } from "../../../features/review";
import { ADMIN_ROUTE } from "../../../shared/ui/navigation/nav-links";

interface Props {
  searchParams: Promise<{
    tab?: string | string[];
    filter?: string | string[];
  }>;
}

// Tab order lives with ADMIN_TABS (admin-tab-dependencies.ts).
export default async function AdminPage({ searchParams }: Props) {
  const { tab, filter } = await searchParams;
  const activeTab = typeof tab === "string" && isAdminTab(tab) ? tab : "users";
  const productFilter = typeof filter === "string" ? filter : null;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="operational-paper-shell min-h-screen"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
              Admin Panel
            </h1>
          </div>

          <AdminTabsMobileSelect activeTab={activeTab} />

          <nav aria-label="Admin tabs" className="hidden lg:block">
            <div className="flex gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-[var(--shadow-card-resting)]">
              {ADMIN_TABS.map((t) => (
                <Link
                  key={t}
                  href={`${ADMIN_ROUTE}?tab=${t}`}
                  className={`relative flex items-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold capitalize tracking-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 ${
                    activeTab === t
                      ? "bg-[var(--color-starbucks-accent)] text-[var(--color-primary-foreground)] shadow-[0_1px_3px_var(--color-ring)]"
                      : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
                  }`}
                  style={{ minHeight: "var(--touch-target-min)" }}
                  aria-current={activeTab === t ? "page" : undefined}
                >
                  {t === "reopen" ? (
                    <ReopenTabLabel />
                  ) : t === "jobs" ? (
                    <JobsTabLabel />
                  ) : (
                    ADMIN_TAB_LABELS[t]
                  )}
                </Link>
              ))}
            </div>
          </nav>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <AdminPanel activeTab={activeTab} productFilter={productFilter} />
          </div>
        </div>
      </div>
    </main>
  );
}
