// @vitest-environment jsdom
// Private recovery of the author's kept unfinished drafts from history
// (openspec: lead-retained-incomplete-records).
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RetainedIncompleteRecordsOutput } from "@weeklyreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HistoryEntry } from "../../../report-sections";
import { LeadHistoryList } from "../lead-history-list";

const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const SECTION_ID = "11111111-1111-4111-8111-111111111111";

const read = vi.fn<() => Promise<RetainedIncompleteRecordsOutput>>();
const queryInput = vi.fn();

vi.mock("../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    leadForm: {
      retainedIncompleteRecords: {
        queryOptions: (input: unknown) => {
          queryInput(input);
          return {
            queryKey: ["retainedIncompleteRecords", input],
            queryFn: read,
            retry: false,
          };
        },
      },
    },
  }),
}));

const entry: HistoryEntry = {
  id: SECTION_ID,
  periodId: REPORT_ID,
  weekLabel: "Week 20",
  dateRange: "May 11-17, 2026",
  status: "published",
  archived: false,
  submissionState: "submitted",
  submittedAt: "May 15",
  createdAt: "May 12",
  lastEditAt: "May 15",
  trafficLights: { green: 1, yellow: 0, red: 0 },
  itemCount: 1,
  riskCount: 0,
  decisionCount: 0,
  priorityCount: 0,
};

const AVAILABLE: RetainedIncompleteRecordsOutput = {
  status: "available",
  reportId: REPORT_ID,
  reportSectionId: SECTION_ID,
  periodStart: new Date("2026-05-11T00:00:00.000Z"),
  periodEnd: new Date("2026-05-17T00:00:00.000Z"),
  readOnlyReason: "published",
  risks: [
    {
      stableId: "33333333-3333-4333-8333-333333333333",
      projectId: "44444444-4444-4444-8444-444444444444",
      risk: "Vendor may slip",
      impact: null,
      mitigation: "Second vendor",
      severity: "at-risk",
      stageNames: ["Development"],
    },
  ],
  decisions: [],
};

function renderList(over: Partial<HistoryEntry>) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LeadHistoryList entries={[{ ...entry, ...over }]} />
    </QueryClientProvider>,
  );
}

const RETAINED = {
  retainedDrafts: { risks: 1, decisions: 0, readOnlyReason: "published" },
} as const;

describe("history: kept unfinished drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads nothing until the author asks, then shows the draft read-only", async () => {
    read.mockResolvedValue(AVAILABLE);
    renderList(RETAINED);

    expect(read).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", {
        name: "View 1 unfinished draft kept in Week 20, May 11-17, 2026",
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Unfinished drafts",
    });
    expect(queryInput).toHaveBeenCalledWith({
      reportId: REPORT_ID,
      reportSectionId: SECTION_ID,
    });
    expect(await screen.findByText("Vendor may slip")).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      "This report is published and can no longer be edited, so these drafts are read-only.",
    );
    expect(dialog).toHaveTextContent("Mitigation:Second vendor");
    // A missing detail is not invented, and nothing here edits or reopens.
    expect(dialog).not.toHaveTextContent("Impact:");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reopen|save|edit/iu }),
    ).not.toBeInTheDocument();
  });

  it("copies only on an explicit action, without the source's identity", async () => {
    read.mockResolvedValue(AVAILABLE);
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    renderList(RETAINED);

    await user.click(screen.getByRole("button", { name: /^View 1/u }));
    await screen.findByText("Vendor may slip");
    expect(writeText).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Copy risk text: Vendor may slip" }),
    );

    expect(writeText).toHaveBeenCalledWith(
      "Vendor may slip\nMitigation: Second vendor\nStages: Development",
    );
  });

  it("says so when the kept drafts are gone, without promising them", async () => {
    read.mockResolvedValue({ status: "unavailable" });
    renderList(RETAINED);

    await userEvent.click(screen.getByRole("button", { name: /^View 1/u }));

    expect(
      await screen.findByText("These drafts are no longer available."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Copy/u })).toBeNull();
  });

  it("offers a retry when the read fails", async () => {
    read.mockRejectedValue(new Error("offline"));
    renderList(RETAINED);

    await userEvent.click(screen.getByRole("button", { name: /^View 1/u }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The drafts could not be loaded.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps the frozen omission note when the source holds no drafts any more", () => {
    renderList({
      publishedOmissions: { risks: 1, decisions: 1, unknown: false },
    });

    expect(
      screen.getByText(
        "Published without 2 unfinished records; the drafts are no longer available.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("adds nothing to a card with no unfinished records", () => {
    renderList({
      publishedOmissions: { risks: 0, decisions: 0, unknown: true },
    });

    expect(screen.queryByText(/unfinished/u)).not.toBeInTheDocument();
  });
});
