import { AdminPanel } from "../../../components/admin/admin-panel";
import { AdminTabsMobileSelect } from "../../../components/admin/admin-tabs-mobile-select";
import { DlqBadge } from "../../../components/admin/dlq-badge";
import { ReopenTabLabel } from "../../../components/admin/reopen-tab-label";

type Props = {
  searchParams: Promise<{ tab?: string; filter?: string }>;
};

// Phase 35-06: 'jobs' tab — BullMQ DLQ admin UI. Order: after 'reopen',
// before 'settings' so the failure-triage workflow lives next to other
// reactive admin work (reopen requests / failed-job retries).
const tabs = [
  "users",
  "groups",
  "products",
  "reminders",
  "reopen",
  "jobs",
  "actions",
  "settings",
] as const;
type TabId = (typeof tabs)[number];

const TAB_LABELS: Record<TabId, string> = {
  users: "Users",
  groups: "Departments",
  products: "Products",
  reminders: "Reminders",
  reopen: "Reopen",
  jobs: "Jobs",
  actions: "Actions",
  settings: "Settings",
};

export default async function AdminPage({ searchParams }: Props) {
  const { tab = "users", filter = null } = await searchParams;
  const activeTab: TabId = tabs.includes(tab as TabId)
    ? (tab as TabId)
    : "users";

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
              Admin Panel
            </h1>
            {/* NOTIF-06 (Phase 29-05): BullMQ DLQ failed-jobs badge. */}
            <DlqBadge />
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
                  className={`flex items-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-2 text-[13px] font-semibold capitalize transition-colors ${
                    activeTab === t
                      ? "bg-[var(--color-starbucks-accent)] text-white shadow-[0_1px_3px_rgba(0,98,65,0.25)]"
                      : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]"
                  }`}
                  style={{ minHeight: "44px" }}
                  aria-current={activeTab === t ? "page" : undefined}
                  aria-label={`${TAB_LABELS[t]} tab`}
                >
                  {t === "reopen" ? (
                    <ReopenTabLabel active={activeTab === t} />
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
