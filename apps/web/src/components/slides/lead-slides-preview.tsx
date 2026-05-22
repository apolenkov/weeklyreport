"use client";

import { useMemo, useState } from "react";

import type { ReportSectionReadModel } from "@customreport/shared";

import { ReportSlides } from "./report-slides";
import {
  buildSectionSlideModel,
  paginateSectionSlides,
} from "./section-slide-utils";

type LeadSlidesPreviewProps = {
  /** Live draft section from the edit form. Slides rebuild on every change —
   *  this is the split-view's single source of truth (no extra fetch). */
  readonly section: ReportSectionReadModel | null;
};

/**
 * Lightweight, query-free slides preview for the lead split-view. Renders the
 * SAME ReportSlides deck as the standalone slides route, but built directly
 * from the in-memory draft section so the preview tracks edits instantly
 * (no 3s autosave lag, no byPeriod fetch). The standalone `?mode=slides`
 * route keeps using LeadSlidesClient unchanged.
 */
export function LeadSlidesPreview({ section }: LeadSlidesPreviewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const slides = useMemo(
    () =>
      section ? paginateSectionSlides(buildSectionSlideModel(section)) : [],
    [section],
  );

  if (slides.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
        <p className="text-base font-semibold text-[var(--color-foreground)]">
          Slide preview
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Fill in products, items, risks, or decisions to preview your slides
          here.
        </p>
      </div>
    );
  }

  // Clamp so a shrinking deck never points past the last slide.
  const safeIndex = Math.min(selectedIndex, slides.length - 1);

  return (
    <ReportSlides
      slides={slides}
      selectedIndex={safeIndex}
      onSelect={setSelectedIndex}
      variant="lead"
      title="Slide preview"
      subtitle="Live preview — updates as you edit."
      hideSourceLink
    />
  );
}
