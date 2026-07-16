"use client";

import { ROLE_LABEL } from "@customreport/shared";
import { ChevronDown } from "lucide-react";
import type { RefObject } from "react";
import { useRef, useState } from "react";

import { formatRelativePast } from "../../../lib/format-date";
import type { LeadInfo } from "../model/dashboard";
import { LeadPrimaryAction } from "./lead-queue-actions";
import { LeadQueueDetail } from "./lead-queue-detail";

const STATUS_LABELS: Record<LeadInfo["status"], string> = {
  submitted: "Submitted",
  draft: "In progress",
  pending: "Not started",
};

const STATUS_CLASSES: Record<LeadInfo["status"], string> = {
  submitted:
    "border-[var(--color-starbucks-accent)] bg-[var(--color-success)] text-[var(--color-primary)]",
  draft:
    "border-[var(--color-status-dot-at-risk)] bg-[var(--color-status-at-risk-bg)] text-[var(--color-status-at-risk-fg)]",
  pending:
    "border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

interface LeadSummaryTableProps {
  readonly leads: readonly LeadInfo[];
  readonly reportId: string;
  readonly onMutated: () => void;
}

function freshnessLabel(lead: LeadInfo): string {
  if (lead.status === "submitted") {
    return lead.submittedAt
      ? `Submitted ${formatRelativePast(lead.submittedAt, new Date(), "activity")}`
      : "Submitted";
  }
  if (lead.lastEditAt) {
    return `Edited ${formatRelativePast(lead.lastEditAt, new Date(), "activity")}`;
  }
  return lead.isStale ? "No recent edit" : "No edits yet";
}

function contentSummary(lead: LeadInfo): string {
  const productRecords = lead.reportContentCount ?? 0;
  const activityRecords = lead.activityCount ?? 0;
  const total = productRecords + activityRecords;
  return `${total} record${total === 1 ? "" : "s"} · ${lead.attentionLabel}`;
}

function LeadIdentity({ lead }: { readonly lead: LeadInfo }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs font-bold text-[var(--color-primary)]">
        {lead.initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[var(--color-foreground)]">
          {lead.name}
        </span>
        <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
          {ROLE_LABEL[lead.role]}
        </span>
      </span>
    </div>
  );
}

function LeadStateBadges({ lead }: { readonly lead: LeadInfo }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      <span
        className={`inline-flex rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASSES[lead.status]}`}
      >
        {STATUS_LABELS[lead.status]}
      </span>
      <span className="inline-flex rounded-[var(--radius-pill)] bg-[var(--color-surface-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
        {lead.reviewLabel}
      </span>
    </div>
  );
}

function LeadRowToggle({
  buttonRef,
  detailId,
  expanded,
  onToggle,
}: {
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  readonly detailId: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-expanded={expanded}
      aria-controls={detailId}
      onClick={onToggle}
      className="inline-flex min-h-[var(--touch-target-min)] items-center justify-center gap-1 rounded-[var(--radius-pill)] px-3 text-xs font-semibold text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)]"
    >
      {expanded ? "Less" : "Details"}
      <ChevronDown
        aria-hidden="true"
        className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
      />
    </button>
  );
}

function LeadQueueRowSummary({
  lead,
  reportId,
  onMutated,
  toggleRef,
  detailId,
  expanded,
  onToggle,
}: {
  readonly lead: LeadInfo;
  readonly reportId: string;
  readonly onMutated: () => void;
  readonly toggleRef: RefObject<HTMLButtonElement | null>;
  readonly detailId: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4 lg:grid-cols-[minmax(11rem,1.3fr)_minmax(9rem,0.8fr)_minmax(10rem,1fr)_minmax(9rem,0.8fr)_auto_auto]">
      <LeadIdentity lead={lead} />
      <LeadStateBadges lead={lead} />
      <span className="min-w-0 text-xs text-[var(--color-muted-foreground)]">
        {freshnessLabel(lead)}
        {lead.isStale ? " · Needs attention" : ""}
      </span>
      <span className="min-w-0 text-xs font-medium text-[var(--color-foreground)]">
        {contentSummary(lead)}
      </span>
      <div className="flex flex-wrap items-center sm:justify-end">
        <LeadPrimaryAction
          lead={lead}
          reportId={reportId}
          onMutated={onMutated}
        />
      </div>
      <LeadRowToggle
        buttonRef={toggleRef}
        detailId={detailId}
        expanded={expanded}
        onToggle={onToggle}
      />
    </div>
  );
}

function LeadQueueRow({
  lead,
  reportId,
  onMutated,
}: {
  readonly lead: LeadInfo;
  readonly reportId: string;
  readonly onMutated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const detailId = `lead-queue-detail-${lead.id}`;
  const restoreRowFocus = () => {
    onMutated();
    window.requestAnimationFrame(() => toggleRef.current?.focus());
  };

  return (
    <li
      data-testid="lead-queue-row"
      data-priority={lead.priority}
      className={`min-w-0 overflow-hidden rounded-[var(--radius)] border bg-[var(--color-background)] ${
        lead.isStale
          ? "border-[var(--color-warning)]"
          : "border-[var(--color-border)]"
      }`}
    >
      <LeadQueueRowSummary
        lead={lead}
        reportId={reportId}
        onMutated={restoreRowFocus}
        toggleRef={toggleRef}
        detailId={detailId}
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
      />

      {expanded ? (
        <LeadQueueDetail
          lead={lead}
          reportId={reportId}
          detailId={detailId}
          onMutated={restoreRowFocus}
        />
      ) : null}
    </li>
  );
}

export function LeadSummaryTable({
  leads,
  reportId,
  onMutated,
}: LeadSummaryTableProps) {
  return (
    <section
      className="card-surface min-w-0"
      aria-labelledby="lead-summary-heading"
    >
      <header className="border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="lead-summary-heading"
            className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]"
          >
            Period Summary
          </h2>
          <span className="rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 text-[13px] font-semibold tabular-nums text-[var(--color-muted-foreground)]">
            {leads.length} leads
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          One action queue ordered by review need, freshness, and completion.
        </p>
      </header>

      {leads.length === 0 ? (
        <p className="p-5 text-sm text-[var(--color-muted-foreground)]">
          No lead rows for the current period.
        </p>
      ) : (
        <ul className="grid min-w-0 gap-2 p-3 sm:p-4">
          {leads.map((lead) => (
            <LeadQueueRow
              key={lead.id}
              lead={lead}
              reportId={reportId}
              onMutated={onMutated}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
