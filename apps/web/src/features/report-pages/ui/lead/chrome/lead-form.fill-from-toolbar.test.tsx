import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TRPCClientError } from "@trpc/client";
import type { DraftSavePayload } from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { LeadForm } from "../shell/lead-form";

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

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "44444444-4444-4444-8444-444444444444";

function makeSection(overrides: { status?: "draft" | "submitted" } = {}) {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead" as const,
    version: 1,
    status: overrides.status ?? ("draft" as const),
    submittedAt: null,
    referencedProjects: [],
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
        stageSet: [
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
        id: "55555555-5555-4555-8555-555555555555",
        stableId: "5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a",
        projectId: PROJECT_ID,
        type: "current" as const,
        text: "Existing item",
        stageNames: ["Development"],
        tag: "tag",
        workflowStatus: "in_progress" as const,
        carriedOver: false,
      },
    ],
    risks: [],
    decisions: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        stableId: "6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6a6a",
        productId: PROJECT_ID,
        text: "Existing decision",
        stageNames: ["Development"],
        owner: "Owner",
        impact: "Impact",
      },
    ],
    priorities: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        rank: 1,
        text: "Priority text",
      },
    ],
    activities: [],
    reviews: [],
  };
}

function submittedHistory(sourceSectionId: string) {
  return [
    {
      sectionId: sourceSectionId,
      reportId: "99999999-9999-4999-8999-999999999990",
      periodStart: new Date("2026-06-08T00:00:00Z"),
      periodEnd: new Date("2026-06-14T00:00:00Z"),
      reportStatus: "published",
      sectionStatus: "submitted",
      submittedAt: new Date("2026-06-13T10:00:00Z"),
      publishedAt: new Date("2026-06-14T10:00:00Z"),
    },
  ];
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
      path: ["ai", "availability"],
      query: { availability: "not_configured" },
    },
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
    { path: ["leadForm", "assistant"], mutation: true },
    { path: ["leadForm", "resolvePlan"], mutation: true },
    { path: ["leadForm", "restorePlan"], mutation: true },
    { path: ["leadForm", "promotePlan"], mutation: true },
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

describe("LeadForm mutation wiring — fill-from, toolbar & reopen", () => {
  it("fillFrom success: invalidates leadForm, fires toast.success", async () => {
    const sourceSectionId = "99999999-9999-4999-8999-999999999999";
    const { Wrapper, captured, queryClient } = buildHarness({
      myHistory: submittedHistory(sourceSectionId),
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const fillFromEntry = expectDefined(captured["leadForm.fillFrom"]);
    fillFromEntry.mutationFn.mockResolvedValue({
      success: true,
      copiedItems: 1,
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await screen.findByText("Autosaved");
    act(() => {
      screen
        .getByRole("button", {
          name: "Fill from most recent submitted period",
        })
        .click();
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: /^Fill from Week \d+\?$/,
    });
    act(() => {
      within(dialog).getByRole("button", { name: "Replace & fill" }).click();
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Form filled from selected period",
      ),
    );
    // invalidateLeadForm covers reports.getActive + leadForm.byPeriod.
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("fillFrom CONFLICT (stale target version): surfaces the reload prompt", async () => {
    const sourceSectionId = "99999999-9999-4999-8999-999999999999";
    const { Wrapper, captured } = buildHarness({
      myHistory: submittedHistory(sourceSectionId),
    });
    const conflict = new TRPCClientError("stale");
    Object.defineProperty(conflict, "data", {
      value: { httpStatus: 409, code: "CONFLICT" },
      configurable: true,
    });

    expectDefined(captured["leadForm.fillFrom"]).mutationFn.mockRejectedValue(
      conflict,
    );
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await screen.findByText("Autosaved");
    act(() => {
      screen
        .getByRole("button", {
          name: "Fill from most recent submitted period",
        })
        .click();
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: /^Fill from Week \d+\?$/,
    });
    act(() => {
      within(dialog).getByRole("button", { name: "Replace & fill" }).click();
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("changed elsewhere"),
      ),
    );
  });

  it("fillFrom sends the current target version after an autosave bump", async () => {
    const sourceSectionId = "99999999-9999-4999-8999-999999999999";
    let serverVersion = 1;
    let stageStatus: "green" | "yellow" | "red" | null = null;
    const currentServerSection = () => ({
      ...makeSection(),
      version: serverVersion,
      projects: makeSection().projects.map((project) => ({
        ...project,
        ownedStages: project.ownedStages.map((stage) => ({
          ...stage,
          status: stageStatus,
        })),
      })),
    });
    const { Wrapper, captured } = buildHarness({
      byPeriodQueryFn: () =>
        Promise.resolve({
          section: currentServerSection(),
          readOnly: false,
          canRequestReopen: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        }),
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
        ...submittedHistory(sourceSectionId),
      ],
    });
    const fillFromEntry = expectDefined(captured["leadForm.fillFrom"]);
    fillFromEntry.mutationFn.mockResolvedValue({
      success: true,
      copiedItems: 1,
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    const saveDraftEntry = expectDefined(captured["reports.saveDraft"]);
    saveDraftEntry.mutationFn.mockImplementation((input) => {
      serverVersion = 5;
      stageStatus =
        (input as DraftSavePayload).stageStatuses?.[0]?.status ?? null;
      return Promise.resolve(currentServerSection());
    });
    const editableChip = screen
      .getAllByRole("button")
      .find((button) =>
        /^(Planning|Analysis|Design|Development|Testing|DevOps|Support): (On track|No status)/.test(
          button.getAttribute("aria-label") ?? "",
        ),
      );
    act(() => {
      expectDefined(editableChip).click();
    });
    await screen.findByText(/Pending|Saving/i);
    act(() => {
      screen.getByRole("button", { name: "Save draft now" }).click();
    });
    await waitFor(() => expect(saveDraftEntry.mutationFn).toHaveBeenCalled());

    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    act(() => {
      within(documentActions)
        .getByRole("button", {
          name: "Fill from most recent submitted period",
        })
        .click();
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: /^Fill from Week \d+\?$/,
    });
    act(() => {
      within(dialog).getByRole("button", { name: "Replace & fill" }).click();
    });

    await waitFor(() => expect(fillFromEntry.mutationFn).toHaveBeenCalled());
    expect(fillFromEntry.mutationFn.mock.calls.at(0)?.[0]).toEqual({
      targetSectionId: SECTION_ID,
      sourceSectionId,
      version: 5,
    });
  });

  it("renders exactly one shared ReportToolbar container (head-toolbar-parity pin)", async () => {
    // Parity pin: lead form and head shell both render the shared
    // ReportToolbar — the head-side pin lives in head-report-shell.test.tsx.
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    await screen.findByText("Autosaved");

    const toolbar = screen.getByTestId("report-toolbar");
    expect(screen.getAllByTestId("report-toolbar")).toHaveLength(1);
    // One wrapping row keeps both clusters inside the card from 640 to 1023px;
    // the shared toolbar row stops wrapping at md, too early for Slides.
    const [clusterRow, ...otherRows] = Array.from(toolbar.children);
    expect(otherRows).toHaveLength(0);
    expect(clusterRow).toHaveClass(
      "min-w-0",
      "basis-full",
      "flex-wrap",
      "lg:flex-nowrap",
    );
    const mobileRows = Array.from(clusterRow?.children ?? []).filter((child) =>
      child.className.includes("basis-full"),
    );
    expect(mobileRows).toHaveLength(2);
    expect(mobileRows.every((row) => row.className.includes("min-w-0"))).toBe(
      true,
    );
    expect(mobileRows.every((row) => row.className.includes("md:"))).toBe(
      false,
    );
  });

  it("keeps every Lead Slides toolbar target in reading order as clusters reflow", async () => {
    const user = userEvent.setup();
    mockPathname = `/lead/report/${REPORT_ID}`;
    const historyEntry = (
      reportId: string,
      sectionId: string,
      periodStart: string,
      archived = false,
    ) => ({
      sectionId,
      reportId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(
        new Date(periodStart).getTime() + 6 * 24 * 60 * 60 * 1000,
      ),
      reportStatus: "open" as const,
      sectionStatus: "draft" as const,
      submittedAt: null,
      publishedAt: null,
      archived,
    });
    const { Wrapper } = buildHarness({
      myHistory: [
        historyEntry(
          "99999999-9999-4999-8999-999999999991",
          "99999999-9999-4999-8999-999999999981",
          "2026-06-22T00:00:00Z",
        ),
        historyEntry(REPORT_ID, SECTION_ID, "2026-06-15T00:00:00Z"),
        historyEntry(
          "99999999-9999-4999-8999-999999999990",
          "99999999-9999-4999-8999-999999999980",
          "2026-06-08T00:00:00Z",
          true,
        ),
      ],
    });
    render(
      <Wrapper>
        <LeadForm reportId={REPORT_ID} mode="slides" />
      </Wrapper>,
    );

    const toolbar = await screen.findByRole("group", {
      name: "Context controls",
    });
    const orderedTargets = [
      within(toolbar).getByRole("combobox", {
        name: "Select reporting period",
      }),
      within(toolbar).getByRole("button", { name: "Next period" }),
      within(toolbar).getByRole("switch", {
        name: "Show closed (archived) report periods",
      }),
      within(toolbar).getByRole("button", { name: "Mine only" }),
      within(toolbar).getByRole("button", { name: "Everyone" }),
      within(toolbar).getByRole("link", { name: "Report" }),
      within(toolbar).getByRole("link", { name: "Slides" }),
      within(toolbar).getByRole("button", { name: "Document" }),
      within(toolbar).getByRole("button", { name: "Presentation" }),
      within(toolbar).getByRole("button", { name: "Enter fullscreen" }),
    ];
    expect(orderedTargets[1]).toBeEnabled();

    const firstTarget = expectDefined(orderedTargets[0]);
    const lastTarget = expectDefined(orderedTargets.at(-1));
    firstTarget.focus();
    const tabOrder: Element[] = [firstTarget];
    for (let step = 0; step < 20; step += 1) {
      if (document.activeElement === lastTarget) break;
      await user.tab();
      if (document.activeElement !== null)
        tabOrder.push(document.activeElement);
    }

    const targetPositions = orderedTargets.map((target) =>
      tabOrder.indexOf(target),
    );
    expect(targetPositions.every((position) => position >= 0)).toBe(true);
    expect(targetPositions).toEqual(
      [...targetPositions].toSorted((a, b) => a - b),
    );
  });

  it("submitted-section action: Lead sees Request reopen, not Revoke", async () => {
    // Harness role is hard-coded 'Dev Lead', so only the Lead-visible path
    // (Request reopen) renders; Revoke is Head/Admin.
    const { Wrapper } = buildHarness({ sectionStatus: "submitted" });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    expect(
      await screen.findByRole("button", { name: /Request reopen/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Revoke$/i })).toBeNull();
  });

  it("Request reopen is hidden when canRequestReopen is false", async () => {
    // A submitted section on a closed (published/archived) period, or with a
    // request already pending, comes back with canRequestReopen=false. The
    // control must not render — the client never reconstructs the policy.
    const { Wrapper } = buildHarness({
      sectionStatus: "submitted",
      canRequestReopen: false,
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // The toolbar settles, but the Request reopen control stays hidden.
    expect(await screen.findByTestId("report-toolbar")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Request reopen/i }),
    ).toBeNull();
  });

  it("reopen request preserves payload, inline error, success reset, and invalidation", async () => {
    const { Wrapper, captured, queryClient } = buildHarness({
      sectionStatus: "submitted",
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const requestReopenEntry = expectDefined(
      captured["leadForm.requestReopen"],
    );
    requestReopenEntry.mutationFn.mockRejectedValueOnce(
      new Error("Request already pending"),
    );
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    const requestReopenButton = await screen.findByRole("button", {
      name: /Request reopen/i,
    });
    act(() => {
      requestReopenButton.click();
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Request reopen",
    });
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), {
      target: { value: "  Need to add a carry-over  " },
    });
    act(() => {
      within(dialog).getByRole("button", { name: "Send request" }).click();
    });

    await waitFor(() =>
      expect(requestReopenEntry.mutationFn).toHaveBeenCalled(),
    );
    expect(requestReopenEntry.mutationFn.mock.calls.at(0)?.[0]).toEqual({
      reportSectionId: SECTION_ID,
      reason: "Need to add a carry-over",
    });

    expect(
      await screen.findByText("Request already pending"),
    ).toBeInTheDocument();

    requestReopenEntry.mutationFn.mockResolvedValueOnce({ success: true });
    act(() => {
      within(dialog).getByRole("button", { name: "Send request" }).click();
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Reopen request sent to Head"),
    );
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Request reopen" }),
      ).toBeNull(),
    );
    expect(screen.queryByText("Request already pending")).toBeNull();
  });

  it("draft: Submit is a document action and view mode is a context control", async () => {
    // report-toolbar-layout: the forward commit sits in the Document action
    // row; the framing control (view mode) sits in the Context control row.
    // The commit copy is "Submit" (on the lead page a lead sees
    // only their own section, so "Section" added no information).
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await screen.findByText("Autosaved");

    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    const contextControls = screen.getByRole("group", {
      name: "Context controls",
    });
    expect(
      within(documentActions).getByRole("button", { name: "Submit" }),
    ).toBeInTheDocument();
    expect(
      within(documentActions).queryByRole("button", {
        name: /submit section|submit report/i,
      }),
    ).toBeNull();
    expect(
      within(contextControls).getByRole("link", { name: /slides/i }),
    ).toBeInTheDocument();
  });

  it("report-toolbar-layout: keeps creation local to sections", async () => {
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await screen.findByText("Autosaved");

    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    const fillFromButton = within(documentActions).getByRole("button", {
      name: "Fill from most recent submitted period",
    });
    const saveButton = within(documentActions).getByRole("button", {
      name: "Save draft now",
    });
    const submitButton = within(documentActions).getByRole("button", {
      name: "Submit",
    });

    const orderedButtons = within(documentActions).getAllByRole("button");
    const indexOf = (button: HTMLElement) => orderedButtons.indexOf(button);

    expect(indexOf(fillFromButton)).toBeLessThan(indexOf(submitButton));
    expect(indexOf(saveButton)).toBeLessThan(indexOf(submitButton));
    expect(
      within(documentActions).queryByRole("button", { name: "+ Add" }),
    ).toBeNull();
  });

  it("hands completion actions to the sticky bar with no duplicate active set", async () => {
    let notify: IntersectionObserverCallback = (_entries, _observer) =>
      undefined;
    class Observer {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = () => [];
      root = null;
      rootMargin = "0px";
      thresholds = [0];
    }
    vi.stubGlobal("IntersectionObserver", Observer);
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await screen.findByText("Autosaved");

    expect(
      screen.getByRole("group", { name: "Header completion actions" }),
    ).toBeInTheDocument();
    act(() =>
      notify(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(
      screen.queryByRole("group", { name: "Header completion actions" }),
    ).toBeNull();
    const sticky = screen.getByRole("group", {
      name: "Sticky completion actions",
    });
    expect(sticky).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Submit" })).toHaveLength(1);

    act(() => {
      within(sticky).getByRole("button", { name: "Submit" }).click();
    });
    expect(
      await screen.findByRole("alertdialog", { name: "Confirm submission" }),
    ).toBeInTheDocument();
  });

  it("read-only past period hides mutating document actions", async () => {
    // report-toolbar-layout: a read-only past period hides the real mutating
    // document actions while the context row remains.
    const { Wrapper } = buildHarness({ byPeriodReadOnly: true });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await screen.findByText("Read-only");
    expect(screen.queryByText("Autosaved")).toBeNull();
    expect(
      screen.getByText("Read-only report and status context."),
    ).toBeInTheDocument();

    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    expect(screen.queryAllByRole("button", { name: /^Submit$/i })).toHaveLength(
      0,
    );
    expect(
      within(documentActions).queryByRole("button", { name: /fill from/i }),
    ).toBeNull();
    expect(within(documentActions).queryByTestId("save-now-disc")).toBeNull();
    // report-toolbar-layout: + Add is hidden alongside the other mutating
    // document actions on a read-only past period.
    expect(
      within(documentActions).queryByRole("button", { name: "+ Add" }),
    ).toBeNull();
    expect(
      screen.getByRole("group", { name: "Context controls" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("lead-sticky-completion-actions")).toBeNull();
    expect(screen.queryByTestId("lead-submit-readiness")).toBeNull();
  });
});
