import type { ReportSectionReadModel } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import { sectionToDraftPayload } from "../../../../report-sections";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mutable so a test can drive the addressed-route path (`/lead/report/<id>`),
// which makes LeadSlidesClient resolve inReportMode=true. Vitest allows
// `mock`-prefixed outer vars inside a hoisted vi.mock factory.
let mockPathname = "/lead/report";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => mockPathname,
}));

const SECTION_ID = "11111111-1111-1111-1111-111111111111";
const REPORT_ID = "33333333-3333-3333-3333-333333333333";
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";
const AUTHOR_ID = "44444444-4444-4444-4444-444444444444";

function makeSection(overrides: { status?: "draft" | "submitted" } = {}) {
  return makeReportSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead" as const,
    status: overrides.status ?? ("draft" as const),
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Test Product",
        trafficLight: "green" as const,
        // Owned stage so the SDLC pipeline renders an editable chip for dirty tests.
        ownedStages: [
          {
            stageId: "88888888-8888-4888-8888-888888888888",
            stageName: "Development",
            sortOrder: 3,
          },
        ],
      },
    ],
    items: [
      {
        id: "55555555-5555-5555-5555-555555555555",
        stableId: "5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a",
        projectId: PROJECT_ID,
        type: "current" as const,
        text: "Existing item",
        tag: "tag",
        workflowStatus: "in_progress" as const,
        carriedOver: false,
      },
    ],
    decisions: [
      {
        id: "66666666-6666-6666-6666-666666666666",
        stableId: "6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6a6a",
        text: "Existing decision",
        owner: "Owner",
        impact: "Impact",
      },
    ],
  });
}

function buildHarness(
  opts: {
    sectionStatus?: "draft" | "submitted";
    byPeriodReadOnly?: boolean;
    canRequestReopen?: boolean;
    byPeriodQueryFn?: () => Promise<unknown>;
    myHistory?: readonly unknown[];
    unifiedActivityView?: boolean;
  } = {},
) {
  const { proxy, captured } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: {
        reportId: REPORT_ID,
        reportSectionId: SECTION_ID,
        authorName: "Test Lead",
        authorRole: "lead" as const,
      },
    },
    {
      path: ["reports", "myHistory"],
      query: { items: opts.myHistory ?? [] },
    },
    {
      path: ["reports", "saveDraft"],
      mutation: true,
    },
    {
      path: ["reports", "submit"],
      mutation: true,
    },
    {
      path: ["leadForm", "byPeriod"],
      query:
        opts.byPeriodQueryFn ??
        (() => ({
          section: makeSection(
            opts.sectionStatus === undefined
              ? {}
              : { status: opts.sectionStatus },
          ),
          readOnly: opts.byPeriodReadOnly ?? false,
          // Server-computed; default true so Request-Reopen tests have a precondition.
          canRequestReopen:
            opts.canRequestReopen ?? opts.sectionStatus === "submitted",
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        })),
    },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: opts.unifiedActivityView ?? false },
    },
    {
      path: ["leadForm", "revoke"],
      mutation: true,
    },
    {
      path: ["leadForm", "fillFrom"],
      mutation: true,
    },
    {
      path: ["leadForm", "requestReopen"],
      mutation: true,
    },
    {
      path: ["leadForm", "crossAuthors"],
      query: [],
    },
    {
      path: ["leadForm", "crossAuthorContent"],
      query: [],
    },
    { path: ["review", "dashboard"] },
    { path: ["archive", "list"] },
    { path: ["weeklyReport", "get"] },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
  ]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionContext.Provider
          value={{
            user: {
              id: AUTHOR_ID,
              name: "Test Lead",
              email: "lead@example.com",
              role: "lead",
            },
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <TRPCProxyContext.Provider value={proxy}>
            <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  }

  return { Wrapper, captured, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mockPathname = "/lead/report";
});

describe("LeadForm icon SVGs — aria-hidden", () => {
  async function renderAndSettle() {
    const { Wrapper } = buildHarness();
    const { container } = render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await screen.findByText("Autosaved");
    return container;
  }

  it.each([
    ["GridIcon", "lead-section-product-status"],
    ["CalendarIcon", "lead-section-current-week"],
    ["NextWeekIcon", "lead-section-next-week"],
    ["AlertIcon", "lead-section-risks"],
    ["ChatIcon", "lead-section-decisions"],
  ] as const)("%s svg has aria-hidden=true", async (_icon, testId) => {
    const container = await renderAndSettle();
    const section = container.querySelector(
      `[data-testid="${CSS.escape(testId)}"]`,
    );
    expect(section).not.toBeNull();
    const svg = section?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("CollapseIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    // CollapseIcon renders inside the mode-adaptive collapse-all control
    // (edit mode), which is icon-only — its accessible name lives on the
    // button as aria-label + title, reflecting the current collapse state.
    const toggleBtn = container.querySelector(
      'button[title="Collapse all sections"]',
    );
    expect(toggleBtn).not.toBeNull();
    const svg = toggleBtn?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("exposes a stable landmark for the loaded edit body", async () => {
    const container = await renderAndSettle();

    expect(
      container.querySelector('[data-layout-key="lead-report-body"]'),
    ).not.toBeNull();
  });

  it("snapshot: all icon SVGs rendered in LeadForm have aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const allSvgs = Array.from(container.querySelectorAll("svg"));
    // At minimum the 6 icon SVGs (Grid, Calendar, NextWeek, Alert, Chat,
    // Collapse) must be present; each must carry aria-hidden="true".
    expect(allSvgs.length).toBeGreaterThanOrEqual(6);
    for (const svg of allSvgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });
});

// Trailing utility is one mode-adaptive slot: collapse-all (edit) / fullscreen
// (slides), always reserved — never an inert "Toggle All".
describe("LeadForm mode-adaptive trailing control", () => {
  it("edit mode: shows an enabled icon-only collapse control whose label reflects state", async () => {
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    const collapseBtn = await screen.findByRole("button", {
      name: "Collapse all sections",
    });
    expect(collapseBtn).toBeEnabled();
    // Icon-only: the former visible "Toggle All" text label is gone.
    expect(collapseBtn).not.toHaveTextContent("Toggle All");

    // Activating it flips groupExpanded → the accessible name updates.
    act(() => {
      collapseBtn.click();
    });
    expect(
      await screen.findByRole("button", { name: "Expand all sections" }),
    ).toBeInTheDocument();
  });

  it("edit mode with an empty report: enables collapse for the visible sections", async () => {
    const { Wrapper } = buildHarness({
      byPeriodQueryFn: () =>
        Promise.resolve({
          section: {
            reportSectionId: SECTION_ID,
            reportId: REPORT_ID,
            authorId: AUTHOR_ID,
            authorName: "Test Lead",
            authorRole: "lead" as const,
            status: "draft" as const,
            submittedAt: null,
            projects: [],
            referencedProjects: [],
            items: [],
            risks: [],
            decisions: [],
            priorities: [],
            activities: [],
          },
          readOnly: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        }),
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Product Status and the other edit sections remain mounted even when the
    // report has no records, so the group control remains actionable.
    expect(
      await screen.findByTestId("lead-section-product-status"),
    ).toBeInTheDocument();
    const collapseBtn = await screen.findByRole("button", {
      name: "Collapse all sections",
    });
    expect(collapseBtn).toBeEnabled();
  });

  it("slides mode: the trailing slot shows the fullscreen toggle, not a collapse/Toggle-All control", async () => {
    // Addressed route + history → inReportMode deck (suppresses its own
    // fullscreen); toHaveLength(1) guards against a second deck-mounted control.
    mockPathname = `/lead/report/${REPORT_ID}`;
    const { Wrapper } = buildHarness({
      myHistory: [
        {
          sectionId: SECTION_ID,
          reportId: REPORT_ID,
          periodStart: new Date("2026-06-15T00:00:00Z"),
          periodEnd: new Date("2026-06-21T00:00:00Z"),
          reportStatus: "open",
          sectionStatus: "draft",
          submittedAt: null,
          publishedAt: null,
        },
      ],
    });
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="slides" />
      </Wrapper>,
    );

    // Exactly one fullscreen control (no duplicate context-bar + in-deck mount).
    const fsButtons = await screen.findAllByRole("button", {
      name: /Enter fullscreen/i,
    });
    expect(fsButtons).toHaveLength(1);
    // The deck rendered for real (not the "No active slide" empty state), so
    // the single-fullscreen assertion above covers the populated-deck path.
    expect(screen.queryByText("No active slide")).toBeNull();

    // No collapse-all / "Toggle All" affordance renders in slides.
    expect(
      screen.queryByRole("button", { name: "Collapse all sections" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Expand all sections" }),
    ).toBeNull();
    expect(screen.queryByText("Toggle All")).toBeNull();
  });

  it("slides mode: hosts one reversible density control with desktop view labels", async () => {
    mockPathname = `/lead/report/${REPORT_ID}`;
    const { Wrapper } = buildHarness({
      myHistory: [
        {
          sectionId: SECTION_ID,
          reportId: REPORT_ID,
          periodStart: new Date("2026-06-15T00:00:00Z"),
          periodEnd: new Date("2026-06-21T00:00:00Z"),
          reportStatus: "open",
          sectionStatus: "draft",
          submittedAt: null,
          publishedAt: null,
        },
      ],
    });
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="slides" />
      </Wrapper>,
    );

    const contextControls = await screen.findByRole("group", {
      name: "Context controls",
    });
    expect(screen.getByText("Existing item")).toBeInTheDocument();
    expect(within(contextControls).getByText("Edit")).toHaveClass(
      "sr-only",
      "lg:not-sr-only",
    );
    expect(within(contextControls).getByText("Slides")).toHaveClass(
      "sr-only",
      "lg:not-sr-only",
    );
    expect(
      within(contextControls).getByRole("group", { name: "Slide density" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("group", { name: "Slide density" }),
    ).toHaveLength(1);

    const presentation = within(contextControls).getByRole("button", {
      name: "Presentation",
    });
    fireEvent.click(presentation);
    expect(presentation).toHaveAttribute("aria-pressed", "true");

    const document = within(contextControls).getByRole("button", {
      name: "Document",
    });
    fireEvent.click(document);
    expect(document).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getAllByRole("group", { name: "Slide density" }),
    ).toHaveLength(1);
    expect(screen.getByText("Existing item")).toBeInTheDocument();
  });

  it("+ Add stays present (and enabled) when the lead switches to slides mode", async () => {
    mockPathname = `/lead/report/${REPORT_ID}`;
    const { Wrapper } = buildHarness({
      myHistory: [
        {
          sectionId: SECTION_ID,
          reportId: REPORT_ID,
          periodStart: new Date("2026-06-15T00:00:00Z"),
          periodEnd: new Date("2026-06-21T00:00:00Z"),
          reportStatus: "open",
          sectionStatus: "draft",
          submittedAt: null,
          publishedAt: null,
        },
      ],
    });
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="slides" />
      </Wrapper>,
    );

    const documentActions = await screen.findByRole("group", {
      name: "Document actions",
    });
    const quickAddButton = within(documentActions).getByRole("button", {
      name: "+ Add",
    });
    expect(quickAddButton).toBeInTheDocument();
    expect(quickAddButton).toBeEnabled();
  });
});

describe("sectionToDraftPayload — activity-status slice", () => {
  it("round-trips every seeded activity into activityStatuses", () => {
    const base = makeSection();
    const withActivities = makeReportSectionFixture({
      ...base,
      activities: [
        {
          activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          activityName: "Jira triage duty",
          status: "red",
          note: "Blocked on vendor",
          linkedProducts: [],
          derivedStatus: null,
        },
        {
          activityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          activityName: "Ops rotation",
          status: null,
          linkedProducts: [],
          derivedStatus: null,
        },
      ],
    });

    const payload = sectionToDraftPayload(withActivities);

    expect(payload.activityStatuses).toEqual([
      {
        activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "red",
        note: "Blocked on vendor",
      },
      {
        activityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: null,
        note: null,
      },
    ]);
  });
});

describe("sectionToDraftPayload — durable stableId round-trip", () => {
  // Existing rows must carry stableId so save preserves identity; new rows omit
  // it (server mints) — absent key, not a failed write.
  it("carries stableId for existing item + decision rows", () => {
    const payload = sectionToDraftPayload(makeSection());
    expect(expectDefined(payload.items[0]).stableId).toBe(
      "5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a",
    );
    expect(expectDefined(payload.decisions[0]).stableId).toBe(
      "6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6a6a",
    );
  });

  it("emits undefined stableId for a brand-new row (server mints it)", () => {
    const base = makeSection();
    const withNewItem: ReportSectionReadModel = {
      ...base,
      items: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          projectId: base.projects[0]?.projectId ?? "",
          type: "current",
          text: "Fresh item",
          tag: "tag",
          workflowStatus: "in_progress",
          carriedOver: false,
          stageNames: ["Planning"],
        },
      ],
    };
    const payload = sectionToDraftPayload(withNewItem);
    expect(expectDefined(payload.items[0]).stableId).toBeUndefined();
  });
});

// Org flag: off = Current/Next sections; on = unified by-state. Item.type
// storage unchanged either way.
describe("unified by-state view flag", () => {
  it("flag off: classic Current Week / Next Week sections render", async () => {
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(
      await screen.findByTestId("lead-section-current-week"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("lead-section-next-week")).toBeInTheDocument();
    expect(
      screen.queryByTestId("lead-section-unified"),
    ).not.toBeInTheDocument();
  });

  it("flag on: one unified section replaces the two week sections", async () => {
    const { Wrapper } = buildHarness({ unifiedActivityView: true });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(
      await screen.findByTestId("lead-section-unified"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("lead-section-current-week"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("lead-section-next-week"),
    ).not.toBeInTheDocument();
  });
});
