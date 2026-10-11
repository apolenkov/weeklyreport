"use client";

import { ROLE_LABEL } from "@customreport/shared";
import { ChevronDown } from "lucide-react";
import type { RefObject } from "react";
import { useRef, useState } from "react";

import { pluralize } from "../../../shared/lib/format/pluralize";
import type { LeadInfo } from "../model/dashboard";
import { LeadPrimaryAction } from "./lead-queue-actions";
import { LeadQueueDetail } from "./lead-queue-detail";
import {
  contentSummary,
  freshnessLabel,
  QUEUE_ACTION_CELL_CLASS,
  QUEUE_ACTIONS_CLASS,
  QUEUE_META_CLASS,
  QUEUE_ROW_GRID_CLASS,
  STATUS_CLASSES,
  STATUS_LABELS,
} from "./lead-row-format";

interface LeadSummaryTableProps {
  readonly leads: readonly LeadInfo[];
  // Leads the period expects; the queue lists only those that have a section.
  readonly expectedLeads?: number | undefined;
  readonly reportId: string;
  readonly onMutated: () => void;
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
        {lead.role === "lead" ? null : (
          <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
            {ROLE_LABEL[lead.role]}
          </span>
        )}
      </span>
    </div>
  );
}

function LeadStateBadges({ lead }: { readonly lead: LeadInfo }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5 max-sm:flex-col max-sm:items-end max-lg:justify-end">
      <span
        className={`inline-flex rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASSES[lead.status]}`}
      >
        {STATUS_LABELS[lead.status]}
      </span>
      {lead.status === "submitted" ||
      lead.reviewState === "changes-requested" ? (
        <span className="inline-flex rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-foreground)]">
          {lead.reviewLabel}
        </span>
      ) : null}
    </div>
  );
}

function LeadRowToggle({
  buttonRef,
  detailId,
  expanded,
  leadName,
  onToggle,
}: {
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  readonly leadName: string;
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
      aria-label={`${expanded ? "Less details" : "Details"} for ${leadName}`}
      onClick={onToggle}
      className={`inline-flex h-[var(--dashboard-action-h)] items-center justify-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2 text-xs font-semibold text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] ${QUEUE_ACTION_CELL_CLASS}`}
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
    <div className={QUEUE_ROW_GRID_CLASS}>
      <LeadIdentity lead={lead} />
      <LeadStateBadges lead={lead} />
      <div className={QUEUE_META_CLASS}>
        <span className="min-w-0 text-xs text-[var(--color-muted-foreground)] max-lg:after:ml-2 max-lg:after:content-['·']">
          {freshnessLabel(lead)}
          {lead.isStale ? " · Needs attention" : ""}
        </span>
        <span className="min-w-0 text-xs font-medium text-[var(--color-foreground)]">
          {contentSummary(lead)}
        </span>
      </div>
      <div className={QUEUE_ACTIONS_CLASS}>
        <div
          className={`flex flex-wrap items-center sm:justify-end [&>a]:h-[var(--dashboard-action-h)] [&>a]:w-full [&>a]:justify-center [&>button]:h-[var(--dashboard-action-h)] [&>button]:w-full [&>button]:justify-center ${QUEUE_ACTION_CELL_CLASS}`}
        >
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
          leadName={lead.name}
          onToggle={onToggle}
        />
      </div>
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

function LeadCountBadge({
  listed,
  expected,
}: {
  readonly listed: number;
  readonly expected: number | undefined;
}) {
  const total = expected ?? listed;
  const outOfScope = total > listed;
  return (
    <span
      title={
        outOfScope
          ? `Queue lists the ${listed} ${pluralize(listed, "lead", "leads")} in your scope; the Submissions card counts all ${total}`
          : undefined
      }
      className="rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 text-[13px] font-semibold tabular-nums text-[var(--color-muted-foreground)]"
    >
      {outOfScope
        ? `${listed} of ${total} leads`
        : `${listed} ${pluralize(listed, "lead", "leads")}`}
    </span>
  );
}

export function LeadSummaryTable({
  leads,
  expectedLeads,
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
          <LeadCountBadge listed={leads.length} expected={expectedLeads} />
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
