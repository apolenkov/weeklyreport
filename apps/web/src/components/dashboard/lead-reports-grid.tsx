"use client";

import { useState } from "react";

import type { LeadInfo } from "./mock-data";
import { LeadReportCard } from "./lead-report-card";

type LeadReportsGridProps = {
  readonly leads: LeadInfo[];
};

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 flex-shrink-0"
      style={{ color: "var(--color-primary)" }}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function ChevronDown({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-[var(--color-muted-foreground)] transition-transform duration-300"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function LeadReportsGrid({ leads }: LeadReportsGridProps) {
  const [expanded, setExpanded] = useState(true);
  const reportableLeads = leads.filter(
    (lead) => (lead.reportContentCount ?? 0) > 0,
  );
  const hasLeads = reportableLeads.length > 0;
  const isExpanded = hasLeads && expanded;

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)]">
      <button
        type="button"
        className={`flex w-full items-center justify-between p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2 ${
          hasLeads
            ? "cursor-pointer hover:bg-[#f8f6f2]"
            : "cursor-default opacity-65"
        }`}
        onClick={() => {
          if (hasLeads) setExpanded(!expanded);
        }}
        disabled={!hasLeads}
        aria-disabled={!hasLeads}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <UsersIcon />
          <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-primary)]">
            Lead Reports
          </span>
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold tabular-nums text-[var(--color-muted-foreground)]">
            {reportableLeads.length} reports
          </span>
        </div>
        <ChevronDown expanded={isExpanded} />
      </button>

      {hasLeads ? (
        <div
          className="grid transition-[grid-template-rows] duration-300"
          style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-1.5 px-4 pb-4 pt-4">
              {reportableLeads.map((lead) => (
                <LeadReportCard key={lead.id} lead={lead} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4 pt-2">
          <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
            No lead reports yet.
          </div>
        </div>
      )}
    </div>
  );
}
