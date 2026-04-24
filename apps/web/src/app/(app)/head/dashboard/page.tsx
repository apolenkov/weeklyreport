import { DashboardPage } from '../../../../components/dashboard/dashboard-page';

export default function HeadDashboardPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardPage />
      </div>
    </main>
  );
}
