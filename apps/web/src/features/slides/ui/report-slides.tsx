"use client";

import type { ReactNode } from "react";

import type { SectionSlideModel } from "../model/section-slide-utils";
import type { SlideRowActivateHandler } from "./slide-article-rows";
import { StatusSlideDeck } from "./status-slide-deck";

interface ReportSlidesProps {
  readonly slides: readonly SectionSlideModel[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  /** "lead" = single-section deck; "head" = multi-section carousel. */
  readonly variant: "lead" | "head";
  readonly toolbar?: ReactNode;
  /** Rendered inside the lead slide hero, inline with the tone badge. */
  readonly heroControls?: ReactNode;
  readonly onRowActivate?: SlideRowActivateHandler;
}

export function ReportSlides({
  slides,
  selectedIndex,
  onSelect,
  variant,
  toolbar,
  heroControls,
  onRowActivate,
}: ReportSlidesProps) {
  return (
    <StatusSlideDeck
      slides={slides}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      toolbar={toolbar}
      heroControls={heroControls}
      onRowActivate={onRowActivate}
      mode={variant}
    />
  );
}
