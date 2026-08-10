import { DashboardPage } from "../../../../features/dashboard";

export default function HeadDashboardPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[var(--color-background)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <DashboardPage />
      </div>
    </main>
  );
}
