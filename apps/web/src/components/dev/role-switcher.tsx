"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Button } from "@customreport/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@customreport/ui/components/ui/dropdown-menu";

import { useTRPC } from "../../lib/trpc-context";

type Role = "head" | "lead" | "admin" | "viewer";
type DataResetVariant = "minimum" | "advanced" | "manual-uat";

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
    window.location.href = `/auth/dev-login?${params.toString()}`;
  };

  const usersByRole = (usersQ.data ?? []).reduce<
    Record<Role, Array<{ id: string; email: string; name: string; role: Role }>>
  >(
    (acc, u) => {
      const r = u.role as Role;
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
            className="border-amber-400 bg-amber-50 text-amber-900 shadow-lg hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-100"
            data-testid="dev-role-switcher-trigger"
          >
            DEV: switch role
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
          <DropdownMenuLabel>Data</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => reseed("minimum")}
            data-testid="dev-role-switcher-reseed-min"
          >
            Wipe + Reseed (small MVP)
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => reseed("advanced")}
            data-testid="dev-role-switcher-reseed-full"
          >
            Wipe + Reseed (large demo)
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => reseed("manual-uat")}
            data-testid="dev-role-switcher-wipe-manual-uat"
          >
            Wipe reports (manual UAT)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={logout}
            data-testid="dev-role-switcher-logout"
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
