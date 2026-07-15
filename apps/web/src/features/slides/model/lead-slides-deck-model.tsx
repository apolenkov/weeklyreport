import type { ReportSectionReadModel } from "@customreport/shared";

import type { CrossAuthorContentRow } from "../../report-sections";
import type { SectionSlideModel } from "./section-slide-contracts";
import {
  applyForeignProductHealth,
  crossAuthorContentToSlideForeign,
  mergeForeignSlideContent,
} from "./section-slide-foreign";
import { buildSectionSlideModel } from "./section-slide-model";

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
  // The grid gets the foreign rows WITH author identity and the health fold
  // pre-applied (both inside buildSectionSlideModel), so its cards, legend and
  // header stats agree with the deck chrome.
  const base = buildSectionSlideModel(section, {
    foreign: foreignContentRows,
    foreignHealth,
  });
  if (foreignContentRows.length === 0) return base;
  // Legacy string-list merge keeps the deck-chrome aggregates (carousel counts,
  // tone) consistent with the merged content.
  return mergeForeignSlideContent(
    base,
    crossAuthorContentToSlideForeign(foreignContentRows),
  );
}
