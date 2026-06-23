"use client";

import type { ReactNode } from "react";

import type { SectionSlideModel } from "./section-slide-utils";
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
}

export function ReportSlides({
  slides,
  selectedIndex,
  onSelect,
  variant,
  toolbar,
  heroControls,
}: ReportSlidesProps) {
  return (
    <StatusSlideDeck
      slides={slides}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      toolbar={toolbar}
      heroControls={heroControls}
      mode={variant}
    />
  );
}
