"use client";

import type { RecordCommentView } from "@customreport/shared";
import { type ReactNode, useEffect, useState } from "react";

import { pluralize } from "../../../lib/pluralize";
import { sortByPriorityRank } from "../../../lib/priority-sort";
import type {
  ProductReport,
  ReportDecision,
  ReportItem,
  ReportRisk,
} from "../../../shared/lib/dashboard-mock-data";
import { RotatingChevron } from "../../../shared/ui/report-shell/rotating-chevron";
import {
  type RecordCommentAnchor,
  RecordComments,
} from "../../review/ui/record-comments";
import { reportHasContent } from "../model/report-content";

/**
 * review-acknowledgement: the in-app reviewer context threaded from the page.
 * Present ONLY on the live head/viewer surface — the print/PDF path renders the
 * accordion WITHOUT it, so no reviewer notes or composer leak into an export.
 */
export interface AccordionReviewContext {
  readonly currentUserId: string;
  readonly isAdmin: boolean;
  readonly onMutated: () => void;
}

/** Lets the expand animation start before the smooth scroll kicks in. */
const SCROLL_INTO_VIEW_DELAY_MS = 80;

interface ProductAccordionProps {
  readonly report: ProductReport;
  readonly defaultOpen?: boolean;
  readonly highlighted?: boolean;
  readonly scrollIntoViewOnHighlight?: boolean;
  readonly review?: AccordionReviewContext;
}

/**
 * Wraps a content row so its reviewer comments (and, for a designated reviewer,
 * the composer) stack directly under the anchor row. A no-op when `review` is
 * absent (print/PDF) or the record has nothing to show — {@link RecordComments}
 * self-suppresses, so the row layout is unchanged for non-reviewers.
 */
function ReviewedRow({
  review,
  anchor,
  record,
  children,
}: {
  readonly review: AccordionReviewContext | undefined;
  readonly anchor: RecordCommentAnchor;
  readonly record: { comments?: RecordCommentView[]; canReview?: boolean };
  readonly children: ReactNode;
}) {
  // Mount the comments block ONLY when there is something to show — existing
  // comments or a review capability. This keeps the review data-layer (its
  // tRPC hooks) out of every non-reviewer render, so the print/PDF path and a
  // plain read never pull it in.
  const hasReviewContent =
    (record.comments?.length ?? 0) > 0 || (record.canReview ?? false);
  return (
    <>
      {children}
      {review && hasReviewContent ? (
        <RecordComments
          anchor={anchor}
          comments={record.comments ?? []}
          canReview={record.canReview ?? false}
          currentUserId={review.currentUserId}
          isAdmin={review.isAdmin}
          onMutated={review.onMutated}
        />
      ) : null}
    </>
  );
}

interface StatusConfig {
  bg: string;
  text: string;
  avatarBg: string;
  avatarText: string;
}

const CSS = {
  success: "var(--color-success)",
  muted: "var(--color-muted)",
  statusBlockedBg: "var(--color-status-blocked-bg)",
  destructive: "var(--color-destructive)",
  statusAtRiskBorder: "var(--color-status-at-risk-border)",
  statusAtRiskFg: "var(--color-status-at-risk-fg)",
  mutedForeground: "var(--color-muted-foreground)",
} as const;

// apply-status-palette (memo T6 opt 2): red is the only alarm hue (blocked);
// at-risk goes neutral here — the amber signal lives on the row's left
// stripe, not on a flooded amber fill. No hardcoded status hex.
const STATUS_CONFIG = {
  "on-track": {
    bg: CSS.success,
    text: "var(--color-primary)",
    avatarBg: CSS.success,
    avatarText: "var(--color-primary)",
  },
  "at-risk": {
    bg: CSS.muted,
    text: "var(--color-foreground)",
    avatarBg: CSS.muted,
    avatarText: "var(--color-foreground)",
  },
  blocked: {
    bg: CSS.statusBlockedBg,
    text: CSS.destructive,
    avatarBg: CSS.statusBlockedBg,
    avatarText: CSS.destructive,
  },
} as const satisfies Record<string, StatusConfig>;

// head-report-accordion-redesign (user sign-off 2026-06-23): every content row
// — item, risk, decision — shares ONE column grid so all stage labels share one
// left edge and all content shares one left edge (the text no longer jumps).
// Columns: priority | status rail | gutter (stage+owner) | content | status badge.
// Below `md` the fixed gutter/badge rails narrow (gutter 84px, badge auto,
// tighter gaps) so the content column keeps a usable width on a phone; every
// column — and every status signal — remains present.
const ROW_GRID =
  "grid grid-cols-[20px_3px_minmax(0,84px)_minmax(0,1fr)_auto] items-start gap-x-2 md:grid-cols-[20px_3px_minmax(0,124px)_minmax(0,1fr)_104px] md:gap-x-3.5";

// report-card-clarity: the product-status dot in the header reads its hue from a
// named token (red=blocked alarm, amber=at-risk, green=on-track).
const HEADER_STATUS_TONE = {
  "on-track": "var(--color-chip-on-track-border)",
  "at-risk": CSS.statusAtRiskBorder,
  blocked: CSS.destructive,
} as const satisfies Record<string, string>;

// status-color-semantics: each workflow status resolves its badge through named
// tokens — never hardcoded hex. blocked=red alarm, in-progress=steel-blue (the
// added token), completed=success green, planned=muted.
const STATUS_BADGE = {
  blocked: {
    label: "Blocked",
    bg: CSS.statusBlockedBg,
    fg: CSS.destructive,
  },
  "in-progress": {
    label: "In Progress",
    bg: "var(--color-status-in-progress-bg)",
    fg: "var(--color-status-in-progress-fg)",
  },
  completed: {
    label: "Done",
    bg: CSS.success,
    fg: "var(--color-success-foreground)",
  },
  planned: {
    label: "Planned",
    bg: CSS.muted,
    fg: CSS.mutedForeground,
  },
  paused: {
    label: "Paused",
    bg: CSS.muted,
    fg: CSS.mutedForeground,
  },
  postponed: {
    label: "Postponed",
    bg: CSS.muted,
    fg: CSS.mutedForeground,
  },
} as const satisfies Record<string, { label: string; bg: string; fg: string }>;

// Item row left-stripe: red only for blocked (the alarm hue); every other status
// is carried by the right-side badge, so the rail stays a neutral spine.
function itemRailTone(status: string): string {
  return status === "blocked" ? CSS.destructive : "var(--color-border)";
}

// Gold rank marker in the dedicated left column — priorities-only hue
// (status-color-semantics). Sitting in its own column keeps the gutter from
// floating when an item is prioritized, and scales to several priorities.
function RankMark({ rank }: { readonly rank: number }) {
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold tabular-nums"
      style={{
        background: "var(--color-starbucks-gold)",
        color: "var(--color-primary-foreground)",
      }}
      title={`Priority ${rank}`}
    >
      {rank}
    </span>
  );
}

function Rail({ tone }: { readonly tone: string }) {
  return (
    <span
      className="min-h-[22px] self-stretch rounded-[2px]"
      style={{ background: tone }}
      aria-hidden="true"
    />
  );
}

// The fixed-width meta gutter: SDLC stage over the contributing lead's initials.
// report-card-clarity: an identity surface — it never encodes workflow status.
function Gutter({
  stage,
  owner,
}: {
  readonly stage: string;
  readonly owner: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 pt-px">
      {stage ? (
        <span className="truncate text-[12.5px] font-semibold text-[var(--color-foreground)]">
          {stage}
        </span>
      ) : null}
      {owner ? (
        <span className="text-[11px] font-medium tabular-nums text-[var(--color-muted-foreground)]">
          {owner}
        </span>
      ) : null}
    </span>
  );
}

function StatusBadge({ status }: { readonly status: ReportItem["status"] }) {
  const cfg = STATUS_BADGE[status];
  return (
    <span className="flex justify-end pt-px">
      <span
        className="whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
        style={{ background: cfg.bg, color: cfg.fg }}
      >
        {cfg.label}
      </span>
    </span>
  );
}

function ItemRow({ item }: { readonly item: ReportItem }) {
  return (
    <div className={ROW_GRID} data-accordion-row="item">
      <span className="flex min-h-[18px] justify-center pt-px">
        {item.priorityRank != null ? (
          <RankMark rank={item.priorityRank} />
        ) : null}
      </span>
      <Rail tone={itemRailTone(item.status)} />
      <Gutter stage={item.stage ?? ""} owner={item.owner ?? ""} />
      <span className="pt-px text-[14.5px] leading-normal text-[var(--color-foreground)]">
        {item.text}
      </span>
      <StatusBadge status={item.status} />
    </div>
  );
}

function RiskRow({ risk }: { readonly risk: ReportRisk }) {
  const tone =
    risk.severity === "blocked" ? CSS.destructive : CSS.statusAtRiskBorder;
  return (
    <div className={ROW_GRID} data-accordion-row="risk">
      <span className="min-h-[18px]" aria-hidden="true" />
      <Rail tone={tone} />
      <Gutter stage={risk.stage ?? ""} owner={risk.owner ?? ""} />
      <span className="pt-px">
        <div className="text-[14.5px] leading-snug text-[var(--color-foreground)]">
          {risk.problem ?? risk.text}
        </div>
        {risk.impact || risk.mitigation ? (
          <div className="mt-1.5 grid grid-cols-[84px_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-1">
            {risk.impact ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--color-destructive)]">
                  Impact
                </span>
                <span className="text-[13px] leading-snug">{risk.impact}</span>
              </>
            ) : null}
            {risk.mitigation ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--color-muted-foreground)]">
                  Mitigation
                </span>
                <span className="text-[13px] leading-snug text-[var(--color-starbucks-accent)]">
                  {risk.mitigation}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </span>
      <span aria-hidden="true" />
    </div>
  );
}

// head-surface-uat-polish (F2): a lead-raised escalation ("needs attention")
// is folded into Risks & Blockers as a leading row instead of a separate banner
// the head did not recognize. It carries only a description + severity (no
// stage/impact/mitigation), so it renders as a compact risk-style row with a
// "Flagged" gutter and a Blocked / At Risk badge.
function EscalationRow({
  description,
  severity,
}: {
  readonly description: string;
  readonly severity: "blocked" | "at-risk";
}) {
  const isBlocked = severity === "blocked";
  const tone = isBlocked ? CSS.destructive : CSS.statusAtRiskBorder;
  return (
    <div className={ROW_GRID} data-accordion-row="escalation">
      <span className="min-h-[18px]" aria-hidden="true" />
      <Rail tone={tone} />
      <Gutter stage="Flagged" owner="" />
      <span className="pt-px text-[14.5px] leading-snug text-[var(--color-foreground)]">
        {description}
      </span>
      <span className="flex justify-end pt-px">
        <span
          className="whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
          style={
            isBlocked
              ? {
                  background: CSS.statusBlockedBg,
                  color: CSS.destructive,
                }
              : {
                  background: "var(--color-surface-muted)",
                  color: CSS.statusAtRiskFg,
                }
          }
        >
          {isBlocked ? "Blocked" : "At Risk"}
        </span>
      </span>
    </div>
  );
}

function DecisionRow({ decision }: { readonly decision: ReportDecision }) {
  return (
    <div className={ROW_GRID} data-accordion-row="decision">
      <span className="min-h-[18px]" aria-hidden="true" />
      <Rail tone="var(--color-decisions-accent)" />
      <Gutter stage="Decision" owner={decision.owner ?? ""} />
      <span className="pt-px text-[14.5px] leading-normal text-[var(--color-foreground)]">
        {decision.text}
      </span>
      <span aria-hidden="true" />
    </div>
  );
}

function SectionHeader({
  title,
  count,
}: {
  readonly title: string;
  readonly count: string;
}) {
  return (
    <div className="mb-3">
      <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-foreground)]">
        {title}
      </span>
      <span className="ml-2 text-[12px] font-medium tabular-nums text-[var(--color-muted-foreground)]">
        {count}
      </span>
    </div>
  );
}

const SECTION_DIVIDER =
  "border-t border-[rgba(0,0,0,0.06)] pt-5 first:border-t-0 first:pt-0";

export function ProductAccordion({
  report,
  defaultOpen = false,
  highlighted = false,
  scrollIntoViewOnHighlight = false,
  review,
}: ProductAccordionProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const hasContent = reportHasContent(report);
  const isEmpty = !hasContent;
  const config = isEmpty
    ? {
        bg: CSS.muted,
        text: CSS.mutedForeground,
        avatarBg: CSS.muted,
        avatarText: CSS.mutedForeground,
      }
    : ((STATUS_CONFIG as Record<string, StatusConfig>)[report.status] ??
      STATUS_CONFIG["on-track"]);
  const statusLabel = isEmpty ? "No updates" : report.statusLabel;
  const statusTone = isEmpty
    ? CSS.mutedForeground
    : ((HEADER_STATUS_TONE as Record<string, string>)[report.status] ??
      HEADER_STATUS_TONE["on-track"]);

  // report-card-clarity / head-surface-uat-polish (F2): suppress the escalation
  // when its text is verbatim a row already rendered in this card. The
  // escalation is DERIVED from a blocked item or risk, so it would otherwise
  // repeat that row — and since F2 folds it INTO Risks & Blockers, a matching
  // risk would sit immediately above its duplicate. A genuinely distinct
  // head-facing summary (no exact item/risk match) still surfaces as a leading
  // Flagged row.
  const renderedTexts = new Set([
    ...report.currentWeek.map((item) => item.text),
    ...report.nextWeek.map((item) => item.text),
    ...report.risks.map((risk) => risk.problem ?? risk.text),
  ]);
  const showNeedsAttention =
    Boolean(report.needsAttention) &&
    !renderedTexts.has(report.needsAttention ?? "");

  useEffect(() => {
    if (highlighted && hasContent) setExpanded(true);
  }, [highlighted, hasContent]);

  useEffect(() => {
    if (!highlighted || !scrollIntoViewOnHighlight) return;
    const handle = window.setTimeout(() => {
      document
        .getElementById(`report-product-${report.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, SCROLL_INTO_VIEW_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [highlighted, report.id, scrollIntoViewOnHighlight]);

  return (
    <div
      id={`report-product-${report.id}`}
      className={`card-surface-elevated scroll-mt-28 overflow-hidden rounded-[var(--radius)] border transition-[border-color,box-shadow] ${
        isEmpty ? "bg-[rgba(0,0,0,0.035)] opacity-90" : "card-surface-fill"
      }`}
      style={{
        borderColor:
          highlighted && hasContent
            ? "var(--color-starbucks-accent)"
            : "rgba(0,0,0,0.10)",
        boxShadow:
          highlighted && hasContent
            ? "0 0 0 2px var(--color-highlight-shadow), 0 8px 18px -14px rgba(0,0,0,0.18)"
            : undefined,
      }}
    >
      <button
        type="button"
        className={`flex w-full items-center justify-between gap-3 p-4 transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2 ${
          hasContent
            ? "cursor-pointer hover:bg-[var(--color-surface-muted)]"
            : "cursor-default bg-[var(--color-background)] opacity-65"
        }`}
        onClick={() => {
          if (hasContent) setExpanded(!expanded);
        }}
        disabled={!hasContent}
        aria-disabled={!hasContent}
        aria-expanded={hasContent ? expanded : false}
        data-product-accordion-toggle="true"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 pr-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
            style={{ background: config.avatarBg, color: config.avatarText }}
          >
            {report.initials}
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="truncate font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.015em]">
                {report.name}
              </span>
              <span
                className="inline-flex flex-shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em]"
                style={{ color: statusTone }}
              >
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: statusTone }}
                  aria-hidden="true"
                />
                {statusLabel}
              </span>
            </div>
            <span className="truncate text-[12.5px] text-[var(--color-muted-foreground)]">
              {report.leads}
            </span>
          </div>
        </div>
        {hasContent ? (
          <RotatingChevron expanded={expanded} />
        ) : (
          <span className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        )}
      </button>

      {hasContent ? (
        <div
          className="grid transition-[grid-template-rows] duration-300"
          style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-5 border-t border-[rgba(0,0,0,0.06)] px-5 pb-5 pt-4">
              {report.currentWeek.length > 0 && (
                <div className={SECTION_DIVIDER}>
                  <SectionHeader
                    title="Current Week"
                    count={`${report.currentWeek.length} ${pluralize(
                      report.currentWeek.length,
                      "item",
                      "items",
                    )}`}
                  />
                  <div className="space-y-px">
                    {sortByPriorityRank(report.currentWeek).map((item) => (
                      <ReviewedRow
                        key={item.id}
                        review={review}
                        anchor={{ itemId: item.id }}
                        record={item}
                      >
                        <ItemRow item={item} />
                      </ReviewedRow>
                    ))}
                  </div>
                </div>
              )}

              {report.nextWeek.length > 0 && (
                <div className={SECTION_DIVIDER}>
                  <SectionHeader
                    title="Next Week"
                    count={`${report.nextWeek.length} ${pluralize(
                      report.nextWeek.length,
                      "item",
                      "items",
                    )}`}
                  />
                  <div className="space-y-px">
                    {report.nextWeek.map((item) => (
                      <ReviewedRow
                        key={item.id}
                        review={review}
                        anchor={{ itemId: item.id }}
                        record={item}
                      >
                        <ItemRow item={item} />
                      </ReviewedRow>
                    ))}
                  </div>
                </div>
              )}

              {(report.risks.length > 0 || showNeedsAttention) && (
                <div className={SECTION_DIVIDER}>
                  <SectionHeader
                    title="Risks & Blockers"
                    count={`${report.risks.length + (showNeedsAttention ? 1 : 0)}`}
                  />
                  <div className="space-y-1">
                    {showNeedsAttention && report.needsAttention ? (
                      <EscalationRow
                        description={report.needsAttention}
                        severity={report.needsAttentionSeverity ?? "at-risk"}
                      />
                    ) : null}
                    {report.risks.map((risk) => (
                      <ReviewedRow
                        key={risk.id}
                        review={review}
                        anchor={{ riskId: risk.id }}
                        record={risk}
                      >
                        <RiskRow risk={risk} />
                      </ReviewedRow>
                    ))}
                  </div>
                </div>
              )}

              {report.decisions.length > 0 && (
                <div className={SECTION_DIVIDER}>
                  <SectionHeader
                    title="Decisions"
                    count={`${report.decisions.length}`}
                  />
                  <div className="space-y-px">
                    {report.decisions.map((decision) => (
                      <ReviewedRow
                        key={decision.id}
                        review={review}
                        anchor={{ decisionId: decision.id }}
                        record={decision}
                      >
                        <DecisionRow decision={decision} />
                      </ReviewedRow>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
