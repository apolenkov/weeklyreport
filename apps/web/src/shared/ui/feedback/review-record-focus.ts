export function reviewRecordAnchor(kind: string, id: string): string {
  return `review-record:${kind}:${id}`;
}

/** Reveal the existing disclosure before focusing its record, without editing it. */
export function focusReviewRecord(anchor: string): void {
  const target = document.getElementById(anchor);
  if (!target) return;
  if (target.closest("[hidden], [inert]")) {
    const expander = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        'button[aria-expanded="false"][aria-controls]',
      ),
    ).find((button) => {
      const panelId = button.getAttribute("aria-controls");
      return panelId
        ? document.getElementById(panelId)?.contains(target)
        : false;
    });
    expander?.click();
  }
  queueMicrotask(() => {
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest" });
  });
}
