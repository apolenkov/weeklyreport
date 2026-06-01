"use client";

import { AlertTriangle, ArrowRight, FileText, Target } from "lucide-react";

import type { ReactNode } from "react";

import type {
  UnifiedSectionRow,
  UnifiedSlideModel,
} from "./section-slide-utils";

interface Props {
  readonly model: UnifiedSlideModel;
}

function inlineProductMarker(productName: string): ReactNode {
  return (
    <span
      className="inline-flex w-[130px] shrink-0 items-start gap-1 overflow-hidden text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]"
      title={productName}
    >
      <span
        aria-hidden="true"
        className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-muted-foreground)]"
      />
      <span className="line-clamp-2 min-w-0 text-[11px] leading-tight">
        {productName}
      </span>
    </span>
  );
}

function priorityChip(rank: number): ReactNode {
  return (
    <span
      role="img"
      aria-label={`Priority ${rank}`}
      className="inline-flex shrink-0 items-center justify-center rounded-sm bg-[var(--color-starbucks-gold)] px-1 text-[10px] font-bold leading-4 text-white"
      title={`Priority rank ${rank}`}
    >
      P{rank}
    </span>
  );
}

const MAX_ITEMS_PER_SECTION = 4;

function SectionBlock({
  icon,
  label,
  items,
  toneClass = "text-[var(--color-muted-foreground)]",
  borderClass = "border-[rgba(0,117,74,0.22)]",
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly items: readonly UnifiedSectionRow[];
  readonly toneClass?: string;
  readonly borderClass?: string;
}) {
  return (
    <section>
      <div
        className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] ${toneClass}`}
      >
        {icon}
        {label}
      </div>
      {items.length > 0 ? (
        <>
          <ul className="mt-2 space-y-1.5">
            {items.slice(0, MAX_ITEMS_PER_SECTION).map((row, idx) => (
              <li
                key={`${row.text}-${String(idx)}`}
                className="flex min-w-0 items-baseline gap-2"
              >
                {/* Fixed-width slot so all item texts start at the same X. */}
                <span className="inline-flex w-[28px] shrink-0 justify-center">
                  {row.priorityRank != null
                    ? priorityChip(row.priorityRank)
                    : null}
                </span>
                {inlineProductMarker(row.productName)}
                <span
                  className={`min-w-0 line-clamp-3 border-l-2 ${borderClass} pl-3 text-[13px] leading-snug text-[var(--color-foreground)]`}
                >
                  {row.text}
                </span>
              </li>
            ))}
          </ul>
          {items.length > MAX_ITEMS_PER_SECTION ? (
            <p className="mt-1 text-[12px] italic text-[var(--color-muted-foreground)]">
              +{items.length - MAX_ITEMS_PER_SECTION} more
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function LeadUnifiedSlide({ model }: Props) {
  return (
    <div
      className="grid auto-rows-fr grid-cols-2 gap-3 [:fullscreen_&]:min-h-[60dvh] [:fullscreen_&]:content-between"
      data-testid="lead-unified-slide"
    >
      <SectionBlock
        icon={<Target className="h-4 w-4" aria-hidden="true" />}
        label="Current work"
        items={model.current}
      />
      <SectionBlock
        icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
        label="Next focus"
        items={model.next}
      />
      <SectionBlock
        icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
        label="Risks"
        items={model.risks}
        toneClass="text-[var(--color-destructive)]"
        borderClass="border-[rgba(200,32,20,0.28)]"
      />
      <SectionBlock
        icon={<FileText className="h-4 w-4" aria-hidden="true" />}
        label="Decisions"
        items={model.decisions}
        toneClass="text-[var(--color-starbucks-accent)]"
        borderClass="border-[rgba(0,117,74,0.28)]"
      />
    </div>
  );
}
