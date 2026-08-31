import type { ReactNode } from "react";

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
      <LeadReportAssistantStore>
        <NavBar />
        <div className="operational-paper-shell min-h-screen">
          <SdlcTooltipProvider>{children}</SdlcTooltipProvider>
        </div>
      </LeadReportAssistantStore>
    </SessionProvider>
  );
}
