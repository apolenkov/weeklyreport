import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { JobsTableRow } from "./jobs-table-row";

// The timestamp cell renders in the viewer's zone, so the expected strings only
// hold with the zone pinned. `vi.stubEnv` restores an originally-unset TZ by
// deleting the key, which a plain save/reassign cannot do.
beforeAll(() => {
  vi.stubEnv("TZ", "UTC");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const TIMESTAMP_CELL_INDEX = 4;

function renderRow(timestamp: number): string {
  render(
    <table>
      <tbody>
        <JobsTableRow
          job={{
            id: "job-1",
            name: "sendReminder",
            failedReason: "boom",
            stacktrace: [],
            attemptsMade: 2,
            timestamp,
          }}
          isExpanded={false}
          isRetrying={false}
          retryDisabled={false}
          onToggleExpand={vi.fn()}
          onRetry={vi.fn()}
        />
      </tbody>
    </table>,
  );
  const cells = screen.getByTestId("jobs-row-job-1").querySelectorAll("td");
  return cells[TIMESTAMP_CELL_INDEX]?.textContent ?? "";
}

describe("JobsTableRow timestamp cell", () => {
  it("renders an epoch-milliseconds timestamp", () => {
    expect(renderRow(Date.UTC(2026, 6, 26, 9, 5))).toBe("26.07.2026, 09:05");
  });

  it("renders a midnight timestamp with a two-digit hour", () => {
    expect(renderRow(Date.UTC(2026, 11, 31, 0, 0))).toBe("31.12.2026, 00:00");
  });

  it.each([[0], [-1], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    "renders %o as the em-dash sentinel",
    (timestamp) => {
      expect(renderRow(timestamp)).toBe("—");
    },
  );
});
