import type { ReactNode } from "react";

import { SessionProvider } from "../../shared/lib/auth/session-provider";
import { SdlcTooltipProvider } from "../../shared/ui/feedback/sdlc-tooltip";
import { NavBar } from "../../shared/ui/navigation/nav-bar";

type AppGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AppGroupLayout({ children }: AppGroupLayoutProps) {
  return (
    <SessionProvider>
      <NavBar />
      <SdlcTooltipProvider>{children}</SdlcTooltipProvider>
    </SessionProvider>
  );
}
