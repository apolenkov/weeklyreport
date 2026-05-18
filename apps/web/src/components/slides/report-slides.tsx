"use client";

import type { ReactNode } from "react";

import type { SectionSlideModel } from "./section-slide-utils";
import { StatusSlideDeck } from "./status-slide-deck";

type ReportSlidesProps = {
  readonly slides: readonly SectionSlideModel[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  /** "lead" = single-section deck, no chrome; "head" = multi-section, full chrome */
  readonly variant: "lead" | "head";
  readonly title: string;
  readonly subtitle: string;
  readonly groupLabel?: string | null;
  readonly reportLabel?: string | null;
  readonly sourceHref?: string;
  readonly sourceLabel?: string;
  readonly hideSourceLink?: boolean;
  readonly toolbar?: ReactNode;
};

export function ReportSlides({
  slides,
  selectedIndex,
  onSelect,
  variant,
  title,
  subtitle,
  groupLabel,
  reportLabel,
  sourceHref,
  sourceLabel,
  hideSourceLink,
  toolbar,
}: ReportSlidesProps) {
  return (
    <StatusSlideDeck
      slides={slides}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      title={title}
      subtitle={subtitle}
      groupLabel={groupLabel}
      reportLabel={reportLabel}
      sourceHref={sourceHref}
      sourceLabel={sourceLabel}
      hideSourceLink={hideSourceLink}
      toolbar={toolbar}
      mode={variant}
      showChrome={variant === "lead" ? false : undefined}
    />
  );
}
