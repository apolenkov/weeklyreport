import type { ReactNode } from "react";

import { SessionProvider } from "../../lib/session-provider";
import { NavBar } from "../../shared/ui/navigation/nav-bar";
import { SdlcTooltipProvider } from "../../shared/ui/sdlc-tooltip";

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
