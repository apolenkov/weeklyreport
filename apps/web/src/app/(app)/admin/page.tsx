type Props = {
  searchParams: Promise<{ tab?: string }>;
};

const tabs = ['users', 'products', 'periods', 'reminders', 'settings'] as const;

export default async function AdminPage({ searchParams }: Props) {
  const { tab = 'users' } = await searchParams;
  const activeTab = tabs.includes(tab as (typeof tabs)[number]) ? tab : 'users';

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-starbucks-green)]">
            Admin Panel
          </h1>

          {/* Tab navigation */}
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
              >
                {t}
              </a>
            ))}
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Admin Panel ({activeTab} tab) with CRUD operations will be implemented in Wave 5.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
