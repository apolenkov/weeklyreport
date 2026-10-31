import type { SectionSlideModel, SlideTone } from "./section-slide-contracts";

// Review ordering: blocked slides first, then warning, empty, ready; ties break
// on score then owner name. The map is static domain configuration.
const TONE_WEIGHT: Readonly<Record<SlideTone, number>> = {
  blocked: 0,
  warning: 1,
  empty: 2,
  ready: 3,
};

export function sortSlidesForReview(
  slides: readonly SectionSlideModel[],
): readonly SectionSlideModel[] {
  return [...slides].sort((left, right) => {
    const toneDiff = TONE_WEIGHT[left.tone] - TONE_WEIGHT[right.tone];
    if (toneDiff !== 0) return toneDiff;
    const scoreDiff = left.score - right.score;
    return scoreDiff !== 0
      ? scoreDiff
      : left.ownerName.localeCompare(right.ownerName);
  });
}

// Stable identity of one rendered slide page: the React key of its article and
// the head deck's remembered selection.
export function slideArticleKey(slide: SectionSlideModel): string {
  return `${slide.id}:${String(slide.pageIndex ?? 0)}`;
}
