import { revealAndFocus } from "./reveal-and-focus";

export function reviewRecordAnchor(kind: string, id: string): string {
  return `review-record:${kind}:${id}`;
}

/** Reveal the existing disclosure before focusing its record, without editing it. */
export function focusReviewRecord(anchor: string): void {
  revealAndFocus(document.getElementById(anchor), {
    focusOptions: { preventScroll: true },
    scrollOptions: { block: "nearest" },
  });
}
