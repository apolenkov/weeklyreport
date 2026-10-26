import { type ReactNode, Suspense } from "react";

import { ProductFeedbackWidget } from "../../features/product-feedback";
import { OverviewInputProvider } from "../../features/report-pages/ui/lead/shell/overview-input-provider";
import { LeadReportAssistantStore } from "../../features/report-pages/ui/lead-report-assistant-store";
import { SessionProvider } from "../../shared/lib/auth/session-provider";
import { SdlcTooltipProvider } from "../../shared/ui/feedback/sdlc-tooltip";
import { NavBar } from "../../shared/ui/navigation/nav-bar";

type AppGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AppGroupLayout({ children }: AppGroupLayoutProps) {
  return (
    <SessionProvider>
      <OverviewInputProvider>
        <LeadReportAssistantStore>
          <div className="app-viewport">
            <NavBar />
            <Suspense fallback={null}>
              <ProductFeedbackWidget />
            </Suspense>
            <div className="operational-paper-shell flex-1">
              <SdlcTooltipProvider>{children}</SdlcTooltipProvider>
            </div>
          </div>
        </LeadReportAssistantStore>
      </OverviewInputProvider>
    </SessionProvider>
  );
}
