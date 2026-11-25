import { revealAndFocus } from "./reveal-and-focus";

export function reviewRecordAnchor(kind: string, id: string): string {
  return `review-record:${kind}:${id}`;
}

/** Reveal the existing disclosure before focusing the anchored element, without editing it. */
function focusReviewAnchor(target: HTMLElement | null | undefined): void {
  revealAndFocus(target, {
    focusOptions: { preventScroll: true },
    scrollOptions: { block: "nearest" },
  });
}

/** Reveal the existing disclosure before focusing its record, without editing it. */
export function focusReviewRecord(anchor: string): void {
  const record = document.getElementById(anchor);
  const discussion = record?.querySelector<HTMLButtonElement>(
    "[data-review-discussion]",
  );
  focusReviewAnchor(discussion ?? record);
  if (discussion) queueMicrotask(() => discussion.click());
}
