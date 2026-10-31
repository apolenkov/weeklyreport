export const FEEDBACK_LIST_HEADING_ID = "feedback-list-heading";

export function detailsToggleId(feedbackId: string): string {
  return `feedback-details-toggle-${feedbackId}`;
}

// The record rendered after `id`, otherwise the one before it.
export function adjacentRecordId(
  items: readonly { readonly id: string }[],
  id: string,
): string | undefined {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return undefined;
  return (items[index + 1] ?? items[index - 1])?.id;
}

// A dismissed or deleted record removes the control that opened its workflow,
// so the opener cannot take focus back. After the list re-renders, focus the
// first surviving `Details` button in priority order, else the list heading.
export function focusAfterRemoval(
  candidateIds: readonly (string | undefined)[],
): void {
  requestAnimationFrame(() => {
    for (const id of candidateIds) {
      if (id === undefined) continue;
      const target = document.getElementById(detailsToggleId(id));
      if (target !== null) {
        target.focus();
        return;
      }
    }
    document.getElementById(FEEDBACK_LIST_HEADING_ID)?.focus();
  });
}
