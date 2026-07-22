"use client";

import { useId, useState } from "react";

import { RotatingChevron } from "./rotating-chevron";

interface AccordionSectionProps {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly titleColor?: string;
  readonly badge?: string;
  readonly badgeStyle?: React.CSSProperties;
  readonly subtitle?: string;
  readonly defaultOpen?: boolean;
  /**
   * Set by the parent's "Toggle All" button to force every section into the
   * same state. Each prop change clears the current individual override;
   * local clicks then override that group command until the next change.
   */
  readonly groupExpanded?: boolean;
  readonly testId?: string;
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
}

export function AccordionSection({
  icon,
  title,
  titleColor = "var(--color-primary)",
  badge,
  badgeStyle,
  subtitle,
  defaultOpen = true,
  groupExpanded,
  testId,
  actions,
  children,
}: AccordionSectionProps) {
  const [expansion, setExpansion] = useState<{
    readonly groupExpanded: boolean | undefined;
    readonly override: boolean | null;
  }>({ groupExpanded, override: null });
  const groupChanged = expansion.groupExpanded !== groupExpanded;
  if (groupChanged) {
    setExpansion({ groupExpanded, override: null });
  }
  const currentOverride = groupChanged ? null : expansion.override;
  const expanded = currentOverride ?? groupExpanded ?? defaultOpen;
  const setExpanded = (value: boolean) =>
    setExpansion({ groupExpanded, override: value });
  // Stable id on the collapsible panel so both toggles can point their
  // aria-controls at it; derived from testId when present, else a unique id.
  const generatedId = useId();
  const panelId = testId ? `${testId}-panel` : generatedId;

  return (
    <div
      data-testid={testId}
      className="card-surface card-surface-hover transition-shadow"
    >
      <div className="flex w-full items-center justify-between gap-3 p-5 transition-colors hover:bg-[var(--color-surface-hover)]">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={panelId}
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
          {!actions && <RotatingChevron expanded={expanded} />}
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
            aria-controls={panelId}
          >
            <RotatingChevron expanded={expanded} />
          </button>
        ) : null}
      </div>

      <div
        id={panelId}
        className="grid transition-[grid-template-rows] duration-300"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div
          className="min-h-0 overflow-hidden"
          inert={expanded ? undefined : true}
          aria-hidden={!expanded}
        >
          <div className="px-5 pb-5 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
