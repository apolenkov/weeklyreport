import { DashboardPage } from "../../../../components/dashboard/dashboard-page";

const DASHBOARD_BFCACHE_RECOVERY_SCRIPT = `
(() => {
  window.addEventListener("pageshow", (event) => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const isHistoryRestore =
      event.persisted || navigation?.type === "back_forward";
    if (!isHistoryRestore) return;
    if (window.location.pathname !== "/head/dashboard") return;
    if (!document.querySelector("[data-dashboard-loading='true']")) return;
    window.location.reload();
  });
})();
`;

export default function HeadDashboardPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: DASHBOARD_BFCACHE_RECOVERY_SCRIPT,
        }}
      />
      <main
        id="main-content"
        className="min-h-screen bg-[var(--color-background)]"
      >
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <DashboardPage />
        </div>
      </main>
    </>
  );
}
