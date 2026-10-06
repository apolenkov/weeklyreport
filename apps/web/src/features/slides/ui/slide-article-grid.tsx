import type { CanonicalStatus, TrafficLightStatus } from "@customreport/shared";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  CornerDownRight,
  FileText,
  Target,
} from "lucide-react";

import {
  statusDotClassName,
  statusLabel,
} from "../../../shared/lib/status/status-presentation";
import { columnsRowCount } from "../model/slide-grid-cells";
import type { GridAuthor, SlideTrafficStatus } from "../model/slide-grid-model";
import type {
  GridProductCard,
  GridSubsection,
} from "../model/slide-grid-products";
import { SlideCell, type SlideRowActivateHandler } from "./slide-article-rows";
import { SLIDE_PRODUCT_STATUS_PRESENTATION } from "./slide-product-status";

// Desktop columns align across every subsection; mobile reads the same cells in order.
const GRID_TEMPLATE =
  "grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[1.35fr_1.25fr_0.85fr_0.85fr]";

const COLUMNS = [
  {
    key: "current" as const,
    label: "Current work",
    icon: Target,
    accent: "text-[var(--color-primary)] border-[var(--color-primary)]",
  },
  {
    key: "next" as const,
    label: "Next focus",
    icon: ArrowRight,
    accent: "text-[var(--color-foreground)] border-[var(--color-foreground)]",
  },
  {
    key: "risks" as const,
    label: "Risks",
    icon: AlertTriangle,
    accent:
      "text-[var(--color-chip-at-risk-text)] border-[var(--color-status-dot-at-risk)]",
  },
  {
    key: "decisions" as const,
    label: "Decisions",
    icon: FileText,
    accent:
      "text-[var(--color-decisions-accent)] border-[var(--color-decisions-accent)]",
  },
];

export function SlideColumnHeaderRow() {
  return (
    <div
      className={`hidden sm:grid ${GRID_TEMPLATE}`}
      data-testid="slide-column-headers"
    >
      {COLUMNS.map(({ key, label, icon: Icon, accent }) => (
        <span
          key={key}
          className={`flex items-center gap-1.5 border-b-2 pb-1 text-xs font-semibold ${accent}`}
        >
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {label}
        </span>
      ))}
    </div>
  );
}

function trafficDotStatus(status: TrafficLightStatus): CanonicalStatus {
  if (status === "red") return "blocked";
  if (status === "yellow") return "at-risk";
  return "on-track";
}

function StatusDot({ status }: { readonly status: SlideTrafficStatus }) {
  if (status == null) return null;
  const canonical = trafficDotStatus(status);
  return (
    <>
      <span
        aria-hidden="true"
        className={`mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full align-middle ${statusDotClassName(canonical)}`}
      />
      <span className="sr-only">{statusLabel(canonical, "screen")}</span>
    </>
  );
}

function ProductStatusMark({
  status,
}: {
  readonly status: TrafficLightStatus;
}) {
  const presentation = SLIDE_PRODUCT_STATUS_PRESENTATION[status];
  const Icon = presentation.Icon;
  return (
    <span
      role="img"
      aria-label={presentation.label}
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span className="sr-only">{presentation.label}</span>
    </span>
  );
}

function SubsectionHeader({
  subsection,
}: {
  readonly subsection: GridSubsection;
}) {
  if (subsection.kind === "product-level") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        <Box aria-hidden="true" className="h-3 w-3" />
        {subsection.name}
      </span>
    );
  }
  return (
    <div className="min-w-0 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
      {/* Inline flow keeps the marker glued to the first word of a long name. */}
      <div className="min-w-0">
        <CornerDownRight
          aria-hidden="true"
          className="mr-1.5 inline h-3 w-3 align-middle"
        />
        <StatusDot status={subsection.status} />
        {subsection.name}
        {subsection.linkedProducts.length > 0 && (
          <span className="ml-1.5 min-w-0 break-words font-normal normal-case tracking-normal">
            Linked products:{" "}
            {subsection.linkedProducts
              .map((product) => product.productName)
              .join(", ")}
          </span>
        )}
      </div>
      {subsection.note ? (
        <div className="mt-0.5 break-words font-normal normal-case tracking-normal text-[var(--color-foreground)]">
          {subsection.note}
        </div>
      ) : null}
    </div>
  );
}

function SubsectionRow({
  subsection,
  authorsById,
  onRowActivate,
}: {
  readonly subsection: GridSubsection;
  readonly authorsById: ReadonlyMap<string, GridAuthor>;
  readonly onRowActivate?: SlideRowActivateHandler | undefined;
}) {
  // A record-less subsection (status-only project) collapses to its header —
  // a 4-column row of em-dashes says nothing the status dot doesn't.
  const empty = columnsRowCount(subsection.columns) === 0;
  return (
    <div className="border-t border-dashed border-[var(--card-surface-border)] pt-2 first:border-t-0 first:pt-0">
      <SubsectionHeader subsection={subsection} />
      {!empty && (
        <div className={`grid ${GRID_TEMPLATE} mt-1.5`}>
          {COLUMNS.map(({ key, label, icon: Icon, accent }) => {
            // On a phone an empty cell drops its heading and shows one
            // "No <label>" line instead of a ruled heading above a lone dash.
            const cellEmpty = subsection.columns[key].length === 0;
            return (
              <div key={key} className="min-w-0">
                <h4
                  className={`mb-1.5 flex items-center gap-1.5 border-b-2 pb-1 text-xs font-semibold sm:hidden ${accent} ${cellEmpty ? "max-sm:hidden" : ""}`}
                >
                  <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                  {label}
                </h4>
                <SlideCell
                  rows={subsection.columns[key]}
                  authorsById={authorsById}
                  showStages={subsection.showStages}
                  label={label}
                  onRowActivate={onRowActivate}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// One product card: status stripe + dot + name, then product-level and
// per-project subsections on the shared grid. A product with no records this
// period renders as a collapsed dashed row.
export function SlideProductCard({
  card,
  authorsById,
  onRowActivate,
}: {
  readonly card: GridProductCard;
  readonly authorsById: ReadonlyMap<string, GridAuthor>;
  readonly onRowActivate?: SlideRowActivateHandler | undefined;
}) {
  if (card.noData) {
    return (
      <div
        data-testid="slide-product-empty"
        className="flex flex-col items-start gap-1 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-muted-foreground)] sm:flex-row sm:items-center sm:gap-2"
      >
        <span className="min-w-0 break-words font-medium sm:truncate">
          {card.name}
        </span>
        <span className="text-xs">no status for this period</span>
      </div>
    );
  }
  const stripe =
    card.status == null
      ? ""
      : SLIDE_PRODUCT_STATUS_PRESENTATION[card.status].stripeClassName;
  return (
    <section
      data-testid="slide-product-card"
      aria-label={card.name}
      className={`space-y-2.5 rounded-[var(--radius)] border border-[var(--card-surface-border)] bg-[var(--color-card)] px-4 py-3 ${stripe}`}
    >
      <h3 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-[var(--color-foreground)]">
        {card.status == null ? null : (
          <ProductStatusMark status={card.status} />
        )}
        {card.status == null ? null : " "}
        <span className="min-w-0 break-words" title={card.name}>
          {card.name}
        </span>
      </h3>
      {card.subsections.map((subsection) => (
        <SubsectionRow
          key={subsection.id}
          subsection={subsection}
          authorsById={authorsById}
          onRowActivate={onRowActivate}
        />
      ))}
    </section>
  );
}
