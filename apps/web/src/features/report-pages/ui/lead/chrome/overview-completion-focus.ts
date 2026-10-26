import type { LeadSubmitReadiness } from "../../../../report-sections";

function findOverviewTarget(focus: string): HTMLElement | undefined {
  return (
    document.getElementById(focus) ??
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-overview-focus]"),
    ).find((element) => element.dataset.overviewFocus === focus)
  );
}

function focusOverviewTarget(target: HTMLElement): void {
  if (target.closest("[hidden], [inert]")) {
    const unit = target.closest("article");
    const expander = Array.from(
      unit?.querySelectorAll<HTMLButtonElement>(
        'button[aria-expanded="false"][aria-controls]',
      ) ?? [],
    ).find((button) => {
      const controlledId = button.getAttribute("aria-controls");
      return controlledId
        ? document.getElementById(controlledId)?.contains(target)
        : false;
    });
    if (expander) {
      expander.click();
      queueMicrotask(() => target.focus());
      return;
    }
  }
  target.focus();
}

export function focusCompletionIssue(focus?: string): void {
  const target = focus
    ? findOverviewTarget(focus)
    : document.querySelector<HTMLElement>(
        '[data-overview-focus^="confirm:current:"]',
      );
  if (target) focusOverviewTarget(target);
}

export function firstPendingReviewFocus(
  readiness: LeadSubmitReadiness,
): string | undefined {
  return readiness.blockingIssues.find((issue) =>
    issue.id.startsWith("submit-validation:UNCONFIRMED_CARRIED_ITEM:"),
  )?.overviewFocus;
}
