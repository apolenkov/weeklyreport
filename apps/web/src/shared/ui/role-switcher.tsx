"use client";

import type { DbRole } from "@customreport/shared";
import { ROLE_LABEL } from "@customreport/shared";
import { Button } from "@customreport/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@customreport/ui/components/ui/dropdown-menu";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useState } from "react";

import { useTRPC } from "../../lib/trpc-context";
import { webEnv } from "../../lib/web-env";
import { logoutThenRedirect } from "../lib/logout-then-redirect";

type DataResetVariant = "minimal" | "demo" | "full" | "stress";

// Presentation order, hand-written on purpose (differs from the schema order).
// Exported only for the completeness pin in its test.
export const ROLE_ORDER = [
  "head",
  "admin",
  "lead",
  "viewer",
] as const satisfies readonly DbRole[];
const LOGOUT_FAILED_MESSAGE =
  "Logout failed — still signed in. Check the API and try again.";
// The seeded dev user list changes only on a reseed, so refetching the dropdown
// more than once a minute is pure noise.
const DEV_USERS_STALE_TIME_MS = 60_000;

interface RoleSwitcherUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
}

// One labelled block per role, in ROLE_ORDER; roles with no seeded user vanish.
function RoleUserItems({
  users,
  onSelect,
}: {
  readonly users: readonly RoleSwitcherUser[];
  readonly onSelect: (identity: { role: DbRole; email: string }) => void;
}) {
  return (
    <>
      {ROLE_ORDER.flatMap((role) => {
        const list = users.filter((u) => u.role === role);
        if (list.length === 0) return [];
        return [
          <DropdownMenuLabel
            key={`${role}-label`}
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            {ROLE_LABEL[role]} ({list.length})
          </DropdownMenuLabel>,
          ...list.map((u) => (
            <DropdownMenuItem
              key={u.id}
              onSelect={() => onSelect({ role, email: u.email })}
              data-testid={`dev-role-switcher-${role}-${u.email}`}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="font-medium">{u.name}</span>
              <span className="text-xs text-muted-foreground">{u.email}</span>
            </DropdownMenuItem>
          )),
          <DropdownMenuSeparator key={`${role}-sep`} />,
        ];
      })}
    </>
  );
}

// Presentation order and testid suffix for each dev-only data reset.
const DATA_RESET_ACTIONS = [
  {
    variant: "minimal",
    label: "Wipe + Reseed (minimal)",
    testId: "reseed-minimal",
  },
  {
    variant: "demo",
    label: "Wipe + Reseed (demo)",
    testId: "reseed-demo",
  },
  {
    variant: "full",
    label: "Wipe + Reseed (full)",
    testId: "reseed-full",
  },
  {
    variant: "stress",
    label: "Wipe + Reseed (stress)",
    testId: "reseed-stress",
  },
] as const satisfies readonly {
  variant: DataResetVariant;
  label: string;
  testId: string;
}[];

function DataResetItems({
  onReseed,
}: {
  readonly onReseed: (variant: DataResetVariant) => void;
}) {
  return (
    <>
      {DATA_RESET_ACTIONS.map((action) => (
        <DropdownMenuItem
          key={action.variant}
          onSelect={() => onReseed(action.variant)}
          data-testid={`dev-role-switcher-${action.testId}`}
        >
          {action.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

// Trigger stays a separate unit so the long Tailwind chain does not crowd the
// menu structure below.
function RoleSwitcherTrigger({ pending }: { readonly pending: boolean }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 text-[12px] font-semibold text-[var(--color-muted-foreground)] shadow-none transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-foreground)] data-[state=open]:border-[var(--color-status-at-risk-border)] data-[state=open]:bg-[var(--color-status-at-risk-bg)] data-[state=open]:text-[var(--color-status-at-risk-fg)]"
        data-testid="dev-role-switcher-trigger"
      >
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
  );
}

// Hooks must run unconditionally, so the enabled gate is returned rather than
// short-circuiting here; the component owns the early return.
function useDevRoleSwitcher() {
  const [pending, setPending] = useState(false);
  const trpc = useTRPC();

  const enabled = webEnv.devRoleSwitcher();

  const usersQ = useQuery({
    ...trpc.dev.listUsers.queryOptions(),
    enabled,
    staleTime: DEV_USERS_STALE_TIME_MS,
  });

  // On a failed logout, re-enable the controls (dev-only widget: a cheap alert
  // matches the reseed-error style) so the visitor can retry.
  const stayLoggedIn = () => {
    setPending(false);
    alert(LOGOUT_FAILED_MESSAGE);
  };
  const logoutThen = (href: string) => logoutThenRedirect(href, stayLoggedIn);

  const wipeAndReseedMut = useMutation(
    trpc.dev.wipeAndReseed.mutationOptions({
      // Logout then redirect to landing so the next role pick starts clean.
      onSuccess: () => logoutThen("/"),
      onError: (error) => {
        setPending(false);
        // dev-only widget: cheap alert is fine, we don't ship this in prod
        alert(`Reseed failed:\n${error.message}`);
      },
    }),
  );

  return {
    enabled,
    pending,
    usersQ,
    users: usersQ.data ?? [],
    switchTo: (identity: { role: DbRole; email: string }) => {
      setPending(true);
      const params = new URLSearchParams({
        role: identity.role,
        email: identity.email,
      });
      logoutThen(`/auth/dev-login?${params.toString()}`);
    },
    logout: () => {
      setPending(true);
      logoutThen("/");
    },
    reseed: (variant: DataResetVariant) => {
      setPending(true);
      wipeAndReseedMut.mutate({ variant });
    },
  };
}

export function DevRoleSwitcher() {
  const { enabled, pending, usersQ, users, switchTo, logout, reseed } =
    useDevRoleSwitcher();

  if (!enabled) {
    return null;
  }

  return (
    <div className="contents">
      <DropdownMenu>
        <RoleSwitcherTrigger pending={pending} />
        <DropdownMenuContent
          align="end"
          side="bottom"
          className="max-h-[80vh] w-72 overflow-y-auto"
        >
          <DropdownMenuLabel>Login as…</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {usersQ.isLoading && (
            <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
          )}
          {usersQ.error && (
            <DropdownMenuItem
              disabled
              className="text-[var(--color-destructive)]"
            >
              Load error
            </DropdownMenuItem>
          )}
          <RoleUserItems users={users} onSelect={switchTo} />
          {/* Dev-only data reset — available to every role; the API side is
              still double-gated on AUTH_DEV_MODE. */}
          <DropdownMenuLabel>Data</DropdownMenuLabel>
          <DataResetItems onReseed={reseed} />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => logout()}
            data-testid="dev-role-switcher-logout"
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
