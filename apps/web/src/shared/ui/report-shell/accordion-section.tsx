"use client";

import { useId, useState } from "react";

import { RotatingChevron } from "./rotating-chevron";

interface AccordionSectionProps {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly titleColor?: string;
  readonly badge?: string | undefined;
  readonly badgeStyle?: React.CSSProperties | undefined;
  readonly subtitle?: string | undefined;
  readonly defaultOpen?: boolean;
  // Set by the parent's "Toggle All" to force every section into one state.
  readonly groupExpanded?: boolean | undefined;
  readonly testId?: string | undefined;
  readonly actions?: React.ReactNode | undefined;
  readonly children: React.ReactNode;
}

interface AccordionHeadingProps {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly titleColor: string;
  readonly badge?: string | undefined;
  readonly badgeStyle?: React.CSSProperties | undefined;
  readonly subtitle?: string | undefined;
}

function AccordionHeading({
  icon,
  title,
  titleColor,
  badge,
  badgeStyle,
  subtitle,
}: AccordionHeadingProps) {
  return (
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
  );
}

// Rendered only alongside `actions`: the heading button then holds no chevron,
// so this dedicated control carries the expand/collapse affordance.
function AccordionActionsToggle({
  expanded,
  title,
  panelId,
  onToggle,
}: {
  readonly expanded: boolean;
  readonly title: string;
  readonly panelId: string;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-10 w-10 max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)] shrink-0 items-center justify-center rounded-[var(--radius-pill)] transition-colors hover:bg-[var(--color-card)]"
      onClick={onToggle}
      aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
      aria-expanded={expanded}
      aria-controls={panelId}
    >
      <RotatingChevron expanded={expanded} />
    </button>
  );
}

function AccordionPanel({
  panelId,
  expanded,
  children,
}: {
  readonly panelId: string;
  readonly expanded: boolean;
  readonly children: React.ReactNode;
}) {
  return (
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
  );
}

function AccordionHeader({
  heading,
  expanded,
  panelId,
  actions,
  onToggle,
}: {
  readonly heading: AccordionHeadingProps;
  readonly expanded: boolean;
  readonly panelId: string;
  readonly actions?: React.ReactNode;
  readonly onToggle: () => void;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-3 p-5 transition-colors hover:bg-[var(--color-surface-hover)]">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <AccordionHeading {...heading} />
        {!actions && <RotatingChevron expanded={expanded} />}
      </button>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
      {actions ? (
        <AccordionActionsToggle
          expanded={expanded}
          title={heading.title}
          panelId={panelId}
          onToggle={onToggle}
        />
      ) : null}
    </div>
  );
}

// Each `groupExpanded` change clears the individual override, so a group command
// wins; a later local click overrides it again until the next group change.
function useAccordionExpansion(
  groupExpanded: boolean | undefined,
  defaultOpen: boolean,
): { readonly expanded: boolean; readonly toggleExpanded: () => void } {
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
  return {
    expanded,
    toggleExpanded: () => setExpansion({ groupExpanded, override: !expanded }),
  };
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
  const { expanded, toggleExpanded } = useAccordionExpansion(
    groupExpanded,
    defaultOpen,
  );
  // Stable id on the collapsible panel so both toggles can point their
  // aria-controls at it; derived from testId when present, else a unique id.
  const generatedId = useId();
  const panelId = testId ? `${testId}-panel` : generatedId;

  return (
    <div
      data-testid={testId}
      className="card-surface card-surface-hover transition-shadow"
    >
      <AccordionHeader
        heading={{ icon, title, titleColor, badge, badgeStyle, subtitle }}
        expanded={expanded}
        panelId={panelId}
        actions={actions}
        onToggle={toggleExpanded}
      />
      <AccordionPanel panelId={panelId} expanded={expanded}>
        {children}
      </AccordionPanel>
    </div>
  );
}
