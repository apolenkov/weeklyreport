"use client";

import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../../lib/trpc-context";
import { AiProviderCard } from "./ai-provider-card";

/** Read-only surface for external integrations plus the admin AI control plane. */
export function IntegrationsSubTab() {
  const trpc = useTRPC();
  const statusQ = useQuery(trpc.admin.integrationsStatus.queryOptions());

  if (statusQ.isLoading) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Loading integrations status…
      </p>
    );
  }
  if (statusQ.isError || !statusQ.data) {
    return (
      <p className="text-sm text-red-600">
        Failed to load integrations status.
      </p>
    );
  }
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        External integrations available to CustomReport. AI changes are tested
        before they can affect users.
      </p>
      <div
        className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-hover)] p-4 opacity-70"
        data-testid="integration-row-telegram"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              Element
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Push notifications and quick-reply via Element — replaces email
              reminders for mobile-first teams.
            </p>
          </div>
          <ComingSoonBadge
            className="self-start sm:self-auto"
            data-testid="integration-badge-telegram"
          />
        </div>
      </div>
      <AiProviderCard />
    </div>
  );
}
