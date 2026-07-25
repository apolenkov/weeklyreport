"use client";

import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";

// Element label is the roadmapped channel; dispatch is still Telegram
// (TG_BOT_TOKEN / TelegramBinding) so no live status is shown — that would
// mis-claim Telegram state as Element. ComingSoon marks seeds-only.
export function IntegrationsSubTab() {
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        External integrations available to CustomReport. Activation requires
        admin-issued credentials and a follow-on rollout phase.
      </p>

      {/* data-testid stays "telegram" — internal seam name, not UI label. */}
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

      {/* AI Integration — seeds-only; placeholder until a provider
          is selected (Anthropic / Yandex / Llama). A single provider/model
          selection drives every AI feature (summary, risk extraction, RAG). */}
      <div
        className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-hover)] p-4 opacity-70"
        data-testid="integration-row-ai"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              AI
            </h3>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              One provider and model applied across every AI feature — status
              summaries, risk extraction, and RAG search.
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
