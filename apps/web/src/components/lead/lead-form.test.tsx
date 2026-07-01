/**
 * Tests for the LeadForm container's mutation wiring (submit + revoke +
 * autosave + dirty-state). The three queries (getActive / byPeriod /
 * myHistory) are mocked at the tRPC-proxy boundary, mirroring the autosave
 * hook test harness.
 */

import type { ReportSectionReadModel } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../lib/trpc-context";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../test-utils/mock-trpc";
import { LeadForm, sectionToDraftPayload } from "./lead-form";

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
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Test Product",
        trafficLight: "green" as const,
        // 35-04: at least one owned stage so the SDLC pipeline renders
        // an editable chip — the dirty-flag test clicks it to fire
        // handleProductsChange.
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
  } = {},
) {
  const { proxy, captured } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: {
        reportId: REPORT_ID,
        reportSectionId: SECTION_ID,
        authorName: "Test Lead",
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
          section: makeSection({ status: opts.sectionStatus }),
          readOnly: opts.byPeriodReadOnly ?? false,
          // reopen-request-lifecycle (D4): the server-computed flag. Defaults to
          // true for a submitted section so the existing Request-Reopen test
          // keeps its precondition; tests override it to assert the hidden case.
          canRequestReopen:
            opts.canRequestReopen ?? opts.sectionStatus === "submitted",
        })),
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
  vi.clearAllMocks();
  mockPathname = "/lead/report";
});

describe("LeadForm mutation wiring", () => {
  it("submit success: invalidates caches, fires toast.success, locks form", async () => {
    const { Wrapper, captured, queryClient } = buildHarness();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Wait for the component to mount its mutation hook — the factory records
    // the caller-passed options (onSuccess/onError) in lastOptions.
    await waitFor(() =>
      expect(
        Object.keys(captured["reports.submit"].lastOptions).length,
      ).toBeGreaterThan(0),
    );

    // Retrieve the onSuccess/onError callbacks captured when the component
    // mounted its mutation hook.
    const submitOpts = captured["reports.submit"]
      .lastOptions as MutationCallbacks;

    // onSuccess from the submit mutation fires invalidations + toast.
    // Trigger onSuccess deterministically — the mutation wiring is the unit
    // under test (the orchestration of invalidation + toast + lock).
    act(() => {
      // submit returns the persisted read model (carries the bumped version).
      submitOpts.onSuccess?.(makeSection());
    });
    expect(toast.success).toHaveBeenCalledWith("Report submitted");
    // invalidateLeadForm + invalidateLeadHistory each call invalidateQueries.
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("submit error: fires toast.error with the error message", async () => {
    const { Wrapper, captured } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(captured["reports.submit"].lastOptions).toBeDefined(),
    );

    const submitOpts = captured["reports.submit"]
      .lastOptions as MutationCallbacks;
    // Simulate error path.
    submitOpts.onError?.(new Error("Submit blew up"));
    expect(toast.error).toHaveBeenCalledWith("Submit blew up");
  });

  it("submit CONFLICT (stale version): surfaces the reload prompt, not the generic error", async () => {
    const { Wrapper, captured } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(captured["reports.submit"].lastOptions).toBeDefined(),
    );

    const conflict = new TRPCClientError("stale");
    Object.defineProperty(conflict, "data", {
      value: { httpStatus: 409, code: "CONFLICT" },
      configurable: true,
    });

    const submitOpts = captured["reports.submit"]
      .lastOptions as MutationCallbacks;
    submitOpts.onError?.(conflict);

    // Guardrail 5: a cross-writer conflict refetches + surfaces a distinct
    // reload prompt rather than echoing the raw error message.
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("changed elsewhere"),
    );
    expect(toast.error).not.toHaveBeenCalledWith("stale");
  });

  it("submit after an autosave version bump carries the bumped version, not a stale closure (guardrail 3)", async () => {
    const { Wrapper, captured } = buildHarness();
    // The success path reads `.version`; resolve a versioned read model so it
    // does not throw. The assertion targets the submit INPUT, not this value.
    captured["reports.submit"].mutationFn.mockResolvedValue({
      ...makeSection(),
      version: 6,
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();
    await waitFor(() =>
      expect(captured["reports.saveDraft"].lastOptions).toBeDefined(),
    );

    // An autosave succeeds and the server bumps the row to version 5. This
    // drives the component's version forward through the hook's onVersionChange
    // exactly as a live save would.
    const saveDraftOpts = captured["reports.saveDraft"].lastOptions as {
      onSuccess?: (saved: unknown) => void;
    };
    act(() => {
      saveDraftOpts.onSuccess?.({ version: 5 });
    });

    // Drive a real submit: toolbar Submit → confirm dialog → confirm.
    act(() => {
      screen.getByRole("button", { name: "Submit" }).click();
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Confirm submission",
    });
    act(() => {
      within(dialog).getByRole("button", { name: "Submit" }).click();
    });

    // Guardrail 3: submit reads the CURRENT version (5) synchronously, not the
    // initially-loaded 1 captured in a stale closure.
    await waitFor(() =>
      expect(
        captured["reports.submit"].mutationFn.mock.calls.length,
      ).toBeGreaterThan(0),
    );
    const sent = captured["reports.submit"].mutationFn.mock.calls.at(
      -1,
    )?.[0] as {
      version?: number;
    };
    expect(sent.version).toBe(5);
  });

  it("a refetch updates the held version without dirtying the form, and the new version reaches the next write (guardrail 4)", async () => {
    let serverVersion = 1;
    const { Wrapper, captured, queryClient } = buildHarness({
      byPeriodQueryFn: () =>
        Promise.resolve({
          section: { ...makeSection(), version: serverVersion },
          readOnly: false,
          canRequestReopen: false,
        }),
    });
    captured["reports.submit"].mutationFn.mockResolvedValue({
      ...makeSection(),
      version: 6,
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    // A concurrent writer advances only the revision; a refetch brings version
    // 5 with identical content. `await act(invalidate)` flushes the refetch AND
    // the re-seed effect, so the held version is deterministically 5 here.
    serverVersion = 5;
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    // Version is not part of the dirty key → the form stays clean (no spurious
    // autosave from the bump).
    expect(screen.getByText("Autosaved")).toBeInTheDocument();

    // And the re-seeded version actually advanced: the next write carries 5,
    // not the initially-loaded 1 — without this, conflict recovery would 409 in
    // a loop.
    act(() => {
      screen.getByRole("button", { name: "Submit" }).click();
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Confirm submission",
    });
    act(() => {
      within(dialog).getByRole("button", { name: "Submit" }).click();
    });
    await waitFor(() =>
      expect(
        captured["reports.submit"].mutationFn.mock.calls.length,
      ).toBeGreaterThan(0),
    );
    const sent = captured["reports.submit"].mutationFn.mock.calls.at(
      -1,
    )?.[0] as {
      version?: number;
    };
    expect(sent.version).toBe(5);
  });

  it("byPeriod load failure: toast shows prefix + requestId reference", async () => {
    // Build a TRPCClientError with data.requestId so formatClientErrorMessage
    // appends "Reference: req-X." — this is the behavior-changing part of task 4.
    const err = new TRPCClientError("INTERNAL_SERVER_ERROR");
    Object.defineProperty(err, "data", {
      value: {
        httpStatus: 500,
        code: "INTERNAL_SERVER_ERROR",
        requestId: "req-X",
      },
      configurable: true,
    });

    const { Wrapper } = buildHarness({
      byPeriodQueryFn: () => Promise.reject(err),
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to load form. Reference: req-X.",
      ),
    );
  });

  it("changing a stage status marks the form dirty (autosave indicator changes from Autosaved)", async () => {
    // Originally this test edited a decision row's inline input. After the
    // modal-driven CRUD refactor, decisions are read-only cards opened via
    // a pencil — there's no longer a textbox in the section to drive
    // directly. The dirty-flag path is the same one the user takes when
    // clicking a stage chip and picking a status, so the test now drives
    // that flow instead. Same wiring being tested (handleProductsChange →
    // autosave 'pending'), different entry point.
    const { Wrapper } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // findByText is act-wrapped by RTL — waits for the query cascade to settle.
    expect(await screen.findByText("Autosaved")).toBeInTheDocument();

    // Click an editable stage chip to open the popover menu.
    const editableChip = screen.getAllByRole("button").find((b) => {
      const label = b.getAttribute("aria-label") ?? "";
      return (
        /^(Planning|Analysis|Design|Development|Testing|DevOps|Support):/.test(
          label,
        ) && b.getAttribute("aria-disabled") !== "true"
      );
    }) as HTMLButtonElement | undefined;
    expect(editableChip).toBeDefined();
    act(() => {
      expectDefined(editableChip).click();
    });
    // Wait for the popover menu to appear before querying its items.
    await waitFor(() =>
      expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0),
    );

    // Pick a different status from the menu — fires onStatusChange and
    // dirties the draft.
    const menuitem = screen.getAllByRole("menuitem").find((m) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- DOM textContent is nullable; defensive default in a test helper
      const label = m.textContent ?? "";
      return (
        /On Track|At Risk|Blocked|Clear/i.test(label) &&
        !label.includes("current")
      );
    });
    expect(menuitem).toBeDefined();
    act(() => {
      expectDefined(menuitem).click();
    });

    // Wait for the dirty indicator to replace "Autosaved".
    await waitFor(() =>
      expect(screen.queryByText(/Pending|Saving/i)).not.toBeNull(),
    );

    expect(screen.queryByText("Autosaved")).toBeNull();
    expect(screen.queryByText(/Pending|Saving/i)).not.toBeNull();
  });

  it("fillFrom success: invalidates leadForm, fires toast.success", async () => {
    const { Wrapper, captured, queryClient } = buildHarness();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(captured["leadForm.fillFrom"].lastOptions).toBeDefined(),
    );

    const fillFromOpts = captured["leadForm.fillFrom"]
      .lastOptions as MutationCallbacks;
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
    await waitFor(() =>
      expect(captured["leadForm.fillFrom"].lastOptions).toBeDefined(),
    );

    const conflict = new TRPCClientError("stale");
    Object.defineProperty(conflict, "data", {
      value: { httpStatus: 409, code: "CONFLICT" },
      configurable: true,
    });

    const fillFromOpts = captured["leadForm.fillFrom"]
      .lastOptions as MutationCallbacks;
    act(() => {
      fillFromOpts.onError?.(conflict);
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("changed elsewhere"),
    );
  });

  it("toolbar renders the inert version-history ComingSoon control", async () => {
    // defer-versions-coming-soon: the version-history UI is removed; the
    // toolbar slot carries a disabled ComingSoon control instead.
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
    // The mapper hard-codes currentUser.role to 'Dev Lead' for now (the
    // read model doesn't yet carry display role), so every harness-driven
    // render takes the Lead branch of lead-form.tsx — Request Reopen,
    // never Revoke. The Revoke wiring flows through the same revokeMut
    // hook that this used to test, but the button that fires it only
    // renders when role doesn't end in "Lead". Until the harness gains a
    // role-override (or the mapper stops hard-coding), we assert the
    // Lead-visible path: submitted section → Request Reopen surfaces.
    const { Wrapper } = buildHarness({ sectionStatus: "submitted" });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Request Reopen renders for Leads on submitted sections — Revoke is
    // the Head/Admin-side variant.
    expect(
      await screen.findByRole("button", { name: /Request Reopen/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Revoke$/i })).toBeNull();
  });

  it("reopen-request-lifecycle: Request Reopen is hidden when canRequestReopen is false", async () => {
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
    // Framing controls live in the context row.
    expect(
      within(contextControls).getByRole("link", { name: /slides/i }),
    ).toBeInTheDocument();
    expect(
      within(contextControls).getByTestId("agent-review-coming-soon"),
    ).toBeInTheDocument();
  });

  it("read-only past period: hides Save/Submit/Fill-From but keeps the inert Coming-soon stubs", async () => {
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
    // Real mutating actions are hidden.
    expect(
      within(documentActions).queryByRole("button", {
        name: /submit section/i,
      }),
    ).toBeNull();
    expect(
      within(documentActions).queryByRole("button", { name: /fill from/i }),
    ).toBeNull();
    expect(within(documentActions).queryByTestId("save-now-disc")).toBeNull();
    // Inert Coming-soon stubs remain visible.
    expect(
      within(documentActions).getByTestId("version-coming-soon"),
    ).toBeInTheDocument();
    expect(
      within(documentActions).getByTestId("lead-pdf-export-coming-soon"),
    ).toBeInTheDocument();
    // The context control row is still present.
    expect(
      screen.getByRole("group", { name: "Context controls" }),
    ).toBeInTheDocument();
  });
});

// VA-0a: icon SVG aria-hidden regression — verify-a11y-recommended-flip catalog
describe("LeadForm icon SVGs — aria-hidden", () => {
  // Renders LeadForm and waits for the query cascade to settle.
  // findByText is act-wrapped by RTL — no manual flush needed.
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

  it("GridIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const section = container.querySelector(
      '[data-testid="lead-section-product-status"]',
    );
    expect(section).not.toBeNull();
    const svg = section?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("CalendarIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const section = container.querySelector(
      '[data-testid="lead-section-current-week"]',
    );
    expect(section).not.toBeNull();
    const svg = section?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("NextWeekIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const section = container.querySelector(
      '[data-testid="lead-section-next-week"]',
    );
    expect(section).not.toBeNull();
    const svg = section?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("AlertIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const section = container.querySelector(
      '[data-testid="lead-section-risks"]',
    );
    expect(section).not.toBeNull();
    const svg = section?.querySelector("svg[aria-hidden='true']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("ChatIcon svg has aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const section = container.querySelector(
      '[data-testid="lead-section-decisions"]',
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

  // VA-0b snapshot: all icon SVGs in the rendered form carry aria-hidden=true
  it("snapshot: all icon SVGs rendered in LeadForm have aria-hidden=true", async () => {
    const container = await renderAndSettle();
    const allSvgs = Array.from(container.querySelectorAll("svg"));
    // At minimum the 6 icon SVGs (Grid, Calendar, NextWeek, Alert, Chat,
    // Collapse) must be present; each must carry aria-hidden="true".
    const iconSvgs = allSvgs.filter(
      (svg) => svg.getAttribute("aria-hidden") === "true",
    );
    expect(iconSvgs.length).toBeGreaterThanOrEqual(6);
    for (const svg of iconSvgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });
});

// slide-mode-collapse-fullscreen-control: the lead context bar's trailing
// utility is ONE mode-adaptive icon-only slot — collapse-all in edit,
// fullscreen in slides — always reserved, never an inert "Toggle All".
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

  it("edit mode with an empty report: the collapse control is reserved but disabled", async () => {
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
            items: [],
            risks: [],
            decisions: [],
            priorities: [],
          },
          readOnly: false,
        }),
    });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // The slot is rendered (not removed) even with nothing to collapse...
    const collapseBtn = await screen.findByRole("button", {
      name: "Collapse all sections",
    });
    // ...and disabled because there is nothing to collapse, so adding a
    // section in-session enables it in place without shifting the row.
    expect(collapseBtn).toBeDisabled();
  });

  it("slides mode: the trailing slot shows the fullscreen toggle, not a collapse/Toggle-All control", async () => {
    // Drive the addressed route + matching history so LeadSlidesClient
    // resolves inReportMode=true and actually renders its populated deck.
    // That is the path where its own (`!inReportMode`) fullscreen button is
    // suppressed — so the toHaveLength(1) assertion genuinely guards the
    // "no separate slides-only fullscreen control" spec invariant: if that
    // guard regressed, the deck would mount a second fullscreen button here.
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
});

describe("sectionToDraftPayload — durable stableId round-trip", () => {
  // Make-or-break for introduce-durable-record-identity: the save payload must
  // carry each existing record's stableId so saveSection preserves identity
  // instead of re-minting it every write. A brand-new row has none yet (the
  // server mints it), which must serialize as an absent/undefined key, not fail.
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
    const base = makeSection() as unknown as ReportSectionReadModel;
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
        },
      ],
    };
    const payload = sectionToDraftPayload(withNewItem);
    expect(expectDefined(payload.items[0]).stableId).toBeUndefined();
  });
});
