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
  if (!target) return;
  const article = target.closest("article");
  const lane = target.closest<HTMLElement>(
    "[data-overview-lineage-lane],[data-overview-create-lane]",
  );
  const week =
    lane?.dataset.overviewLineageLane ?? lane?.dataset.overviewCreateLane;
  if (week)
    article
      ?.closest(".overview-table")
      ?.querySelector<HTMLButtonElement>(
        `[data-overview-week-tab="${CSS.escape(week)}"][aria-selected="false"]`,
      )
      ?.focus();
  if (article === target)
    article
      .querySelector<HTMLButtonElement>(
        '[data-unit-collapse][aria-expanded="false"]',
      )
      ?.click();
  revealAndFocus(target, { scope: article });
}

export function firstPendingReviewFocus(
  readiness: LeadSubmitReadiness,
): string | undefined {
  return readiness.blockingIssues.find((issue) =>
    issue.id.startsWith("submit-validation:UNCONFIRMED_CARRIED_ITEM:"),
  )?.overviewFocus;
}
