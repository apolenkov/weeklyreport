"use client";

import { useEffect, useState } from "react";

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

type AccordionSectionProps = {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly titleColor?: string;
  readonly badge?: string;
  readonly badgeStyle?: React.CSSProperties;
  readonly subtitle?: string;
  readonly defaultOpen?: boolean;
  /**
   * Bumped by the parent's "Toggle All" button to force every section into the
   * same state. Each bump increments the number; the section mirrors
   * `groupExpanded` into its local state on every change. Local clicks
   * afterwards still toggle individual sections — the group sync only fires
   * when the parent actively changes the signal.
   */
  readonly groupSyncKey?: number;
  readonly groupExpanded?: boolean;
  readonly testId?: string;
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
};

export function AccordionSection({
  icon,
  title,
  titleColor = "var(--color-primary)",
  badge,
  badgeStyle,
  subtitle,
  defaultOpen = true,
  groupSyncKey,
  groupExpanded,
  testId,
  actions,
  children,
}: AccordionSectionProps) {
  const [expanded, setExpanded] = useState(defaultOpen);

  useEffect(() => {
    if (groupSyncKey === undefined || groupExpanded === undefined) return;
    setExpanded(groupExpanded);
  }, [groupSyncKey, groupExpanded]);

  return (
    <div
      data-testid={testId}
      className="overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_12px_26px_-18px_rgba(0,0,0,0.22),0_2px_4px_rgba(0,0,0,0.06)]"
    >
      <div className="flex w-full items-center justify-between gap-3 p-5 transition-colors hover:bg-[var(--color-surface-hover)]">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {icon}
              <span
                className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em]"
                style={{ color: titleColor }}
              >
                {title}
              </span>
              {badge && (
                <span
                  className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2.5 py-0.5 font-[family-name:var(--font-sans)] text-[13px] font-semibold tabular-nums text-[var(--color-muted-foreground)]"
                  style={badgeStyle}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
                {subtitle}
              </span>
            )}
          </div>
          {!actions && <ChevronDown expanded={expanded} />}
        </button>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
        {actions ? (
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-pill)] transition-colors hover:bg-white"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            aria-expanded={expanded}
          >
            <ChevronDown expanded={expanded} />
          </button>
        ) : null}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-5 pb-5 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
