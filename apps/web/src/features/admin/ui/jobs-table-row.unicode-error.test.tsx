import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { JobsTableRow } from "./jobs-table-row";

// An emoji landing exactly on the collapsed-length budget used to render as a
// lone surrogate; the collapsed cell must keep whole graphemes and Expand must
// still reveal the original reason byte-for-byte.
const UNICODE_REASON = `${"x".repeat(78)}😀 still failing downstream`;
const COLLAPSED_REASON = `${"x".repeat(78)}…`;

function rowElement(isExpanded: boolean, onToggleExpand: () => void) {
  return (
    <table>
      <tbody>
        <JobsTableRow
          job={{
            id: "job-unicode",
            name: "sendReminder",
            failedReason: UNICODE_REASON,
            stacktrace: [],
            attemptsMade: 1,
            timestamp: 0,
          }}
          isExpanded={isExpanded}
          isRetrying={false}
          retryDisabled={false}
          isRemoving={false}
          removeDisabled={false}
          onToggleExpand={onToggleExpand}
          onRetry={vi.fn()}
          onRemove={vi.fn()}
        />
      </tbody>
    </table>
  );
}

describe("JobsTableRow unicode failure reason", () => {
  it("collapses at a grapheme boundary and expands to the exact reason", async () => {
    const user = userEvent.setup();
    const onToggleExpand = vi.fn();
    const { rerender } = render(rowElement(false, onToggleExpand));

    const cell = screen
      .getByTestId("jobs-row-job-unicode")
      .querySelectorAll("td")[3];
    expect(cell).toBeDefined();
    expect(cell?.textContent).toContain(COLLAPSED_REASON);
    expect(cell?.textContent).not.toContain("�");
    expect(cell?.textContent).not.toContain(UNICODE_REASON);

    await user.click(
      screen.getByRole("button", { name: "Expand job job-unicode error" }),
    );
    expect(onToggleExpand).toHaveBeenCalledWith("job-unicode");

    rerender(rowElement(true, onToggleExpand));
    expect(cell?.textContent).toContain(UNICODE_REASON);
  });
});
