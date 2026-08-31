"use client";

import type { DbRole, ReseedVariant } from "@customreport/shared";
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
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { logoutThenRedirect } from "../../lib/navigation/logout-then-redirect";
import { webEnv } from "../../lib/runtime/web-env";
import { useTRPC } from "../../lib/trpc/trpc-context";

type DataResetVariant = ReseedVariant;

export const ROLE_ORDER = [
  "head",
  "admin",
  "lead",
  "viewer",
] as const satisfies readonly DbRole[];
// Intentionally differs from schema order; exported only for the completeness test.
const LOGOUT_FAILED_MESSAGE =
  "Logout failed — still signed in. Check the API and try again.";
const DEV_USERS_STALE_TIME_MS = 60_000;
const MOBILE_MENU_ITEM_CLASS = "max-md:min-h-[var(--touch-target-min)]";

interface RoleSwitcherUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
}

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
              className={`${MOBILE_MENU_ITEM_CLASS} flex flex-col items-start gap-0.5`}
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

const DATA_RESET_ACTIONS = [
  ["minimal", "Wipe + Reseed (minimal)", "reseed-minimal"],
  ["demo", "Wipe + Reseed (demo)", "reseed-demo"],
  ["full", "Wipe + Reseed (full)", "reseed-full"],
  ["stress", "Wipe + Reseed (stress)", "reseed-stress"],
] as const satisfies readonly [DataResetVariant, string, string][];

function DataResetItems({
  onReseed,
}: {
  readonly onReseed: (variant: DataResetVariant) => void;
}) {
  return (
    <>
      {DATA_RESET_ACTIONS.map(([variant, label, testId]) => (
        <DropdownMenuItem
          key={variant}
          onSelect={() => onReseed(variant)}
          data-testid={`dev-role-switcher-${testId}`}
          className={MOBILE_MENU_ITEM_CLASS}
        >
          {label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function RoleSwitcherTrigger({
  pending,
  triggerRef,
}: {
  readonly pending: boolean;
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        disabled={pending}
        aria-label="Switch development role"
        title="Switch development role"
        className="inline-flex h-8 max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)] items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 text-[12px] font-semibold text-[var(--color-muted-foreground)] shadow-none transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-foreground)] data-[state=open]:border-[var(--color-status-at-risk-border)] data-[state=open]:bg-[var(--color-status-at-risk-bg)] data-[state=open]:text-[var(--color-status-at-risk-fg)]"
        data-testid="dev-role-switcher-trigger"
      >
        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
  );
}

function useDevRoleSwitcher() {
  const [pending, setPending] = useState(false);
  const [focusRecoveryToken, setFocusRecoveryToken] = useState(0);
  const trpc = useTRPC();

  const enabled = webEnv.devRoleSwitcher();

  const usersQ = useQuery({
    ...trpc.dev.listUsers.queryOptions(),
    enabled,
    staleTime: DEV_USERS_STALE_TIME_MS,
  });

  const recoverFromFailure = () => {
    setPending(false);
    setFocusRecoveryToken((token) => token + 1);
  };
  const stayLoggedIn = () => {
    recoverFromFailure();
    alert(LOGOUT_FAILED_MESSAGE);
  };
  const logoutThen = (href: string) => logoutThenRedirect(href, stayLoggedIn);

  const wipeAndReseedMut = useMutation(
    trpc.dev.wipeAndReseed.mutationOptions({
      onSuccess: () => logoutThen("/"),
      onError: (error) => {
        recoverFromFailure();
        alert(`Reseed failed:\n${error.message}`);
      },
    }),
  );

  return {
    enabled,
    pending,
    focusRecoveryToken,
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const {
    enabled,
    pending,
    focusRecoveryToken,
    usersQ,
    users,
    switchTo,
    logout,
    reseed,
  } = useDevRoleSwitcher();

  useEffect(() => {
    if (!pending && focusRecoveryToken > 0) triggerRef.current?.focus();
  }, [focusRecoveryToken, pending]);

  if (!enabled) return null;

  return (
    <div className="contents">
      <DropdownMenu>
        <RoleSwitcherTrigger pending={pending} triggerRef={triggerRef} />
        <DropdownMenuContent
          align="end"
          side="bottom"
          className="max-h-[80vh] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto"
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
          <DropdownMenuLabel>Data</DropdownMenuLabel>
          <DataResetItems onReseed={reseed} />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => logout()}
            data-testid="dev-role-switcher-logout"
            className={MOBILE_MENU_ITEM_CLASS}
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
