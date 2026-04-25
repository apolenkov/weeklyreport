'use client';

import { createContext, useContext } from 'react';
import type { TRPCProxy } from './trpc';

export const TRPCProxyContext = createContext<TRPCProxy | null>(null);

export function useTRPC(): TRPCProxy {
  const ctx = useContext(TRPCProxyContext);
  if (!ctx) throw new Error('useTRPC must be used inside <TRPCProvider>');
  return ctx;
}
