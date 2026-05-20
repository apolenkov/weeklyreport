"use client";

import {
  AlertTriangle,
  ArrowRight,
  FileText,
  ListChecks,
  Target,
} from "lucide-react";
import type { ReactNode } from "react";

import type {
  UnifiedSectionRow,
  UnifiedSlideModel,
} from "./section-slide-utils";

type Props = { readonly model: UnifiedSlideModel };

function productChip(productName: string): ReactNode {
  return (
    <span className="ml-2 inline-flex shrink-0 items-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted-foreground)]">
      {productName}
    </span>
  );
}

function emptyForBand(names: readonly string[]): ReactNode {
  if (names.length === 0) return null;
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  return (
    <p className="mt-1 text-[12px] italic text-[var(--color-muted-foreground)]">
      — empty for: {shown.join(", ")}
      {rest > 0 ? `, +${rest} more` : ""}
    </p>
  );
}

function SectionBlock({
  icon,
  label,
  items,
  emptyNames,
  toneClass = "text-[var(--color-muted-foreground)]",
  borderClass = "border-[rgba(0,117,74,0.22)]",
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly items: readonly UnifiedSectionRow[];
  readonly emptyNames: readonly string[];
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
      {items.length === 0 ? (
        <p className="mt-1 text-[12px] italic text-[var(--color-muted-foreground)]">
          — none
        </p>
      ) : (
        <>
          <ul className="mt-2 space-y-1.5">
            {items.map((row, idx) => (
              <li
                key={row.text + "-" + String(idx)}
                className="flex min-w-0 items-baseline justify-between gap-2"
              >
                <span
                  className={`min-w-0 line-clamp-3 border-l-2 ${borderClass} pl-3 text-[13px] leading-snug text-[var(--color-foreground)]`}
                >
                  {row.text}
                </span>
                {productChip(row.productName)}
              </li>
            ))}
          </ul>
          {emptyForBand(emptyNames)}
        </>
      )}
    </section>
  );
}

export function LeadUnifiedSlide({ model }: Props) {
  return (
    <div className="space-y-5" data-testid="lead-unified-slide">
      <SectionBlock
        icon={<Target className="h-4 w-4" aria-hidden="true" />}
        label="Current work"
        items={model.current}
        emptyNames={model.emptyProducts.current}
      />
      <SectionBlock
        icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
        label="Next focus"
        items={model.next}
        emptyNames={model.emptyProducts.next}
      />
      <SectionBlock
        icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
        label="Risks"
        items={model.risks}
        emptyNames={model.emptyProducts.risks}
        toneClass="text-[var(--color-destructive)]"
        borderClass="border-[rgba(200,32,20,0.28)]"
      />
      <SectionBlock
        icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
        label="Priorities"
        items={model.priorities}
        emptyNames={model.emptyProducts.priorities}
        toneClass="text-[var(--color-starbucks-gold)]"
        borderClass="border-[rgba(212,160,23,0.34)]"
      />
      <SectionBlock
        icon={<FileText className="h-4 w-4" aria-hidden="true" />}
        label="Decisions"
        items={model.decisions}
        emptyNames={model.emptyProducts.decisions}
        toneClass="text-[var(--color-starbucks-accent)]"
        borderClass="border-[rgba(0,117,74,0.28)]"
      />
    </div>
  );
}
