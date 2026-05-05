'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { Button } from '@customreport/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@customreport/ui/components/ui/dropdown-menu';

import { useTRPC } from '../../lib/trpc-context';

type Identity = {
  label: string;
  role: 'head' | 'lead' | 'admin' | 'viewer';
  email: string;
};

// Per-role default identities. Head ≡ admin in this app (head has full
// admin-page access via route-visibility); we don't expose a separate
// admin choice — keeps the UX simple.
const IDENTITIES: readonly Identity[] = [
  { label: 'Глава департамента', role: 'head', email: 'head@customreport.local' },
  { label: 'Тимлид', role: 'lead', email: 'polenkov@customreport.local' },
  { label: 'Наблюдатель', role: 'viewer', email: 'viewer@customreport.local' },
];

export function DevRoleSwitcher() {
  const [pending, setPending] = useState(false);
  const trpc = useTRPC();

  // Hooks must run unconditionally — guard the gate below.
  const wipeAndReseedMut = useMutation(
    trpc.dev.wipeAndReseed.mutationOptions({
      onSuccess: () => {
        // Hard-reload so every query refetches against the freshly-seeded
        // database. Soft invalidate would race with the in-flight seed.
        window.location.reload();
      },
      onError: (error) => {
        setPending(false);
        // eslint-disable-next-line no-alert -- dev-only widget
        alert(`Reseed failed:\n${error.message}`);
      },
    }),
  );

  if (process.env.NEXT_PUBLIC_DEV_ROLE_SWITCHER !== 'true') {
    return null;
  }

  const switchTo = (identity: Identity) => {
    setPending(true);
    const params = new URLSearchParams({ role: identity.role, email: identity.email });
    window.location.href = `/auth/dev-login?${params.toString()}`;
  };

  const logout = async () => {
    setPending(true);
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      window.location.href = '/';
    }
  };

  const reseed = (variant: 'minimum' | 'advanced') => {
    setPending(true);
    wipeAndReseedMut.mutate({ variant });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            className="border-amber-400 bg-amber-50 text-amber-900 shadow-lg hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100"
            data-testid="dev-role-switcher-trigger"
          >
            DEV: switch role
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuLabel>Login as…</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {IDENTITIES.map((identity) => (
            <DropdownMenuItem
              key={identity.email}
              onSelect={() => switchTo(identity)}
              data-testid={`dev-role-switcher-${identity.role}-${identity.email}`}
            >
              {identity.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Data</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => reseed('minimum')}
            data-testid="dev-role-switcher-reseed-min"
          >
            Wipe + Reseed (minimum)
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => reseed('advanced')}
            data-testid="dev-role-switcher-reseed-full"
          >
            Wipe + Reseed (full)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={logout} data-testid="dev-role-switcher-logout">
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
