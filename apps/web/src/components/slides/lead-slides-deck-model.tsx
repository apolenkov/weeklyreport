import type { ReportSectionReadModel } from "@customreport/shared";

import type { CrossAuthorContentRow } from "../../lib/mappers/lead-cross-author";
import {
  applyForeignProductHealth,
  buildSectionSlideModel,
  crossAuthorContentToSlideForeign,
  mergeForeignSlideContent,
  type SectionSlideModel,
} from "./section-slide-utils";

export function SlideEmptyState({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] px-6 py-16 text-center">
      <p className="text-base font-semibold text-[var(--color-foreground)]">
        {title}
      </p>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        {message}
      </p>
    </div>
  );
}

/**
 * Assemble the lead deck's slide model: own records, then the risk-derived
 * foreign HEALTH fold (own deck only), then the Everyone CONTENT merge. Each
 * step returns NEW objects — the input `section` (the cached read-model the
 * draft serializes) is never mutated, so Everyone stays view-only.
 */
export function buildLeadDeckModel(
  section: ReportSectionReadModel,
  foreignHealth: Parameters<typeof applyForeignProductHealth>[1],
  foreignContentRows: readonly CrossAuthorContentRow[],
): SectionSlideModel {
  const base = buildSectionSlideModel(section);
  const withHealth =
    foreignHealth.length === 0
      ? base
      : {
          ...base,
          productSlides: applyForeignProductHealth(
            base.productSlides,
            foreignHealth,
          ),
        };
  if (foreignContentRows.length === 0) return withHealth;
  return mergeForeignSlideContent(
    withHealth,
    crossAuthorContentToSlideForeign(foreignContentRows),
  );
}
