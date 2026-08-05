import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
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
    risks: [],
    decisions: [
      {
        id: "66666666-6666-6666-6666-666666666666",
        stableId: "6a6a6a6a-6a6a-4a6a-8a6a-6a6a6a6a6a6a",
        text: "Existing decision",
        owner: "Owner",
        impact: "Impact",
      },
    ],
    priorities: [
      {
        id: "77777777-7777-7777-7777-777777777777",
        rank: 1,
        text: "Priority text",
      },
    ],
    activities: [],
  };
}

interface MutationCallbacks {
  onSuccess?: (saved?: unknown) => void;
  onError?: (err: unknown) => void;
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
      query: opts.myHistory ?? [],
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
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
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
    const { Wrapper, captured, queryClient } = buildHarness();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    const fillFromEntry = expectDefined(captured["leadForm.fillFrom"]);
    await waitFor(() => expect(fillFromEntry.lastOptions).toBeDefined());

    const fillFromOpts = fillFromEntry.lastOptions as MutationCallbacks;
    act(() => {
      fillFromOpts.onSuccess?.();
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Form filled from selected period",
    );
    // invalidateLeadForm covers reports.getActive + leadForm.byPeriod.
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("fillFrom CONFLICT (stale target version): surfaces the reload prompt", async () => {
    const { Wrapper, captured } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    const fillFromEntry = expectDefined(captured["leadForm.fillFrom"]);
    await waitFor(() => expect(fillFromEntry.lastOptions).toBeDefined());

    const conflict = new TRPCClientError("stale");
    Object.defineProperty(conflict, "data", {
      value: { httpStatus: 409, code: "CONFLICT" },
      configurable: true,
    });

    const fillFromOpts = fillFromEntry.lastOptions as MutationCallbacks;
    act(() => {
      fillFromOpts.onError?.(conflict);
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("changed elsewhere"),
      ),
    );
  });

  it("fillFrom sends the current target version after an autosave bump", async () => {
    const sourceSectionId = "99999999-9999-4999-8999-999999999999";
    const { Wrapper, captured } = buildHarness({
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

    const saveDraftOpts = expectDefined(captured["reports.saveDraft"])
      .lastOptions as {
      onSuccess?: (saved: unknown) => void;
    };
    act(() => {
      saveDraftOpts.onSuccess?.({ version: 5 });
    });

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
      within(dialog).getByRole("button", { name: "Replace & Fill" }).click();
    });

    await waitFor(() => expect(fillFromEntry.mutationFn).toHaveBeenCalled());
    expect(fillFromEntry.mutationFn.mock.calls.at(0)?.[0]).toEqual({
      targetSectionId: SECTION_ID,
      sourceSectionId,
      version: 5,
    });
  });

  it("toolbar renders the inert version-history ComingSoon control", async () => {
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    await screen.findByText("Autosaved");

    const control = screen.getByTestId("version-coming-soon");
    expect(control).toHaveAttribute(
      "aria-label",
      "Version history is coming soon",
    );
    expect(control).toHaveAttribute("aria-disabled", "true");
    // No native title — aria-label + the amber ComingSoonBadge cover the name
    // and the visual tooltip; a stacked title="Coming Soon" double-tooltips.
    expect(control).not.toHaveAttribute("title");
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

    expect(screen.getAllByTestId("report-toolbar")).toHaveLength(1);
  });

  it("submitted-section action: Lead sees Request Reopen, not Revoke", async () => {
    // Harness role is hard-coded 'Dev Lead', so only the Lead-visible path
    // (Request Reopen) renders; Revoke is Head/Admin.
    const { Wrapper } = buildHarness({ sectionStatus: "submitted" });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    expect(
      await screen.findByRole("button", { name: /Request Reopen/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Revoke$/i })).toBeNull();
  });

  it("Request Reopen is hidden when canRequestReopen is false", async () => {
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

    // The toolbar settles, but the Request Reopen control stays hidden.
    expect(await screen.findByTestId("report-toolbar")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Request Reopen/i }),
    ).toBeNull();
  });

  it("reopen request preserves payload, inline error, success reset, and invalidation", async () => {
    const { Wrapper, captured, queryClient } = buildHarness({
      sectionStatus: "submitted",
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const pendingReopen = new Promise<never>(() => undefined);
    const requestReopenEntry = expectDefined(
      captured["leadForm.requestReopen"],
    );
    requestReopenEntry.mutationFn.mockReturnValue(pendingReopen);
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    const requestReopenButton = await screen.findByRole("button", {
      name: /Request Reopen/i,
    });
    act(() => {
      requestReopenButton.click();
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Request Reopen dialog",
    });
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), {
      target: { value: "  Need to add a carry-over  " },
    });
    act(() => {
      within(dialog).getByRole("button", { name: "Send Request" }).click();
    });

    await waitFor(() =>
      expect(requestReopenEntry.mutationFn).toHaveBeenCalled(),
    );
    expect(requestReopenEntry.mutationFn.mock.calls.at(0)?.[0]).toEqual({
      reportSectionId: SECTION_ID,
      reason: "Need to add a carry-over",
    });

    const reopenOpts = requestReopenEntry.lastOptions as MutationCallbacks;
    act(() => {
      reopenOpts.onError?.(new Error("Request already pending"));
    });
    expect(screen.getByText("Request already pending")).toBeInTheDocument();

    act(() => {
      reopenOpts.onSuccess?.();
    });
    expect(toast.success).toHaveBeenCalledWith("Reopen request sent to Head");
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Request Reopen dialog" }),
      ).toBeNull(),
    );
    expect(screen.queryByText("Request already pending")).toBeNull();
  });

  it("revoke success preserves invalidations and success toast", async () => {
    const { Wrapper, captured, queryClient } = buildHarness({
      sectionStatus: "submitted",
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    const revokeEntry = expectDefined(captured["leadForm.revoke"]);
    await waitFor(() => expect(revokeEntry.lastOptions).toBeDefined());

    const revokeOpts = revokeEntry.lastOptions as MutationCallbacks;
    act(() => {
      revokeOpts.onSuccess?.();
    });

    expect(toast.success).toHaveBeenCalledWith("Section unlocked");
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("draft: Submit is a document action; view mode + agent review are context controls", async () => {
    // report-toolbar-layout: the forward commit sits in the Document action
    // row; the framing controls (view mode, agent review) sit in the Context
    // control row. The commit copy is "Submit" (on the lead page a lead sees
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
    // The inert document-action stubs reserve their top-row slot.
    expect(
      within(documentActions).getByTestId("version-coming-soon"),
    ).toBeInTheDocument();
    expect(
      within(documentActions).getByTestId("lead-pdf-export-coming-soon"),
    ).toBeInTheDocument();
    expect(
      within(contextControls).getByRole("link", { name: /slides/i }),
    ).toBeInTheDocument();
    expect(
      within(contextControls).getByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();
  });

  it("report-toolbar-layout: + Add renders after Save and Fill-From, immediately before Submit", async () => {
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
    const quickAddButton = within(documentActions).getByRole("button", {
      name: "+ Add",
    });
    const submitButton = within(documentActions).getByRole("button", {
      name: "Submit",
    });

    const orderedButtons = within(documentActions).getAllByRole("button");
    const indexOf = (button: HTMLElement) => orderedButtons.indexOf(button);

    expect(indexOf(fillFromButton)).toBeLessThan(indexOf(quickAddButton));
    expect(indexOf(saveButton)).toBeLessThan(indexOf(quickAddButton));
    expect(indexOf(quickAddButton)).toBeLessThan(indexOf(submitButton));

    // Neutral/outline treatment: "+ Add" never carries the resting solid
    // brand-accent fill reserved for Submit.
    expect(quickAddButton.className).toContain("bg-transparent");
    expect(quickAddButton.className).not.toContain(
      "bg-[var(--color-starbucks-accent)]",
    );
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

  it("read-only past period: hides Save/Submit/Fill-From/+ Add but keeps the inert Coming-soon stubs", async () => {
    // report-toolbar-layout: a read-only past period hides the real mutating
    // document actions, while the deferred-feature inert stubs stay visible
    // (deferred-feature-pattern) and the context row remains.
    const { Wrapper } = buildHarness({ byPeriodReadOnly: true });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await screen.findByText("Autosaved");

    const documentActions = screen.getByRole("group", {
      name: "Document actions",
    });
    expect(
      within(documentActions).queryByRole("button", {
        name: /submit section/i,
      }),
    ).toBeNull();
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
      within(documentActions).getByTestId("version-coming-soon"),
    ).toBeInTheDocument();
    expect(
      within(documentActions).getByTestId("lead-pdf-export-coming-soon"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Context controls" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("lead-sticky-completion-actions")).toBeNull();
    expect(screen.queryByTestId("lead-submit-readiness")).toBeNull();
  });
});
