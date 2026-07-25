import type { SectionSlideModel, SlideTone } from "./section-slide-contracts";

/**
 * Sort Slides For Review.
 * @param slides - The slides argument.
 */
export function sortSlidesForReview(
  slides: readonly SectionSlideModel[],
): SectionSlideModel[] {
  const toneWeight: Record<SlideTone, number> = {
    blocked: 0,
    warning: 1,
    empty: 2,
    ready: 3,
  };
  return [...slides].sort((left, right) => {
    const toneDiff = toneWeight[left.tone] - toneWeight[right.tone];
    if (toneDiff !== 0) return toneDiff;
    const scoreDiff = left.score - right.score;
    return scoreDiff !== 0
      ? scoreDiff
      : left.ownerName.localeCompare(right.ownerName);
  });
}
