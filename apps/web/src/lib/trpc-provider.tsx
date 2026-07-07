"use client";

import { Toaster } from "@customreport/ui/components/ui/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";

import { installClientLogger } from "./client-logger";
import { makeQueryClient } from "./query-client";
import { makeTRPCProxy, type TRPCProxy } from "./trpc";
import { TRPCProxyContext } from "./trpc-context";

type TRPCProviderProps = Readonly<{ children: ReactNode }>;

export function TRPCProvider({ children }: TRPCProviderProps) {
  const [queryClient] = useState(() => makeQueryClient());
  const [trpc] = useState<TRPCProxy>(() => makeTRPCProxy(queryClient));

  useEffect(() => {
    installClientLogger();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProxyContext.Provider value={trpc}>
        {children}
        {/* Toast UX:
            - position="top-center" — single visual anchor, less off-screen on mobile
            - no closeButton — `richColors` already renders a status icon, so a
              second X next to it produced a double-cross visual that read as
              cluttered. Auto-dismiss handles both ergonomics and clutter.
            - duration=5000 — sonner defaults make error toasts sticky; cap at
              5s so notifications never block the workflow. Critical errors
              still surface on the next user action via the underlying state.
        */}
        <Toaster richColors position="top-center" duration={5000} />
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
}
