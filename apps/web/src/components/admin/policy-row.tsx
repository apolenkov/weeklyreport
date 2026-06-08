"use client";

import { DerivedRulesPanel } from "./derived-rules-panel";
import type { MockPeriod, MockReminder, MockReminderPolicy } from "./mock-data";
import {
  formatGeneratedRulesSummary,
  formatPolicyAudience,
  formatPolicyTiming,
  formatValidityWindow,
} from "./reminders-tab-format";

interface PolicyRowProps {
  readonly policy: MockReminderPolicy;
  readonly derivedCount: number;
  readonly isExpanded: boolean;
  readonly isMutating: boolean;
  readonly derivedRules: readonly MockReminder[];
  readonly periodById: ReadonlyMap<string, MockPeriod>;
  readonly onToggle: () => void;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}

export function PolicyRow({
  policy,
  derivedCount,
  isExpanded,
  isMutating,
  derivedRules,
  periodById,
  onToggle,
  onEdit,
  onRemove,
}: PolicyRowProps) {
  const generatedSummary = formatGeneratedRulesSummary(derivedCount);

  return (
    <div
      data-testid={`policy-row-${policy.id}`}
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div>
            <h3 className="text-base font-semibold leading-6 text-[var(--color-foreground)]">
              {formatPolicyTiming(policy)}
            </h3>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {formatPolicyAudience(policy.audience)} · {policy.timezone}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
            <span>{formatValidityWindow(policy)}</span>
            <span aria-hidden="true">·</span>
            <span>{generatedSummary}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span
            className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: policy.active
                ? "var(--color-success)"
                : "var(--color-muted)",
              color: policy.active
                ? "var(--color-primary)"
                : "var(--color-muted-foreground)",
            }}
          >
            {policy.active ? "Active" : "Disabled"}
          </span>
          <button
            type="button"
            onClick={onToggle}
            data-testid={`expand-${policy.id}`}
            aria-expanded={isExpanded}
            className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-empty)]"
          >
            {isExpanded ? "Hide schedule" : "Schedule"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={isMutating}
            data-testid={`edit-${policy.id}`}
            className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-empty)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit policy
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={isMutating}
            data-testid={`remove-${policy.id}`}
            className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-transparent bg-white px-3 text-xs font-semibold text-[var(--color-destructive)] transition-colors hover:border-[rgba(200,32,20,0.3)] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          data-testid={`policy-details-${policy.id}`}
          className="mt-3 border-t border-[var(--color-border)] pt-3"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Generated schedule
              </span>
              <span className="rounded-[var(--radius-pill)] bg-[var(--color-surface-empty)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Read-only
              </span>
            </div>
            <span className="text-[var(--color-muted-foreground)]">
              {generatedSummary}
            </span>
          </div>
          <DerivedRulesPanel
            policyId={policy.id}
            rules={derivedRules}
            periodById={periodById}
          />
        </div>
      )}
    </div>
  );
}
