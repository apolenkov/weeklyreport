"use client";

import { useState } from "react";

import type { BlockedAtRiskItem } from "./mock-data";

interface BlockedAtRiskTableProps {
  readonly items: BlockedAtRiskItem[];
}

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 flex-shrink-0"
      style={{ color: "var(--color-destructive)" }}
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
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
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function BlockedAtRiskTable({ items }: BlockedAtRiskTableProps) {
  // head-surface-uat-polish (F4): collapsed by default. The same risk content
  // appears in the report below, so the dashboard treats this as a fast triage
  // peek the head opens on demand rather than a permanently expanded block.
  const [expanded, setExpanded] = useState(false);
  const hasItems = items.length > 0;
  const isExpanded = hasItems && expanded;

  return (
    <div
      className={`overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)] ${
        hasItems
          ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)]"
          : "bg-[rgba(0,0,0,0.035)]"
      }`}
    >
      <button
        type="button"
        className={`flex w-full items-center justify-between p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2 ${
          hasItems
            ? "cursor-pointer hover:bg-[var(--color-surface-hover)]"
            : "cursor-default opacity-65"
        }`}
        onClick={() => {
          if (hasItems) setExpanded(!expanded);
        }}
        disabled={!hasItems}
        aria-disabled={!hasItems}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <AlertIcon />
          <span
            className={`font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] ${
              hasItems
                ? "text-[var(--color-destructive)]"
                : "text-[var(--color-muted-foreground)]"
            }`}
          >
            Blocked & At Risk
          </span>
          <span
            className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold tabular-nums ${
              hasItems
                ? "bg-[#fee2e2] text-[var(--color-destructive)]"
                : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
            }`}
          >
            {items.length} issues
          </span>
        </div>
        <span className={hasItems ? undefined : "opacity-45"}>
          <ChevronDown expanded={isExpanded} />
        </span>
      </button>

      {hasItems ? (
        <div
          className="grid transition-[grid-template-rows] duration-300"
          style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-2 px-4 pb-4 pt-4">
              {items.map((item) => {
                const isBlocked = item.severity === "blocked";
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg p-3"
                    style={{
                      background: isBlocked ? "#fdf8f8" : "#fffcf5",
                      border: isBlocked
                        ? "1px solid rgba(200,32,20,0.1)"
                        : "1px solid rgba(212,160,23,0.1)",
                    }}
                  >
                    <span
                      className="inline-flex flex-shrink-0 items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: isBlocked ? "#fee2e2" : "#fef3c7",
                        color: isBlocked
                          ? "var(--color-destructive)"
                          : "#8a6d1b",
                      }}
                    >
                      {isBlocked ? "Blocked" : "At Risk"}
                    </span>
                    <div className="flex-1">
                      <strong className="text-sm">
                        {item.product} &middot; {item.stage}
                      </strong>{" "}
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        &middot; {item.assignee}
                      </span>
                      <div className="text-xs text-[var(--color-muted-foreground)]">
                        {item.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
