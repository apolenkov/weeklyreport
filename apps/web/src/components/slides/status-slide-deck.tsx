"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileText,
  Star,
  Target,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { useFullscreen } from "../../hooks/use-fullscreen";
import { DeckFullscreenOverlay } from "./deck-fullscreen-overlay";
import { HeadSlideCarousel } from "./head-slide-carousel";
import { LeadSlideHero, metricSegment } from "./lead-slide-hero";
import { LeadUnifiedSlide } from "./lead-unified-slide";
import type {
  SectionSlideModel,
  SlideTone,
  UnifiedSectionRow,
} from "./section-slide-utils";
import {
  buildUnifiedSlideModel,
  scopeSlideToProduct,
} from "./section-slide-utils";
import { SlideActivityPills } from "./slide-activity-pills";
import {
  mapTrafficLightToStatus,
  type ProductChipEntry,
  SlideProductChips,
} from "./slide-product-chips";

interface StatusSlideDeckProps {
  readonly slides: readonly SectionSlideModel[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly mode: "lead" | "head";
  readonly toolbar?: ReactNode;
  readonly heroControls?: ReactNode;
}

const toneClass: Record<SlideTone, string> = {
  ready:
    "border-[color-mix(in_srgb,var(--color-starbucks-accent)_28%,transparent)] bg-[var(--color-success)] text-[var(--color-primary)]",
  warning:
    "border-[color-mix(in_srgb,var(--color-status-dot-at-risk)_38%,transparent)] bg-[var(--color-status-at-risk-bg)] text-[var(--color-status-at-risk-fg)]",
  blocked:
    "border-[color-mix(in_srgb,var(--color-destructive)_24%,transparent)] bg-[var(--color-status-blocked-bg)] text-[var(--color-destructive)]",
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

/* redesign-head-slide-density (decisions recorded 2026-06-10): the head
   section content adopts the lead density idiom — framed, floored, neutral
   cards with a token stripe. The card shell below is deliberately HEAD-LOCAL
   (decision 1.1 #6 / D3): extraction of a shared QuadrantCard with
   lead-unified-slide.tsx is deferred until the geometry survives the
   screenshot-acceptance round. */

function headPriorityChip(rank: number): ReactNode {
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

/* Decision 1.1 #3: head rows keep a NEUTRAL product badge — identity only,
   never a status hue (mirrors the lead feedback-round-3 call). */
function headProductBadge(productName: string): ReactNode {
  return (
    <span
      className="inline-flex w-[110px] shrink-0 items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-muted)] px-1.5 text-[9px] font-semibold uppercase leading-4 tracking-wide text-[var(--color-muted-foreground)]"
      title={productName}
      data-testid="head-row-product-badge"
    >
      <span className="truncate">{productName}</span>
    </span>
  );
}

function HeadSectionCard({
  icon: Icon,
  label,
  items,
  emptyText,
  stripeClass,
  showBadges,
  dashedFrame = false,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly items: readonly UnifiedSectionRow[];
  readonly emptyText: string;
  readonly stripeClass: string;
  readonly showBadges: boolean;
  /** Lead idiom: plans (Next focus) read as a dashed "not yet" frame. */
  readonly dashedFrame?: boolean;
}) {
  return (
    <section
      data-testid="head-section-card"
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] border-l-4 ${
        dashedFrame ? "border-dashed [border-left-style:solid]" : ""
      } ${stripeClass} bg-white/80 p-3`}
    >
      {/* Neutral header — the stripe carries the accent (status-color-semantics). */}
      <div className="flex shrink-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </div>
      {items.length > 0 ? (
        /* No count-based truncation — every row always renders. */
        <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {items.map((row, idx) => (
            <li
              key={`${row.text}-${String(idx)}`}
              className="flex min-w-0 items-baseline gap-2"
            >
              {/* Fixed-width slot so all item texts start at the same X. */}
              <span className="inline-flex w-[28px] shrink-0 justify-center">
                {row.priorityRank != null
                  ? headPriorityChip(row.priorityRank)
                  : null}
              </span>
              {showBadges ? headProductBadge(row.productName) : null}
              <span className="min-w-0 line-clamp-3 text-[13px] leading-snug text-[var(--color-foreground)]">
                {row.text}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
          {emptyText}
        </p>
      )}
      {/* Lead D9 watermark, carried per decision 1.1 #2. */}
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 text-[var(--color-foreground)] opacity-[0.05]"
      />
    </section>
  );
}

function selectedSlide(
  slides: readonly SectionSlideModel[],
  index: number,
): SectionSlideModel | null {
  if (slides.length === 0) return null;
  return slides[Math.min(Math.max(index, 0), slides.length - 1)] ?? null;
}

function LeadSlideArticle({
  slide,
  heroControls,
}: {
  readonly slide: SectionSlideModel;
  readonly heroControls?: ReactNode;
}) {
  /* slides-product-autofit D1/D4: chip selection is this surface's local UI
     state; the caller keys this component by slide id + page, so navigating
     to another slide page remounts the article and clears the filter.
     Re-clicking the active chip toggles back to the all-products view. */
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  // Chips always list every real product (from the UNFILTERED slide), so the
  // active chip stays visible for unpicking; only the quadrant model below
  // is scoped (D2).
  const productChips: ProductChipEntry[] = slide.productSlides
    .filter((p) => p.id !== "cross-product")
    .map((p) => ({
      productId: p.id,
      productName: p.name,
      worstStatus: mapTrafficLightToStatus(p.status),
    }));

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- click anywhere exits fullscreen; the browser already exits fullscreen on Escape, so no keyboard equivalent is needed
    <article
      className="slide-frame rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-card)] p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
      // TODO(add-slide-fullscreen-exit-affordance): this click-anywhere-to-exit
      // handler is now redundant with the floating exit pill + Esc hint, and it
      // can bubble from interactive children (product chips) and exit
      // unexpectedly. Candidate for scoping/removal; left intact in this change
      // per design "Reviewed but NOT required here".
      onClick={() => {
        if (typeof document !== "undefined" && document.fullscreenElement) {
          void document.exitFullscreen();
        }
      }}
    >
      {/* slides-product-autofit D3: column layout fills the fixed-aspect
          frame — hero and chips keep natural height, the quadrant grid takes
          the leftover (flex-1 inside LeadUnifiedSlide). */}
      <div className="animate-fade-in flex h-full flex-col gap-3">
        <LeadSlideHero slide={slide} heroControls={heroControls} />
        {productChips.length > 1 ? (
          <SlideProductChips
            products={productChips}
            activeProductId={activeProductId ?? undefined}
            onSelect={(productId) => {
              setActiveProductId((prev) =>
                prev === productId ? null : productId,
              );
            }}
          />
        ) : null}
        {/* Minimal Project Activities status-pill lane — display-only,
            self-suppressing, no quadrant layout rework. */}
        <SlideActivityPills activities={slide.activities} />

        <LeadUnifiedSlide
          model={buildUnifiedSlideModel(
            scopeSlideToProduct(slide, activeProductId),
          )}
        />
      </div>
    </article>
  );
}

function HeadSlideArticle({ slide }: { readonly slide: SectionSlideModel }) {
  const articleRef = useRef<HTMLElement>(null);
  // add-slide-fullscreen-exit-affordance: the head deck owns its single
  // fullscreen hook; on exit focus returns to the article itself (made
  // focusable via tabIndex={-1}) — the head deck has no persistent toggle.
  const fullscreen = useFullscreen(articleRef, articleRef);
  const unified = buildUnifiedSlideModel(slide);
  /* Same gate as the lead idiom / the chip strip: badges only disambiguate
     when the slide aggregates more than one real product. */
  const showBadges =
    slide.productSlides.filter((p) => p.id !== "cross-product").length > 1;
  return (
    <article
      ref={articleRef}
      // add-slide-fullscreen-exit-affordance (Codex X2): a plain <article> is
      // not focusable, so tabIndex={-1} makes it a programmatic focus target
      // for focus-return on fullscreen exit without adding it to the tab order.
      tabIndex={-1}
      className="slide-frame rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,249,246,0.92)_100%)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_12px_24px_-18px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.05)]"
    >
      <DeckFullscreenOverlay
        isFullscreen={fullscreen.isFullscreen}
        onToggle={fullscreen.toggle}
      />
      <div className="flex h-full flex-col gap-5">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[rgba(0,0,0,0.08)] pb-4">
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
            {/* Minimal Project Activities status-pill lane (display-only). */}
            <div className="mt-2">
              <SlideActivityPills activities={slide.activities} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Decision 1.1 #5: portfolio metrics align to the lead hero's
                  segmented capsule treatment. */}
            <div className="inline-flex h-11 items-center divide-x divide-[rgba(0,0,0,0.08)] rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.12)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              {metricSegment(
                slide.currentCount,
                "Current",
                <Target className="h-4 w-4" />,
              )}
              {metricSegment(
                slide.nextCount,
                "Next",
                <ArrowRight className="h-4 w-4" />,
              )}
              {metricSegment(
                slide.riskCount,
                "Risks",
                <AlertTriangle className="h-4 w-4" />,
              )}
              {metricSegment(
                slide.priorityCount,
                "Priority",
                <Star className="h-4 w-4" />,
              )}
            </div>
          </div>
        </div>

        {/* Decision 1.1 #1: fixed 2×2 topology like the lead slide — framed,
              floored cards; no rhythm collapse at sparse density. */}
        <div
          className="grid min-h-0 flex-1 auto-rows-[minmax(var(--slide-quadrant-min),1fr)] grid-cols-2 gap-3"
          data-testid="head-section-grid"
        >
          <HeadSectionCard
            icon={Target}
            label="Current work"
            items={unified.current}
            emptyText="No current work on the slide"
            stripeClass="border-l-[var(--color-chip-on-track-border)]"
            showBadges={showBadges}
          />
          <HeadSectionCard
            icon={ArrowRight}
            label="Next focus"
            items={unified.next}
            emptyText="No next focus on the slide"
            stripeClass="border-l-[var(--color-primary)]"
            showBadges={showBadges}
            dashedFrame
          />
          <HeadSectionCard
            icon={AlertTriangle}
            label="Risks"
            items={unified.risks}
            emptyText="No risks raised"
            stripeClass="border-l-[var(--color-chip-at-risk-border)]"
            showBadges={showBadges}
          />
          <HeadSectionCard
            icon={FileText}
            label="Decisions"
            items={unified.decisions}
            emptyText="No decisions recorded"
            stripeClass="border-l-[var(--color-decisions-accent)]"
            showBadges={showBadges}
          />
        </div>
      </div>
    </article>
  );
}

export function StatusSlideDeck({
  slides,
  selectedIndex,
  onSelect,
  mode,
  toolbar,
  heroControls,
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
      className="space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      data-testid={`${mode}-slides-deck`}
      aria-label="Status slide deck (use arrow keys to navigate slides)"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable keyboard-navigation region for arrow-key slide control
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {toolbar ? <div>{toolbar}</div> : null}

      {!slide ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] px-6 py-16 text-center">
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
              role="group"
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

          <div className="space-y-3">
            {/* head-slides-carousel-fullscreen: the head deck navigates via a
                top carousel of slide cards (replacing the former left sidebar),
                with the active slide rendered full-width below. Selecting a card
                or pressing the arrow keys changes the active slide. */}
            {!isLead && slides.length > 1 ? (
              <HeadSlideCarousel
                slides={slides}
                selectedIndex={selectedIndex}
                onSelect={onSelect}
              />
            ) : null}

            {isLead ? (
              /* slides-product-autofit D1: keying by slide id + page remounts
                 the article on navigation — the product filter never leaks to
                 another page, and the fade-in replays as before. */
              <LeadSlideArticle
                key={`${slide.id}:${String(slide.pageIndex ?? 0)}`}
                slide={slide}
                heroControls={heroControls}
              />
            ) : (
              <HeadSlideArticle slide={slide} />
            )}
          </div>
        </>
      )}
    </section>
  );
}
