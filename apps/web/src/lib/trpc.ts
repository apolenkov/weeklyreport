import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import superjson from 'superjson';

import type { AppRouter } from '@customreport/api/infrastructure/trpc/trpc.router';

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: process.env.NEXT_PUBLIC_API_URL
          ? `${process.env.NEXT_PUBLIC_API_URL}/trpc`
          : 'http://localhost:3001/trpc',
        fetch: (url, options) =>
          fetch(url, { ...options, credentials: 'include' }),
      }),
    ],
  });
}
