import { revealAndFocus } from "../../../../../shared/ui/feedback/reveal-and-focus";
import type { LeadSubmitReadiness } from "../../../../report-sections";

function findOverviewTarget(focus: string): HTMLElement | undefined {
  return (
    document.getElementById(focus) ??
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-overview-focus]"),
    ).find((element) => element.dataset.overviewFocus === focus)
  );
}

export function focusCompletionIssue(focus?: string): void {
  const target = focus
    ? findOverviewTarget(focus)
    : document.querySelector<HTMLElement>(
        '[data-overview-focus^="confirm:current:"]',
      );
  revealAndFocus(target, { scope: target?.closest("article") ?? null });
}

export function firstPendingReviewFocus(
  readiness: LeadSubmitReadiness,
): string | undefined {
  return readiness.blockingIssues.find((issue) =>
    issue.id.startsWith("submit-validation:UNCONFIRMED_CARRIED_ITEM:"),
  )?.overviewFocus;
}
