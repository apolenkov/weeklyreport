"use client";

import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc-context";

/**
 * Read-only status surface for external integrations. v1 only shows
 * Telegram: green «Подключён» badge when both `TG_BOT_TOKEN` is set on
 * the API AND at least one active TelegramBinding row exists. Otherwise
 * muted «Не активно».
 *
 * Phase 55 is seeds-only: there is no real bot, no user-binding UI, no
 * outbound flow beyond the admin smoke-test (which lives on the API
 * surface only, not exposed in this tab). The card text states that
 * explicitly so a head/admin reading the tab does not expect /start to
 * work yet.
 */
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

  const { telegram, ci } = statusQ.data;
  // The query type marks `ci` non-null, but the Phase-55 integrations payload
  // can omit it (the Zod contract only guarantees `telegram`), so the optional
  // chain is a real runtime guard, not a redundant one.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- ci absent at runtime despite the optimistic query type (deferred Phase-55 contract)
  const isCiConfigured = ci?.configured ?? false;

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        External integrations available to CustomReport. Activation requires
        admin-issued credentials and a follow-on rollout phase.
      </p>

      {/* Telegram — Phase 55 seeds-only; always shows Coming Soon until the
          full activation phase ships (user binding + real outbound bot). */}
      <div
        className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-hover)] p-4 opacity-70"
        data-testid="integration-row-telegram"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              Telegram
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Push notifications and quick-reply via Telegram bot — replaces
              email reminders for mobile-first teams.
            </p>
          </div>
          <ComingSoonBadge
            className="self-start sm:self-auto"
            data-testid="integration-badge-telegram"
          />
        </div>

        <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
          <dt>Bot configured</dt>
          <dd
            className="font-mono"
            data-testid="integration-telegram-configured"
          >
            {telegram.configured ? "yes" : "no"}
          </dd>
          <dt>Active bindings</dt>
          <dd className="font-mono" data-testid="integration-telegram-bindings">
            {telegram.bindings}
          </dd>
        </dl>
      </div>

      <div
        className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-hover)] p-4 opacity-70"
        data-testid="integration-row-ci"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              CI Integration
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Trigger report generation automatically from CI/CD pipelines — no
              manual deadline tracking needed.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto sm:justify-end">
            <ComingSoonBadge data-testid="integration-badge-ci-coming-soon" />
            {isCiConfigured ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--radius-pill)] bg-[var(--color-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-primary)]"
                data-testid="integration-badge-ci"
                data-state="configured"
              >
                Configured
              </span>
            ) : (
              <span
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]"
                data-testid="integration-badge-ci"
                data-state="not-configured"
              >
                Not configured
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Slack — third provider, Coming Soon until Phase 56 (A11). */}
      <div
        className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-hover)] p-4 opacity-70"
        data-testid="integration-row-slack"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              Slack
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Daily digest and deadline alerts to a team Slack channel — keeps
              everyone updated without checking the dashboard.
            </p>
          </div>
          <ComingSoonBadge
            className="self-start sm:self-auto"
            data-testid="integration-badge-slack"
          />
        </div>
      </div>

      {/* AI Integration — Phase 54 seeds-only; placeholder until provider
          is selected (Anthropic / Yandex / Llama). TODO(Phase-54-activation) */}
      <div
        className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-hover)] p-4 opacity-70"
        data-testid="integration-row-ai"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              AI Summary
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Auto-summary of statuses and extracted risks — 5-second read
              instead of reviewing 30 minutes of section data.
            </p>
          </div>
          <ComingSoonBadge
            className="self-start sm:self-auto"
            data-testid="integration-badge-ai"
          />
        </div>

        <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
          <dt>Provider</dt>
          <dd className="font-mono" data-testid="integration-ai-provider">
            not configured
          </dd>
          <dt>RAG corpus</dt>
          <dd className="font-mono" data-testid="integration-ai-rag">
            empty
          </dd>
        </dl>
      </div>
    </div>
  );
}
