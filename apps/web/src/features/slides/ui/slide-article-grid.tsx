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
} from "../../../lib/status-presentation";
import { columnsRowCount } from "../model/slide-grid-cells";
import type {
  GridAuthor,
  GridProductCard,
  GridSubsection,
  SlideTrafficStatus,
} from "../model/slide-grid-model";
import { SlideCell, type SlideRowActivateHandler } from "./slide-article-rows";
import { SLIDE_PRODUCT_STATUS_PRESENTATION } from "./slide-product-status";

// Shared by the header row and every subsection (openspec/specs/
// lead-slide-by-product-grid, "Subsections share one four-column grid"). Keep
// 4 lanes: the fixed Risks position is the head's severity scan-line.
const GRID_TEMPLATE = "grid grid-cols-[1.35fr_1.25fr_0.85fr_0.85fr] gap-x-4";

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

/** Rendered once per slide, above the first product card. */
export function SlideColumnHeaderRow() {
  return (
    <div className={GRID_TEMPLATE} data-testid="slide-column-headers">
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
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusDotClassName(canonical)}`}
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
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
        <Box aria-hidden="true" className="h-3 w-3" />
        {subsection.name}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
      <CornerDownRight aria-hidden="true" className="h-3 w-3" />
      <StatusDot status={subsection.status} />
      {subsection.name}
    </span>
  );
}

function SubsectionRow({
  subsection,
  authorsById,
  onRowActivate,
}: {
  readonly subsection: GridSubsection;
  readonly authorsById: ReadonlyMap<string, GridAuthor>;
  readonly onRowActivate?: SlideRowActivateHandler;
}) {
  // A record-less subsection (status-only project) collapses to its header —
  // a 4-column row of em-dashes says nothing the status dot doesn't.
  const empty = columnsRowCount(subsection.columns) === 0;
  return (
    <div className="border-t border-dashed border-[rgba(0,0,0,0.10)] pt-2 first:border-t-0 first:pt-0">
      <SubsectionHeader subsection={subsection} />
      {!empty && (
        <div className={`${GRID_TEMPLATE} mt-1.5`}>
          {COLUMNS.map(({ key, label }) => (
            <SlideCell
              key={key}
              rows={subsection.columns[key]}
              authorsById={authorsById}
              showStages={subsection.showStages}
              label={label}
              onRowActivate={onRowActivate}
            />
          ))}
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
  readonly onRowActivate?: SlideRowActivateHandler;
}) {
  if (card.noData) {
    return (
      <div
        data-testid="slide-product-empty"
        className="flex items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-muted-foreground)]"
      >
        <span className="truncate font-medium">{card.name}</span>
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
      className={`space-y-2.5 rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-card)] px-4 py-3 ${stripe}`}
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
