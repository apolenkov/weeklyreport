"use client";

import { Toaster } from "@customreport/ui/components/ui/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";

import { installClientLogger } from "./client-logger";
import { makeQueryClient } from "./query-client";
import { makeTRPCProxy, type TRPCProxy } from "./trpc";
import { TRPCProxyContext } from "./trpc-context";

type TRPCProviderProps = Readonly<{ children: ReactNode }>;

// Sonner defaults make error toasts sticky; cap so notifications never block the workflow.
const TOAST_DURATION_MS = 5000;

/**
 * TRPC Provider.
 * @param props - The props argument.
 */
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
        {/* top-center anchor; no closeButton — richColors already shows a status icon. */}
        <Toaster
          richColors
          position="top-center"
          duration={TOAST_DURATION_MS}
        />
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
}
