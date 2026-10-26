// The open lead report owns one stage memory: switching the report view from
// Overview to the editor remounts the form but must not forget the stage the
// lead just saved, because the remembered default is a convenience of the open
// draft, not of one editor instance.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => `/lead/report/${REPORT_ID}`,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const REPORT_ID = "b0000000-0000-4000-8000-000000000001";
const SECTION_ID = "b0000000-0000-4000-8000-000000000002";
const AUTHOR_ID = "b0000000-0000-4000-8000-000000000003";
const PROJECT_ID = "b0000000-0000-4000-8000-000000000004";
const DEVELOPMENT_STAGE_ID = "b0000000-0000-4000-8000-000000000005";
const TESTING_STAGE_ID = "b0000000-0000-4000-8000-000000000006";
const SERVER_ITEM_ID = "b0000000-0000-4000-8000-000000000010";
const SERVER_STABLE_ID = "b0000000-0000-4000-8000-000000000011";

function makeSection() {
  return makeReportSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    version: 1,
    status: "draft",
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Payments",
        trafficLight: "green",
        ownedStages: [
          {
            stageId: DEVELOPMENT_STAGE_ID,
            stageName: "Development",
            sortOrder: 0,
            status: "green",
          },
          {
            stageId: TESTING_STAGE_ID,
            stageName: "Testing",
            sortOrder: 1,
            status: "green",
          },
        ],
        stageSet: [
          {
            stageId: DEVELOPMENT_STAGE_ID,
            stageName: "Development",
            sortOrder: 0,
          },
          {
            stageId: TESTING_STAGE_ID,
            stageName: "Testing",
            sortOrder: 1,
          },
        ],
      },
    ],
  });
}

interface PageHarness {
  readonly client: QueryClient;
  readonly proxy: ReturnType<typeof createMockTRPC>["proxy"];
}

function makePageHarness(section = makeSection()): PageHarness {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "getActive"], query: section },
    {
      path: ["leadForm", "statusOverview"],
      query: {
        current: {
          reportId: REPORT_ID,
          periodStart: new Date("2026-08-31T00:00:00.000Z"),
          periodEnd: new Date("2026-09-06T00:00:00.000Z"),
          section,
        },
        predecessor: {
          availability: "unavailable",
          reason: "no_predecessor",
        },
      },
    },
    {
      path: ["leadForm", "openWork"],
      query: { occurrences: [], nextCursor: null },
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
    { path: ["ai", "availability"], query: { availability: "unavailable" } },
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    { path: ["leadForm", "assistant"], mutation: true },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["leadForm", "resolvePlan"], mutation: true },
    { path: ["leadForm", "restorePlan"], mutation: true },
    { path: ["leadForm", "promotePlan"], mutation: true },
  ]);
  captured["reports.saveDraft"]?.mutationFn.mockImplementation(
    (input: unknown) => {
      const draft = input as {
        readonly version: number;
        readonly items: ReturnType<typeof makeSection>["items"];
      };
      return Promise.resolve({
        ...section,
        version: draft.version + 1,
        items: draft.items.map((item) =>
          item.stableId === undefined
            ? { ...item, id: SERVER_ITEM_ID, stableId: SERVER_STABLE_ID }
            : item,
        ),
      });
    },
  );
  return { client, proxy };
}

function page(harness: PageHarness, mode: "overview" | "edit") {
  return (
    <QueryClientProvider client={harness.client}>
      <TRPCProxyContext.Provider value={harness.proxy}>
        <SessionContext.Provider
          value={{
            user: {
              id: AUTHOR_ID,
              name: "Test Lead",
              email: "lead@example.test",
              role: "lead",
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <LeadReportAssistantStore>
            <LeadForm reportId={REPORT_ID} mode={mode} />
          </LeadReportAssistantStore>
        </SessionContext.Provider>
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
}

describe("lead report stage memory across view switches", () => {
  it(
    "keeps the saved stage when Overview switches to the report editor",
    { timeout: 30_000 },
    async () => {
      const user = userEvent.setup();
      const harness = makePageHarness();
      const { rerender } = render(page(harness, "overview"));

      await user.click(
        await screen.findByRole("button", { name: "Add item to Payments" }),
      );
      await user.type(
        screen.getByLabelText(/Description \*/i),
        "Ship importer",
      );
      await user.click(screen.getByRole("checkbox", { name: "Testing" }));
      await user.click(screen.getByRole("button", { name: "Save update" }));

      // The accepted save closes the composer and confirms the remembered stage.
      await vi.waitFor(
        () =>
          expect(
            screen.queryByRole("form", {
              name: "Current week update for Payments",
            }),
          ).not.toBeInTheDocument(),
        { timeout: 15_000 },
      );

      rerender(page(harness, "edit"));

      const addItem = expectDefined(
        (await screen.findAllByRole("button", { name: /Add item/ }))[0],
      );
      await user.click(addItem);
      expect(
        await screen.findByRole("checkbox", { name: "Testing" }),
      ).toBeChecked();
      expect(
        screen.getByRole("checkbox", { name: "Development" }),
      ).not.toBeChecked();
    },
  );
});
