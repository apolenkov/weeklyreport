import type { RefObject } from "react";

import {
  DeckFullscreenOverlay,
  DeckToolbarControls,
} from "./deck-fullscreen-overlay";
import { LeadProductGrid } from "./lead-product-grid";
import { LeadSlideHero } from "./lead-slide-hero";
import type { SectionSlideModel } from "./section-slide-utils";

interface LeadSlidesProductViewProps {
  readonly deckRef: RefObject<HTMLDivElement | null>;
  readonly sectionModel: SectionSlideModel | null;
  readonly scopeControls: React.ReactNode;
  readonly inReportMode: boolean;
  readonly isFullscreen: boolean;
  readonly onToggle: () => void;
  readonly toggleButtonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * The "Product" scope view of the lead deck (extracted from
 * LeadSlidesClient): a single article showing the deck hero + full product
 * grid, as opposed to the paginated per-slide "Summary" scope.
 */
export function LeadSlidesProductView({
  deckRef,
  sectionModel,
  scopeControls,
  inReportMode,
  isFullscreen,
  onToggle,
  toggleButtonRef,
}: LeadSlidesProductViewProps) {
  return (
    <div ref={deckRef}>
      {/* lead-demo-feedback #88: match the own-scope LeadSlideArticle inset
          (p-3) so toggling Summary↔Product never shifts the hero (the prior
          p-6 put the hero 12px lower/right than the own-scope path). */}
      <article className="slide-frame rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[var(--color-card)] p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        {sectionModel ? (
          <LeadSlideHero
            slide={sectionModel}
            heroControls={
              <div className="flex flex-wrap items-center gap-2">
                {scopeControls}
              </div>
            }
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(0,0,0,0.08)] pb-4">
            {scopeControls}
          </div>
        )}
        <div className="mt-5">
          <LeadProductGrid products={sectionModel?.productSlides ?? []} />
        </div>
        {!inReportMode && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <DeckToolbarControls
              isFullscreen={isFullscreen}
              onToggle={onToggle}
              toggleRef={toggleButtonRef}
            />
          </div>
        )}
      </article>
      <DeckFullscreenOverlay isFullscreen={isFullscreen} onToggle={onToggle} />
    </div>
  );
}
