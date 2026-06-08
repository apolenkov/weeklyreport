/**
 * @vitest-environment jsdom
 *
 * VA-0a / VA-0b regression tests for activity-live-panel.tsx.
 *
 * Catalog: openspec/changes/verify-a11y-recommended-flip/design.md
 * Section: apps/web/src/components/dashboard/activity-live-panel.tsx
 *
 * In-scope rows:
 *   unit-rtl/high  — draft-status div: no aria-label
 *   unit-rtl/high  — draft-status div: title="Lead is still working, report not submitted"
 *   unit-rtl/high  — empty-status div: title="${leadName} has no report content yet"
 *   unit-rtl/high  — empty-status div: no aria-label
 *   snapshot/medium — draft branch cursor-default (class check, not full snapshot)
 *   snapshot/medium — empty branch emptyClassName (class check, not full snapshot)
 *
 * NOTE: snapshot rows are implemented as explicit class assertions rather than
 * toMatchSnapshot() — full DOM snapshots are brittle here (Tailwind class soup,
 * CSS-var strings); the class checks test the identical regression target more
 * durably. Deviation noted in the change catalog notes.
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

vi.mock("../../lib/trpc-context", () => ({
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

describe("ActivityLivePanel — draft-status div (hasContent && isDraft)", () => {
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

  it("draft-status div has no aria-label attribute", () => {
    renderWithData(draftData);
    const draftDiv = screen.getByTitle(
      "Lead is still working, report not submitted",
    );
    expect(draftDiv).not.toHaveAttribute("aria-label");
  });

  it("draft-status div renders with the correct title attribute", () => {
    renderWithData(draftData);
    expect(
      screen.getByTitle("Lead is still working, report not submitted"),
    ).toBeInTheDocument();
  });

  it("draft-status branch uses cursor-default (not cursor-pointer)", () => {
    renderWithData(draftData);
    const draftDiv = screen.getByTitle(
      "Lead is still working, report not submitted",
    );
    expect(draftDiv.className).toContain("cursor-default");
    expect(draftDiv.className).not.toContain("cursor-pointer");
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

  it("empty-status div title contains the lead name", () => {
    renderWithData(emptyData);
    const emptyDiv = screen.getByTitle("Bob Jones has no report content yet");
    expect(emptyDiv).toBeInTheDocument();
  });

  it("empty-status div has no aria-label attribute", () => {
    renderWithData(emptyData);
    const emptyDiv = screen.getByTitle("Bob Jones has no report content yet");
    expect(emptyDiv).not.toHaveAttribute("aria-label");
  });

  it("empty-status branch applies cursor-default and opacity-65 classes", () => {
    renderWithData(emptyData);
    const emptyDiv = screen.getByTitle("Bob Jones has no report content yet");
    expect(emptyDiv.className).toContain("cursor-default");
    expect(emptyDiv.className).toContain("opacity-65");
    expect(emptyDiv.className).not.toContain("cursor-pointer");
  });
});
