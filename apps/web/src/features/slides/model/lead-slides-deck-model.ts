import type { ReportSectionReadModel } from "@customreport/shared";

import type { CrossAuthorContentRow } from "../../report-sections";
import type { SectionSlideModel } from "./section-slide-contracts";
import {
  applyForeignProductHealth,
  crossAuthorContentToSlideForeign,
  mergeForeignSlideContent,
} from "./section-slide-foreign";
import { buildSectionSlideModel } from "./section-slide-model";

// Each step returns new objects — the cached section is never mutated so
// Everyone content stays view-only.
export function buildLeadDeckModel(
  section: ReportSectionReadModel,
  foreignHealth: Parameters<typeof applyForeignProductHealth>[1],
  foreignContentRows: readonly CrossAuthorContentRow[],
  showOwnerBadges = true,
): SectionSlideModel {
  // The grid gets the foreign rows WITH author identity and the health fold
  // pre-applied (both inside buildSectionSlideModel), so its cards, legend and
  // header stats agree with the deck chrome.
  const base = buildSectionSlideModel(section, {
    foreign: foreignContentRows,
    foreignHealth,
    showOwnerBadges,
  });
  if (foreignContentRows.length === 0) return base;
  // Legacy string-list merge keeps the deck-chrome aggregates (carousel counts,
  // tone) consistent with the merged content.
  return mergeForeignSlideContent(
    base,
    crossAuthorContentToSlideForeign(foreignContentRows),
  );
}
