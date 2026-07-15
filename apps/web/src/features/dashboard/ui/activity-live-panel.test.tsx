/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import type { ActivityLiveResponse } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    activity: {
      live: {
        queryOptions: () => ({ queryKey: ["activity.live"] }),
      },
    },
  }),
}));

// Import after mocks are registered.
import { useQuery } from "@tanstack/react-query";

import { ActivityLivePanel } from "./activity-live-panel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_REPORT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DRAFT_LEAD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EMPTY_LEAD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SUBMITTED_LEAD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

/** Minimum valid ActivityLiveRow fixture. */
function makeRow(
  overrides: Partial<ActivityLiveResponse["rows"][number]>,
): ActivityLiveResponse["rows"][number] {
  return {
    reportId: BASE_REPORT_ID,
    reportSectionId: null,
    leadId: DRAFT_LEAD_ID,
    leadName: "Alice Smith",
    email: "alice@customreport.local",
    status: "draft",
    itemCount: 0,
    riskCount: 0,
    decisionCount: 0,
    priorityCount: 0,
    lastEditAt: null,
    submittedAt: null,
    ...overrides,
  };
}

/** Render the panel with a fixed query response. */
function renderWithData(data: ActivityLiveResponse) {
  vi.mocked(useQuery).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useQuery>);

  return render(<ActivityLivePanel />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ActivityLivePanel — content-bearing rows", () => {
  const draftData: ActivityLiveResponse = {
    reportId: BASE_REPORT_ID,
    periodStart: new Date("2025-06-02"),
    periodEnd: new Date("2025-06-08"),
    periodStatus: "open",
    rows: [
      makeRow({
        leadId: DRAFT_LEAD_ID,
        leadName: "Alice Smith",
        status: "draft",
        itemCount: 2,
      }),
    ],
  };
  const submittedData: ActivityLiveResponse = {
    reportId: BASE_REPORT_ID,
    periodStart: new Date("2025-06-02"),
    periodEnd: new Date("2025-06-08"),
    periodStatus: "open",
    rows: [
      makeRow({
        leadId: SUBMITTED_LEAD_ID,
        leadName: "Carol White",
        status: "submitted",
        riskCount: 1,
      }),
    ],
  };

  it("links a draft row to the exact focused report with an accessible name", () => {
    renderWithData(draftData);
    const accessibleName = "Open Alice Smith report section";
    const draftLink = screen.getByRole("link", {
      name: accessibleName,
    });

    expect(draftLink).toHaveAttribute(
      "href",
      `/head/report/${BASE_REPORT_ID}?authorId=${DRAFT_LEAD_ID}`,
    );
    expect(draftLink).toHaveAccessibleName(accessibleName);
    expect(draftLink).toHaveAttribute(
      "title",
      "Open Alice Smith report section",
    );
    expect(draftLink.className).toContain("cursor-pointer");
    expect(draftLink.className).toContain("hover:bg-[var(--color-success)]");
    expect(draftLink.className).toContain("focus-visible:ring-2");
    expect(screen.getByText("Draft")).toBeVisible();
  });

  it("keeps a submitted row linked with keyboard-focus affordances", () => {
    renderWithData(submittedData);
    const submittedLink = screen.getByRole("link", {
      name: "Open Carol White report section",
    });

    expect(submittedLink).toHaveAttribute(
      "href",
      `/head/report/${BASE_REPORT_ID}?authorId=${SUBMITTED_LEAD_ID}`,
    );
    expect(submittedLink.className).toContain("focus-visible:outline-none");
    expect(submittedLink.className).toContain("focus-visible:ring-2");
    expect(submittedLink.className).toContain("focus-visible:ring-offset-2");
    submittedLink.focus();
    expect(submittedLink).toHaveFocus();
  });
});

describe("ActivityLivePanel — empty-status div (no content)", () => {
  const emptyData: ActivityLiveResponse = {
    reportId: BASE_REPORT_ID,
    periodStart: new Date("2025-06-02"),
    periodEnd: new Date("2025-06-08"),
    periodStatus: "open",
    rows: [
      makeRow({
        leadId: EMPTY_LEAD_ID,
        leadName: "Bob Jones",
        status: "draft",
        itemCount: 0,
        riskCount: 0,
        decisionCount: 0,
        priorityCount: 0,
      }),
    ],
  };

  it("keeps a row with zero content inert", () => {
    renderWithData(emptyData);
    const emptyDiv = screen.getByTitle("Bob Jones has no report content yet");

    expect(emptyDiv).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(emptyDiv).not.toHaveAttribute("aria-label");
    expect(emptyDiv).toHaveTextContent(
      "0 items · 0 risks · 0 decisions · 0 priorities",
    );
    expect(screen.getByText("No content")).toBeVisible();
    expect(emptyDiv.className).toContain("cursor-default");
    expect(emptyDiv.className).toContain("opacity-65");
    expect(emptyDiv.className).not.toContain("cursor-pointer");
  });
});
