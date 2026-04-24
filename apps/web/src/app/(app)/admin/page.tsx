import { AdminPanel } from '../../../../components/admin/admin-panel';

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

const tabs = ['users', 'products', 'periods', 'reminders', 'settings'] as const;

const TAB_ICONS: Record<string, string> = {
  users: 'Users',
  products: 'Products',
  periods: 'Periods',
  reminders: 'Reminders',
  settings: 'Settings',
};

export default async function AdminPage({ searchParams }: Props) {
  const { tab = 'users' } = await searchParams;
  const activeTab = tabs.includes(tab as (typeof tabs)[number]) ? tab : 'users';

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
            Admin Panel
          </h1>

          {/* Tab navigation */}
          <nav aria-label="Admin tabs">
            <div className="flex gap-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-1">
              {tabs.map((t) => (
                <a
                  key={t}
                  href={`/admin?tab=${t}`}
                  className={`flex items-center rounded-[var(--radius-sm)] px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    activeTab === t
                      ? 'bg-[var(--color-starbucks-green)] text-white'
                      : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                  }`}
                  style={{ minHeight: '44px' }}
                  aria-current={activeTab === t ? 'page' : undefined}
                  aria-label={`${TAB_ICONS[t]} tab`}
                >
                  {t}
                </a>
              ))}
            </div>
          </nav>

          {/* Tab content */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <AdminPanel activeTab={activeTab} />
          </div>
        </div>
      </div>
    </main>
  );
}
