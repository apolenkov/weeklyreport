import { ReportArchiveSection } from '../../../../components/dashboard/report-archive-section';

export default function ReportHistoryPage() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-primary)]">Published Reports</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Archive of all published weekly reports. Click a report to view details.
        </p>
      </header>
      <ReportArchiveSection />
    </main>
  );
}
