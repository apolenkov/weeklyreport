import {
  AdminPanel,
  AdminTabsMobileSelect,
  JobsTabLabel,
} from "../../../features/admin";
// ReopenTabLabel lives in the review slice; the route composes it directly
// until the review slice registers and exposes a barrel (paired lead/ change).
import { ReopenTabLabel } from "../../../features/review/ui/reopen-tab-label";

interface Props {
  searchParams: Promise<{ tab?: string; filter?: string }>;
}

// Phase 35-06: 'jobs' tab — BullMQ DLQ admin UI. Order: after 'reopen',
// before 'settings' so the failure-triage workflow lives next to other
// reactive admin work (reopen requests / failed-job retries).
//
// UFB-052 (Phase 51-B): 'periods' tab — admin period lifecycle list.
// Position: between 'products' and 'reminders' — products → periods →
// reminders mirrors the actual data-flow ordering (a period scoped to
// products, with reminders fired against it).
const tabs = [
  "users",
  "groups",
  "products",
  "periods",
  "reminders",
  "reopen",
  "jobs",
  "actions",
  "settings",
] as const;
type TabId = (typeof tabs)[number];

export default async function AdminPage({ searchParams }: Props) {
  const { tab = "users", filter = null } = await searchParams;
  const activeTab: TabId = tabs.includes(tab as TabId)
    ? (tab as TabId)
    : "users";

  return (
    <main id="main-content" className="operational-paper-shell min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
              Admin Panel
            </h1>
          </div>

          {/* MOB-04 (Phase 30-05): native select on mobile, anchor tab list on sm+ */}
          <AdminTabsMobileSelect activeTab={activeTab} />

          {/* ADM-1 (Phase 33-04): pill row matching mockup s7. Active = filled
              tealA pill (`btn-pr`); inactive = transparent ghost. Outer
              container uses bg-white + shadow per mockup spec. */}
          <nav aria-label="Admin tabs" className="hidden sm:block">
            <div className="flex gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {tabs.map((t) => (
                <a
                  key={t}
                  href={`/admin?tab=${t}`}
                  className={`relative flex items-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-2 text-[13px] font-semibold capitalize tracking-normal transition-colors ${
                    activeTab === t
                      ? "bg-[var(--color-starbucks-accent)] text-white shadow-[0_1px_3px_rgba(0,98,65,0.25)]"
                      : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
                  }`}
                  style={{ minHeight: "44px" }}
                  aria-current={activeTab === t ? "page" : undefined}
                >
                  {t === "reopen" ? (
                    <ReopenTabLabel active={activeTab === t} />
                  ) : t === "jobs" ? (
                    <JobsTabLabel active={activeTab === t} />
                  ) : (
                    t
                  )}
                </a>
              ))}
            </div>
          </nav>

          {/* Tab content */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <AdminPanel activeTab={activeTab} productFilter={filter} />
          </div>
        </div>
      </div>
    </main>
  );
}
