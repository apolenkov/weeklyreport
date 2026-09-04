import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const REPORT_ID = "a0000000-0000-4000-8000-000000000001";
const PROJECT_ID = "a0000000-0000-4000-8000-000000000002";
const STAGE_ID = "a0000000-0000-4000-8000-000000000003";

function Wrapper({ children }: { readonly children: ReactNode }) {
  const section = makeReportSectionFixture({
    reportId: REPORT_ID,
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Payments",
        trafficLight: "green",
        ownedStages: [
          {
            stageId: STAGE_ID,
            stageName: "Development",
            sortOrder: 0,
            status: "green",
          },
        ],
        stageSet: [
          {
            stageId: STAGE_ID,
            stageName: "Development",
            sortOrder: 0,
          },
        ],
      },
    ],
    items: [
      {
        id: "a0000000-0000-4000-8000-000000000010",
        stableId: "a0000000-0000-4000-8000-000000000011",
        projectId: PROJECT_ID,
        activityId: null,
        type: "current",
        text: "Current work",
        tag: "delivery",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames: ["Development"],
      },
      {
        id: "a0000000-0000-4000-8000-000000000012",
        stableId: "a0000000-0000-4000-8000-000000000013",
        projectId: PROJECT_ID,
        activityId: null,
        type: "next",
        text: "Next work",
        tag: "delivery",
        workflowStatus: "planned",
        carriedOver: false,
        stageNames: ["Development"],
      },
    ],
  });
  const { proxy } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: section,
    },
    {
      path: ["leadForm", "statusOverview"],
      query: {
        current: {
          reportId: REPORT_ID,
          periodStart: new Date("2026-08-31T00:00:00.000Z"),
          periodEnd: new Date("2026-09-06T00:00:00.000Z"),
          section,
        },
        predecessor: { availability: "unavailable", reason: "no_predecessor" },
      },
    },
    {
      path: ["leadForm", "byPeriod"],
      query: {
        section,
        readOnly: false,
        canRequestReopen: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      },
    },
    { path: ["reports", "myHistory"], query: { items: [] } },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    { path: ["leadForm", "crossAuthors"], query: [] },
    { path: ["leadForm", "crossAuthorContent"], query: [] },
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProxyContext.Provider value={proxy}>
        <SessionContext.Provider
          value={{
            user: {
              id: section.authorId,
              name: "Test Lead",
              email: "lead@example.test",
              role: "lead",
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          {children}
        </SessionContext.Provider>
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
}

describe("LeadForm Overview", () => {
  it("uses the read-only overview query and exposes explicit edit and slides routes", async () => {
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    expect(await screen.findByTestId("status-overview")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      `/lead/report/${REPORT_ID}`,
    );
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/lead/report/${REPORT_ID}?mode=edit`,
    );
    expect(screen.getByRole("link", { name: "Slides" })).toHaveAttribute(
      "href",
      `/lead/report/${REPORT_ID}?mode=slides`,
    );
    expect(
      screen.getByRole("link", { name: "Edit full report" }),
    ).toHaveAttribute(
      "href",
      `/lead/report/${REPORT_ID}?mode=edit#report-details`,
    );
    expect(screen.queryByTestId("lead-report-form")).toBeNull();
    expect(
      screen.queryByRole("group", { name: "Document actions" }),
    ).toBeNull();
  });

  it.each([
    ["Current work", "Updated current work"],
    ["Next work", "Updated next work"],
  ])(
    "edits %s through the existing item dialog and live draft",
    async (initial, updated) => {
      const user = userEvent.setup();
      render(
        <Wrapper>
          <LeadForm reportId={REPORT_ID} mode="overview" />
        </Wrapper>,
      );

      await user.click(
        await screen.findByRole("button", { name: `Edit ${initial}` }),
      );
      const description = screen.getByLabelText(/Description \*/i);
      await user.clear(description);
      await user.type(description, updated);
      await user.click(screen.getByRole("button", { name: "Save Item" }));

      expect(await screen.findByText(updated)).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent(
        /Draft changes pending|Saving draft|Draft saved/,
      );
    },
  );

  it("opens quick-create with the selected product and saves through the live draft", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="overview" />
      </Wrapper>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Add current week update to Payments",
      }),
    );

    expect(
      screen.getByRole("heading", { name: /Add Item — Payments/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Product")).toHaveValue(
      `product:${PROJECT_ID}`,
    );

    const description = screen.getByLabelText(/Description \*/i);
    await user.type(description, "Created from the overview");
    await user.click(screen.getByRole("button", { name: "Save Item" }));

    expect(
      await screen.findByText("Created from the overview"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      /Draft changes pending|Saving draft|Draft saved/,
    );
  });
});
