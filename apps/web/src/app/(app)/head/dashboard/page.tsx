import Script from "next/script";

import { DashboardPage } from "../../../../features/dashboard";

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
      <Script id="dashboard-bfcache-recovery" strategy="afterInteractive">
        {DASHBOARD_BFCACHE_RECOVERY_SCRIPT}
      </Script>
      <main
        id="main-content"
        className="min-h-screen bg-[var(--color-background)]"
      >
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <DashboardPage />
        </div>
      </main>
    </>
  );
}
