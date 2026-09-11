"use client";

import { useId, useState } from "react";

import { RotatingChevron } from "./rotating-chevron";

/** Identifies an event that should reveal a collapsed accordion section. */
export type AccordionOpenSignal = number | string | undefined;

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
  // A changed signal opens the section. Its initial value only establishes the
  // baseline, so mounting with an existing signal preserves defaultOpen.
  readonly openSignal?: AccordionOpenSignal;
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
  headingId,
}: AccordionHeadingProps & { readonly headingId: string }) {
  return (
    <span className="block min-w-0">
      <span className="flex items-center gap-3">
        {icon}
        <span
          id={headingId}
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
      </span>
      {subtitle && (
        <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">
          {subtitle}
        </span>
      )}
    </span>
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
      className="flex h-10 w-10 max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)] shrink-0 items-center justify-center rounded-[var(--radius-pill)] transition-colors hover:bg-[var(--color-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1"
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
  headingId,
  expanded,
  children,
}: {
  readonly panelId: string;
  readonly headingId: string;
  readonly expanded: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={headingId}
      className="grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none"
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
  headingId,
  expanded,
  panelId,
  actions,
  onToggle,
}: {
  readonly heading: AccordionHeadingProps;
  readonly headingId: string;
  readonly expanded: boolean;
  readonly panelId: string;
  readonly actions?: React.ReactNode;
  readonly onToggle: () => void;
}) {
  const hasActions = actions !== null && actions !== undefined;
  return (
    <div
      className={`flex w-full items-center justify-between gap-3 p-5 transition-colors hover:bg-[var(--color-surface-hover)] ${hasActions ? "max-sm:flex-wrap" : ""}`}
    >
      <h2 className={`min-w-0 flex-1 ${hasActions ? "max-sm:basis-full" : ""}`}>
        <button
          type="button"
          className="flex w-full min-w-0 items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
        >
          <AccordionHeading {...heading} headingId={headingId} />
          {!actions && <RotatingChevron expanded={expanded} />}
        </button>
      </h2>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 max-sm:ml-auto">
          {actions}
        </div>
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
// wins; a later local click overrides it again until the next group change. A
// subsequent `openSignal` change opens the section even after a local collapse.
function useAccordionExpansion(
  groupExpanded: boolean | undefined,
  defaultOpen: boolean,
  openSignal: AccordionOpenSignal,
): { readonly expanded: boolean; readonly toggleExpanded: () => void } {
  const [expansion, setExpansion] = useState<{
    readonly groupExpanded: boolean | undefined;
    readonly openSignal: AccordionOpenSignal;
    readonly override: boolean | null;
  }>({ groupExpanded, openSignal, override: null });
  const groupChanged = expansion.groupExpanded !== groupExpanded;
  const signalChanged = expansion.openSignal !== openSignal;
  if (groupChanged || signalChanged) {
    setExpansion({
      groupExpanded,
      openSignal,
      override: signalChanged ? true : null,
    });
  }
  const currentOverride = signalChanged
    ? true
    : groupChanged
      ? null
      : expansion.override;
  const expanded = currentOverride ?? groupExpanded ?? defaultOpen;
  return {
    expanded,
    toggleExpanded: () =>
      setExpansion({ groupExpanded, openSignal, override: !expanded }),
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
  openSignal,
  testId,
  actions,
  children,
}: AccordionSectionProps) {
  const { expanded, toggleExpanded } = useAccordionExpansion(
    groupExpanded,
    defaultOpen,
    openSignal,
  );
  // Stable id on the collapsible panel so both toggles can point their
  // aria-controls at it; derived from testId when present, else a unique id.
  const generatedId = useId();
  const panelId = testId ? `${testId}-panel` : generatedId;
  const headingId = `${panelId}-title`;

  return (
    <div
      data-testid={testId}
      data-feedback-anchor={testId}
      className="card-surface card-surface-hover transition-shadow"
    >
      <AccordionHeader
        heading={{ icon, title, titleColor, badge, badgeStyle, subtitle }}
        headingId={headingId}
        expanded={expanded}
        panelId={panelId}
        actions={actions}
        onToggle={toggleExpanded}
      />
      <AccordionPanel
        panelId={panelId}
        headingId={headingId}
        expanded={expanded}
      >
        {children}
      </AccordionPanel>
    </div>
  );
}
