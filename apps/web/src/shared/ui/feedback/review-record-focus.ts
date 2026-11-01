import { revealAndFocus } from "./reveal-and-focus";

export function reviewRecordAnchor(kind: string, id: string): string {
  return `review-record:${kind}:${id}`;
}

/** Reveal the existing disclosure before focusing the anchored element, without editing it. */
export function focusReviewAnchor(
  target: HTMLElement | null | undefined,
): void {
  revealAndFocus(target, {
    focusOptions: { preventScroll: true },
    scrollOptions: { block: "nearest" },
  });
}

/** Reveal the existing disclosure before focusing its record, without editing it. */
export function focusReviewRecord(anchor: string): void {
  focusReviewAnchor(document.getElementById(anchor));
}
