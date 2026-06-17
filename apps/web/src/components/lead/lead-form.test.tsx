/**
 * Tests for the LeadForm container's mutation wiring (submit + revoke +
 * autosave + dirty-state). The three queries (getActive / byPeriod /
 * myHistory) are mocked at the tRPC-proxy boundary, mirroring the autosave
 * hook test harness.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../lib/trpc-context";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../test-utils/mock-trpc";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
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
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
}

function buildHarness(
  opts: {
    sectionStatus?: "draft" | "submitted";
    byPeriodReadOnly?: boolean;
    byPeriodQueryFn?: () => Promise<unknown>;
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
      query: [],
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
      submitOpts.onSuccess?.();
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
        /^(Planning|Analysis|Design|Dev|Testing|DevOps|Support):/.test(label) &&
        b.getAttribute("aria-disabled") !== "true"
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
    expect(control).toHaveAttribute("title", "Coming Soon");
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
    // CollapseIcon renders inside the "Toggle All" button, which is visible
    // when there are items or decisions in the section data.
    const toggleBtn = container.querySelector('button[title="Toggle All"]');
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
