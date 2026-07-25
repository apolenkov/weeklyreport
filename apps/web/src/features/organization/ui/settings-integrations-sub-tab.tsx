"use client";

import { ComingSoonBadge } from "@customreport/ui/components/coming-soon-badge";
import type { ReactNode } from "react";

// Every row is inert until its rollout phase lands, so the card is dashed,
// dimmed and badged rather than switchable.
function IntegrationCard({
  name,
  description,
  rowTestId,
  badgeTestId,
  children,
}: {
  readonly name: string;
  readonly description: string;
  readonly rowTestId: string;
  readonly badgeTestId: string;
  readonly children?: ReactNode;
}) {
  return (
    <div
      className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-hover)] p-4 opacity-70"
      data-testid={rowTestId}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
            {name}
          </h3>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {description}
          </p>
        </div>
        <ComingSoonBadge
          className="self-start sm:self-auto"
          data-testid={badgeTestId}
        />
      </div>
      {children}
    </div>
  );
}

// Element label is the roadmapped channel; dispatch is still Telegram
// (TG_BOT_TOKEN / TelegramBinding) so no live status is shown — that would
// mis-claim Telegram state as Element. ComingSoon marks seeds-only.
/**
 * Integrations Sub Tab.
 */
export function IntegrationsSubTab() {
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        External integrations available to CustomReport. Activation requires
        admin-issued credentials and a follow-on rollout phase.
      </p>

      {/* data-testid stays "telegram" — internal seam name, not UI label. */}
      <IntegrationCard
        name="Element"
        description="Push notifications and quick-reply via Element — replaces email reminders for mobile-first teams."
        rowTestId="integration-row-telegram"
        badgeTestId="integration-badge-telegram"
      />

      {/* AI Integration — seeds-only; placeholder until a provider
          is selected (Anthropic / Yandex / Llama). A single provider/model
          selection drives every AI feature (summary, risk extraction, RAG). */}
      <IntegrationCard
        name="AI"
        description="One provider and model applied across every AI feature — status summaries, risk extraction, and RAG search."
        rowTestId="integration-row-ai"
        badgeTestId="integration-badge-ai"
      >
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
      </IntegrationCard>
    </div>
  );
}
