'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@customreport/ui/components/ui/sonner';
import { makeQueryClient } from './query-client';
import { makeTRPCProxy, type TRPCProxy } from './trpc';
import { TRPCProxyContext } from './trpc-context';

type TRPCProviderProps = Readonly<{ children: ReactNode }>;

export function TRPCProvider({ children }: TRPCProviderProps) {
  const [queryClient] = useState(() => makeQueryClient());
  const [trpc] = useState<TRPCProxy>(() => makeTRPCProxy(queryClient));

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProxyContext.Provider value={trpc}>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
}
