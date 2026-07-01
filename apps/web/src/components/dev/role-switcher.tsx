"use client";

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

type Role = "head" | "lead" | "admin" | "viewer";
type DataResetVariant = "small" | "middle" | "huge" | "manual-uat";

const ROLE_LABEL: Record<Role, string> = {
  head: "Department Head",
  admin: "Admin",
  lead: "Lead",
  viewer: "Viewer",
};

const ROLE_ORDER: Role[] = ["head", "admin", "lead", "viewer"];

export function DevRoleSwitcher() {
  const [pending, setPending] = useState(false);
  const trpc = useTRPC();

  const enabled =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEV_ROLE_SWITCHER === "true";

  const usersQ = useQuery({
    ...trpc.dev.listUsers.queryOptions(),
    enabled,
    staleTime: 60_000,
  });

  // dev.wipeAndReseed is adminProcedure, so the data-reset controls only work
  // for an admin session — surface them to admins alone rather than let other
  // roles trigger a FORBIDDEN alert.
  const meQ = useQuery({ ...trpc.auth.me.queryOptions(), enabled });
  const isAdmin = meQ.data?.role === "admin";

  // Hooks must run unconditionally — guard the gate below.
  const wipeAndReseedMut = useMutation(
    trpc.dev.wipeAndReseed.mutationOptions({
      onSuccess: () => {
        // Logout then redirect to landing so the next role pick starts clean.
        void fetch("/auth/logout", {
          method: "POST",
          credentials: "include",
        }).finally(() => {
          window.location.href = "/";
        });
      },
      onError: (error) => {
        setPending(false);
        // dev-only widget: cheap alert is fine, we don't ship this in prod
        alert(`Reseed failed:\n${error.message}`);
      },
    }),
  );

  if (!enabled) {
    return null;
  }

  const switchTo = (identity: { role: Role; email: string }) => {
    setPending(true);
    const params = new URLSearchParams({
      role: identity.role,
      email: identity.email,
    });
    void fetch("/auth/logout", {
      method: "POST",
      credentials: "include",
    }).finally(() => {
      window.location.href = `/auth/dev-login?${params.toString()}`;
    });
  };

  const usersByRole = (usersQ.data ?? []).reduce<
    Record<Role, { id: string; email: string; name: string; role: Role }[]>
  >(
    (acc, u) => {
      const r = u.role;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- reduce accumulator is sparse during build (noUncheckedIndexedAccess off lies non-null)
      acc[r] = acc[r] ?? [];
      acc[r].push({ ...u, role: r });
      return acc;
    },
    { head: [], admin: [], lead: [], viewer: [] },
  );

  const logout = async () => {
    setPending(true);
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.href = "/";
    }
  };

  const reseed = (variant: DataResetVariant) => {
    setPending(true);
    wipeAndReseedMut.mutate({ variant });
  };

  return (
    <div className="contents">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-2.5 text-[12px] font-semibold text-[var(--color-muted-foreground)] shadow-none transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-foreground)] data-[state=open]:border-amber-400 data-[state=open]:bg-amber-50 data-[state=open]:text-amber-900"
            data-testid="dev-role-switcher-trigger"
          >
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
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
            <DropdownMenuItem disabled className="text-red-600">
              Load error
            </DropdownMenuItem>
          )}
          {ROLE_ORDER.flatMap((role) => {
            const list = usersByRole[role];
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- usersByRole is a sparse accumulator; a role may have no key at runtime
            if (!list?.length) return [];
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
                  onSelect={() => switchTo({ role, email: u.email })}
                  data-testid={`dev-role-switcher-${role}-${u.email}`}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="font-medium">{u.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {u.email}
                  </span>
                </DropdownMenuItem>
              )),
              <DropdownMenuSeparator key={`${role}-sep`} />,
            ];
          })}
          {isAdmin && (
            <>
              <DropdownMenuLabel>Data</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => reseed("small")}
                data-testid="dev-role-switcher-reseed-small"
              >
                Wipe + Reseed (small)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => reseed("middle")}
                data-testid="dev-role-switcher-reseed-middle"
              >
                Wipe + Reseed (middle)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => reseed("huge")}
                data-testid="dev-role-switcher-reseed-huge"
              >
                Wipe + Reseed (huge)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => reseed("manual-uat")}
                data-testid="dev-role-switcher-wipe-manual-uat"
              >
                Wipe reports (manual UAT)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onSelect={() => {
              void logout();
            }}
            data-testid="dev-role-switcher-logout"
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
