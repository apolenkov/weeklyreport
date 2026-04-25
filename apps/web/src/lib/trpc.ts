import { createTRPCClient as createTRPCClientCore, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { QueryClient } from '@tanstack/react-query';
import superjson from 'superjson';

import type { AppRouter } from '@customreport/api/infrastructure/trpc/trpc.router';

export function makeTRPCClient() {
  return createTRPCClientCore<AppRouter>({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: '/trpc',
        fetch: (url, options) =>
          fetch(url, { ...options, credentials: 'include' }),
      }),
    ],
  });
}

export function makeTRPCProxy(queryClient: QueryClient) {
  return createTRPCOptionsProxy<AppRouter>({
    client: makeTRPCClient(),
    queryClient,
  });
}

export type TRPCProxy = ReturnType<typeof makeTRPCProxy>;
