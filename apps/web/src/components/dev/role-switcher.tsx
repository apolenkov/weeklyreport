'use client';

import { useState } from 'react';

import { Button } from '@customreport/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@customreport/ui/components/ui/dropdown-menu';

type Identity = {
  label: string;
  role: 'head' | 'lead' | 'admin' | 'viewer';
  email: string;
};

// Per-role default identities. Admin is the post-SAML default (mock SAML
// login lands as admin); the picker lets the presenter swap to head, lead
// (Polenkov is the canonical seed-simple lead), or viewer.
const IDENTITIES: readonly Identity[] = [
  { label: 'Head', role: 'head', email: 'head@customreport.local' },
  { label: 'Lead', role: 'lead', email: 'polenkov@customreport.local' },
  { label: 'Viewer', role: 'viewer', email: 'viewer@customreport.local' },
  { label: 'Admin', role: 'admin', email: 'admin@customreport.local' },
];

export function DevRoleSwitcher() {
  const [pending, setPending] = useState(false);

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
          <DropdownMenuItem onSelect={logout} data-testid="dev-role-switcher-logout">
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
