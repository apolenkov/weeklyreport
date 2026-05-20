"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  FileText,
  Gauge,
  Layers,
  ListChecks,
  Target,
} from "lucide-react";

import type {
  SectionSlideModel,
  SlideProduct,
  SlideStageStatus,
  SlideTone,
} from "./section-slide-utils";
import { LeadSlideHero } from "./lead-slide-hero";
import { type ProductChipEntry, SlideProductChips } from "./slide-product-chips";

type StatusSlideDeckProps = {
  readonly slides: readonly SectionSlideModel[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly title: string;
  readonly subtitle: string;
  readonly groupLabel?: string | null;
  readonly reportLabel?: string | null;
  readonly sourceHref?: string;
  readonly sourceLabel?: string;
  readonly hideSourceLink?: boolean;
  readonly mode: "lead" | "head";
  readonly toolbar?: ReactNode;
  readonly showChrome?: boolean;
};

const toneClass: Record<SlideTone, string> = {
  ready:
    "border-[rgba(0,117,74,0.28)] bg-[rgba(229,245,237,0.74)] text-[var(--color-primary)]",
  warning: "border-[rgba(212,160,23,0.38)] bg-[#fff7df] text-[#725313]",
  blocked:
    "border-[rgba(200,32,20,0.24)] bg-[#fff1f0] text-[var(--color-destructive)]",
  empty:
    "border-[rgba(0,0,0,0.14)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

function toneLabel(tone: SlideTone): string {
  switch (tone) {
    case "ready":
      return "Ready";
    case "warning":
      return "Review";
    case "blocked":
      return "Blocked";
    case "empty":
      return "Empty";
  }
}

function readinessDot(status: "ready" | "needs-work" | "optional") {
  if (status === "ready") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] text-white">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  if (status === "needs-work") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[#fff1f0] text-[var(--color-destructive)]">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
      <Circle className="h-2.5 w-2.5" aria-hidden="true" />
    </span>
  );
}

function metricLabel(value: number, label: string) {
  return (
    <div className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-white/80 px-3 py-2">
      <div className="text-lg font-semibold text-[var(--color-primary)]">
        {value}
      </div>
      <div className="text-xs text-[var(--color-muted-foreground)]">
        {label}
      </div>
    </div>
  );
}

function textList(items: readonly string[], empty: string, limit = 3) {
  if (items.length === 0) {
    return (
      <p className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
        {empty}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.slice(0, limit).map((item, index) => (
        <li
          key={item + "-" + index}
          className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-white/80 px-3 py-2 text-sm leading-5 text-[var(--color-foreground)]"
        >
          {item}
        </li>
      ))}
      {items.length > limit ? (
        <li className="px-1 text-xs font-medium text-[var(--color-muted-foreground)]">
          +{items.length - limit} more
        </li>
      ) : null}
    </ul>
  );
}

function statusLabel(status: SlideStageStatus): string {
  switch (status) {
    case "green":
      return "Green";
    case "yellow":
      return "Yellow";
    case "red":
      return "Red";
    default:
      return "No status";
  }
}

function statusClass(status: SlideStageStatus): string {
  switch (status) {
    case "green":
      return "border-[rgba(0,117,74,0.24)] bg-[rgba(229,245,237,0.72)] text-[var(--color-primary)]";
    case "yellow":
      // amber-100 bg + amber-900 text → WCAG AA pass for small text
      return "border-[rgba(212,160,23,0.34)] bg-[#fef3c7] text-[#78350f]";
    case "red":
      // red-100 bg + red-950 text → WCAG AA pass for small text
      return "border-[rgba(200,32,20,0.24)] bg-[#fee2e2] text-[#7f1d1d]";
    default:
      return "border-[rgba(0,0,0,0.12)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]";
  }
}

function productStoryList({
  id,
  label,
  items,
  empty,
  icon,
  tone = "neutral",
  compact = false,
}: {
  readonly id: string;
  readonly label: string;
  readonly items: readonly string[];
  readonly empty: string;
  readonly icon: ReactNode;
  readonly tone?: "neutral" | "risk" | "priority" | "decision";
  readonly compact?: boolean;
}) {
  const toneClassName = {
    neutral: "text-[var(--color-muted-foreground)]",
    risk: "text-[var(--color-destructive)]",
    priority: "text-[var(--color-starbucks-gold)]",
    decision: "text-[var(--color-starbucks-accent)]",
  }[tone];
  const lineClassName = {
    neutral: "border-[rgba(0,117,74,0.22)]",
    risk: "border-[rgba(200,32,20,0.28)]",
    priority: "border-[rgba(212,160,23,0.34)]",
    decision: "border-[rgba(0,117,74,0.28)]",
  }[tone];
  const bodyClass = compact
    ? "min-w-0 break-words border-l-2 pl-3 text-[12px] leading-[1.4] text-[var(--color-foreground)]"
    : "min-w-0 break-words border-l-2 pl-3 text-[13px] leading-snug text-[var(--color-foreground)]";
  const emptyClass = "mt-2 text-[12px] leading-5 text-[var(--color-muted-foreground)]";

  return (
    <section
      className="min-w-0 min-h-[var(--slide-row-min)]"
      data-testid={"lead-slide-story-" + id}
    >
      <div
        className={[
          "flex items-center gap-2 text-[11px] font-bold uppercase",
          toneClassName,
        ].join(" ")}
      >
        {icon}
        {label}
      </div>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((item, index) => (
            <li
              key={item + "-" + index}
              className={[bodyClass, lineClassName].join(" ")}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className={emptyClass}>{empty}</p>
      )}
    </section>
  );
}

function ProductSdlcGroups({
  products,
}: {
  readonly products: readonly SlideProduct[];
}) {
  if (products.length === 0) {
    return (
      <section className="min-h-0 border-t border-[rgba(0,0,0,0.08)] pt-4">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No product scope assigned.
        </p>
      </section>
    );
  }

  const realProducts = products.filter(
    (product) => product.id !== "cross-product",
  );
  const sharedProducts = products.filter(
    (product) => product.id === "cross-product",
  );
  const orderedProducts = [...realProducts, ...sharedProducts];
  const hasMultipleRealProducts = realProducts.length > 1;

  // N≤4 → 2-col; N≥5 → 3-col with compact typography
  const compact = realProducts.length >= 5;
  const colClass = compact
    ? "xl:grid-cols-3"
    : hasMultipleRealProducts
      ? "xl:grid-cols-2"
      : "";
  const productGridClass = ["grid min-h-0 gap-6", colClass]
    .filter(Boolean)
    .join(" ");

  const titleClass = compact
    ? "mt-2 text-[22px] font-bold leading-tight text-[var(--color-primary)]"
    : "mt-2 text-[28px] font-bold leading-tight text-[var(--color-primary)]";
  const stagesClass = "mt-3 text-[12px] font-medium text-[var(--color-muted-foreground)]";

  return (
    <div className={productGridClass} data-testid="lead-slide-products">
      {orderedProducts.map((product) => {
        const isSharedContext = product.id === "cross-product";
        const productNumber = realProducts.findIndex(
          (item) => item.id === product.id,
        );
        // W9.B: top accent bar for quick status glance (border-t instead of border-l)
        const productAccentClass = isSharedContext
          ? "border-t-4 border-t-[rgba(0,0,0,0.16)]"
          : product.status === "green"
            ? "border-t-4 border-t-[rgba(0,117,74,0.5)]"
            : product.status === "yellow"
              ? "border-t-4 border-t-[rgba(212,160,23,0.62)]"
              : product.status === "red"
                ? "border-t-4 border-t-[rgba(200,32,20,0.55)]"
                : "border-t-4 border-t-[rgba(0,0,0,0.2)]";
        return (
          <section
            key={product.id}
            id={"product-card-" + product.id}
            className={[
              "min-w-0 border-t border-[rgba(0,0,0,0.08)] pt-5 first:border-t-0 first:pt-0",
              productAccentClass,
              isSharedContext && hasMultipleRealProducts ? "xl:col-span-2" : "",
            ].join(" ")}
            data-testid={"lead-slide-product-" + product.id}
          >
            {/* Header: label + status badge + title + stages */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase text-[var(--color-muted-foreground)]">
                  {isSharedContext
                    ? "Shared context"
                    : realProducts.length > 1
                      ? "Product " + (productNumber + 1)
                      : "Product"}
                </span>
                {!isSharedContext ? (
                  <span
                    className={[
                      "inline-flex min-h-7 items-center rounded-[var(--radius-pill)] border px-2 text-[11px] font-semibold",
                      statusClass(product.status),
                    ].join(" ")}
                  >
                    {statusLabel(product.status)}
                  </span>
                ) : null}
              </div>
              <h3 className={titleClass}>{product.name}</h3>
              {!isSharedContext && product.stages.length > 0 ? (
                <p className={stagesClass}>
                  {product.stages.map((s) => s.name).join(" · ")}
                </p>
              ) : !isSharedContext ? (
                <p className={stagesClass}>No owned SDLC stages</p>
              ) : null}
            </div>

            {/* 5-row band grid — all products use identical min-h rows so bands
                align horizontally across columns at every breakpoint.
                grid-rows sets named tracks for semantic structure; min-h on each
                section enforces uniform row heights across product columns. */}
            <div className="mt-5 grid gap-y-5" style={{gridTemplateRows: "[current] minmax(var(--slide-row-min),auto) [next] minmax(var(--slide-row-min),auto) [risks] minmax(var(--slide-row-min),auto) [priorities] minmax(var(--slide-row-min),auto) [decisions] minmax(var(--slide-row-min),auto)"}}>
              {productStoryList({
                id: product.id + "-current",
                label: "Current work",
                items: product.currentItems,
                empty: "No current work",
                icon: <Target className="h-4 w-4" aria-hidden="true" />,
                compact,
              })}
              {productStoryList({
                id: product.id + "-next",
                label: "Next focus",
                items: product.nextItems,
                empty: "No next focus",
                icon: <ArrowRight className="h-4 w-4" aria-hidden="true" />,
                compact,
              })}
              {productStoryList({
                id: product.id + "-risks",
                label: "Risks",
                items: product.risks,
                empty: "No active risks",
                icon: (
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                ),
                tone: "risk",
                compact,
              })}
              {/* TODO(PRIORITY-REDESIGN-01): see priorities-section.tsx for refactor sketch */}
              {productStoryList({
                id: product.id + "-priorities",
                label: "Priorities",
                items: product.priorities,
                empty: "No priorities set",
                icon: <ListChecks className="h-4 w-4" aria-hidden="true" />,
                tone: "priority",
                compact,
              })}
              {productStoryList({
                id: product.id + "-decisions",
                label: "Decisions",
                items: product.decisions,
                empty: "No decisions",
                icon: <FileText className="h-4 w-4" aria-hidden="true" />,
                tone: "decision",
                compact,
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function selectedSlide(
  slides: readonly SectionSlideModel[],
  index: number,
): SectionSlideModel | null {
  if (slides.length === 0) return null;
  return slides[Math.min(Math.max(index, 0), slides.length - 1)] ?? null;
}

function LeadSlideArticle({ slide }: { readonly slide: SectionSlideModel }) {
  const productChips: ProductChipEntry[] = slide.productSlides
    .filter((p) => p.id !== "cross-product")
    .map((p) => ({
      productId: p.id,
      productName: p.name,
      worstStatus:
        p.status === "red"
          ? "blocked"
          : p.status === "yellow"
            ? "at-risk"
            : p.status === "green"
              ? "on-track"
              : "empty",
    }));

  return (
    <article className="slide-frame rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-card)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div
        key={String(slide.pageIndex ?? 0)}
        className="animate-fade-in space-y-5"
      >
        <LeadSlideHero slide={slide} />
        {productChips.length > 1 ? (
          <SlideProductChips products={productChips} />
        ) : null}
        <ProductSdlcGroups products={slide.productSlides} />
      </div>
    </article>
  );
}

function HeadSlideArticle({ slide }: { readonly slide: SectionSlideModel }) {
  return (
    <article className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,249,246,0.92)_100%)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_12px_24px_-18px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="grid gap-5 xl:grid-cols-[1fr_310px]">
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(0,0,0,0.08)] pb-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-semibold",
                    toneClass[slide.tone],
                  ].join(" ")}
                >
                  {toneLabel(slide.tone)}
                </span>
                <span className="text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
                  {slide.ownerRole}
                </span>
              </div>
              <h2 className="mt-3 text-3xl font-semibold text-[var(--color-primary)]">
                {slide.ownerName}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
                {slide.products.length > 0
                  ? slide.products.join(" / ")
                  : "No products assigned"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {metricLabel(slide.currentCount, "Current")}
              {metricLabel(slide.nextCount, "Next")}
              {metricLabel(slide.riskCount, "Risks")}
              {metricLabel(slide.priorityCount, "Priority")}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--color-muted-foreground)]">
                <Target className="h-4 w-4" aria-hidden="true" />
                Current work
              </div>
              {textList(slide.currentItems, "No current work on the slide")}
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--color-muted-foreground)]">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                Next focus
              </div>
              {textList(slide.nextItems, "No next focus on the slide")}
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--color-destructive)]">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Risks
              </div>
              {textList(slide.risks, "No risks raised")}
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--color-starbucks-gold)]">
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                Top priorities
              </div>
              {textList(slide.priorities, "No priorities set")}
            </section>
          </div>

          {slide.decisions.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--color-starbucks-accent)]">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Decisions
              </div>
              {textList(slide.decisions, "No decisions", 2)}
            </section>
          ) : null}
        </div>

        <aside className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-white/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--color-muted-foreground)]">
                Slide completion
              </p>
              <p className="mt-1 text-3xl font-semibold text-[var(--color-primary)]">
                {slide.score}%
              </p>
            </div>
            <Gauge
              className="h-8 w-8 text-[var(--color-starbucks-accent)]"
              aria-hidden="true"
            />
          </div>

          <div className="mt-4 space-y-3">
            {slide.readiness.map((item) => (
              <div key={item.id} className="flex gap-3">
                {readinessDot(item.status)}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--color-foreground)]">
                    {item.label}
                  </div>
                  <div className="text-xs leading-5 text-[var(--color-muted-foreground)]">
                    {item.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </article>
  );
}

export function StatusSlideDeck({
  slides,
  selectedIndex,
  onSelect,
  title,
  subtitle,
  groupLabel,
  reportLabel,
  sourceHref,
  sourceLabel = "Open source report",
  hideSourceLink = false,
  mode,
  toolbar,
  showChrome = true,
}: StatusSlideDeckProps) {
  const slide = selectedSlide(slides, selectedIndex);
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex < slides.length - 1;
  const isLead = mode === "lead";
  const showLeadControls = isLead && slides.length > 1;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onSelect(Math.min(selectedIndex + 1, slides.length - 1));
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSelect(Math.max(selectedIndex - 1, 0));
    }
  }

  return (
    <section
      className="space-y-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      data-testid={mode + "-slides-deck"}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {showChrome ? (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold text-[var(--color-primary)]">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--color-muted-foreground)]">
              {subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {groupLabel ? (
              <span className="inline-flex min-h-[2rem] items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 text-sm font-medium text-[var(--color-foreground)]">
                <Layers className="h-4 w-4" aria-hidden="true" />
                {groupLabel}
              </span>
            ) : null}
            {reportLabel ? (
              <span className="inline-flex min-h-[2rem] items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 text-sm font-medium text-[var(--color-muted-foreground)]">
                <FileText className="h-4 w-4" aria-hidden="true" />
                {reportLabel}
              </span>
            ) : null}
            {!hideSourceLink && sourceHref ? (
              <Link
                href={sourceHref}
                className="btn-press inline-flex min-h-[2rem] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)]"
              >
                {sourceLabel}
              </Link>
            ) : null}
          </div>
        </header>
      ) : null}

      {toolbar ? <div>{toolbar}</div> : null}

      {!slide ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
          <p className="text-base font-semibold text-[var(--color-foreground)]">
            No slides available
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            There is no report section in the current scope.
          </p>
        </div>
      ) : (
        <>
          {showLeadControls ? (
            <div
              className="flex items-center justify-center gap-3"
              aria-label="Slide carousel controls"
            >
              <button
                type="button"
                onClick={() => onSelect(selectedIndex - 1)}
                disabled={!canGoPrev}
                aria-label="Previous slide"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span
                aria-live="polite"
                className="min-w-14 text-center text-sm font-semibold text-[var(--color-muted-foreground)]"
              >
                {selectedIndex + 1} / {slides.length}
              </span>
              <button
                type="button"
                onClick={() => onSelect(selectedIndex + 1)}
                disabled={!canGoNext}
                aria-label="Next slide"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <div
            className={
              isLead
                ? "space-y-3"
                : "grid gap-5 lg:grid-cols-[minmax(220px,300px)_1fr]"
            }
          >
            {!isLead ? (
              <aside className="space-y-2" aria-label="Slides">
                {slides.map((item, index) => {
                  const selected = index === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelect(index)}
                      className={[
                        "w-full rounded-[var(--radius)] border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-[var(--color-starbucks-accent)] bg-white shadow-[0_0_0_2px_rgba(0,117,74,0.13)]"
                          : "border-[rgba(0,0,0,0.08)] bg-white/70 hover:border-[var(--color-border)] hover:bg-white",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-[var(--color-foreground)]">
                          {item.ownerName}
                        </span>
                        <span
                          className={[
                            "rounded-[var(--radius-pill)] border px-2 py-0.5 text-[11px] font-semibold",
                            toneClass[item.tone],
                          ].join(" ")}
                        >
                          {toneLabel(item.tone)}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-[var(--color-muted-foreground)]">
                        {item.products.length > 0
                          ? item.products.join(" / ")
                          : "No product scope"}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                        <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{item.score}% ready</span>
                        <span aria-hidden="true">|</span>
                        <span>{item.status}</span>
                      </div>
                    </button>
                  );
                })}
              </aside>
            ) : null}

            {isLead ? (
              <LeadSlideArticle slide={slide} />
            ) : (
              <HeadSlideArticle slide={slide} />
            )}
          </div>

          {!isLead && slides.length > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onSelect(selectedIndex - 1)}
                disabled={!canGoPrev}
                className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-4 text-sm font-semibold text-[var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => onSelect(selectedIndex + 1)}
                disabled={!canGoNext}
                className="inline-flex min-h-[2.25rem] items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-4 text-sm font-semibold text-[var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
