import Link from "next/link";

import {
  ADMIN_TABS,
  AdminPanel,
  AdminTabsMobileSelect,
  isAdminTab,
  JobsTabLabel,
} from "../../../features/admin";
// ReopenTabLabel lives in the review slice; the route composes it directly
// until the review slice registers and exposes a barrel.
import { ReopenTabLabel } from "../../../features/review/ui/reopen-tab-label";

interface Props {
  searchParams: Promise<{ tab?: string; filter?: string }>;
}

// Tab order lives with ADMIN_TABS (admin-tab-dependencies.ts).
export default async function AdminPage({ searchParams }: Props) {
  const { tab = "users", filter = null } = await searchParams;
  const activeTab = isAdminTab(tab) ? tab : "users";

  return (
    <main id="main-content" className="operational-paper-shell min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
              Admin Panel
            </h1>
          </div>

          <AdminTabsMobileSelect activeTab={activeTab} />

          <nav aria-label="Admin tabs" className="hidden sm:block">
            <div className="flex gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {ADMIN_TABS.map((t) => (
                <Link
                  key={t}
                  href={`/admin?tab=${t}`}
                  className={`relative flex items-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-2 text-[13px] font-semibold capitalize tracking-normal transition-colors ${
                    activeTab === t
                      ? "bg-[var(--color-starbucks-accent)] text-white shadow-[0_1px_3px_rgba(0,98,65,0.25)]"
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
                    t
                  )}
                </Link>
              ))}
            </div>
          </nav>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <AdminPanel activeTab={activeTab} productFilter={filter} />
          </div>
        </div>
      </div>
    </main>
  );
}
