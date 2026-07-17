/**
 * Characterization pins for the lead-form AUTOSAVE CADENCE (task 1.1) — frozen
 * safety net for the draft-module refactor. Kept in a
 * separate file from the dialog/gating pins because it drives fake timers for
 * the whole suite; mixing fake timers with RTL's `waitFor` in one file
 * deadlocks. Every assertion targets the public `<LeadForm>` surface (rendered
 * DOM + the mocked `reports.saveDraft` mutation seam), so it stays byte-stable
 * while the draft hooks are restructured underneath it.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { LeadForm } from "./lead-form";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../../lib/cache-keys", async (importActual) => ({
  ...(await importActual<typeof import("../../../lib/cache-keys")>()),
  invalidateLeadForm: vi.fn(),
  invalidateDashboard: vi.fn(),
  invalidateLeadHistory: vi.fn(),
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
const STAGE_ID = "88888888-8888-4888-8888-888888888888";

function makeSection() {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead" as const,
    version: 1,
    status: "draft" as const,
    submittedAt: null,
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Test Product",
        trafficLight: "green" as const,
        ownedStages: [
          { stageId: STAGE_ID, stageName: "Development", sortOrder: 3 },
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
    decisions: [],
    priorities: [],
    activities: [],
  };
}

function buildHarness() {
  const { proxy, captured } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: {
        reportId: REPORT_ID,
        reportSectionId: SECTION_ID,
        authorName: "Test Lead",
      },
    },
    { path: ["reports", "myHistory"], query: [] },
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    {
      path: ["leadForm", "byPeriod"],
      query: () => ({
        section: makeSection(),
        readOnly: false,
        canRequestReopen: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      }),
    },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["leadForm", "crossAuthors"], query: [] },
    { path: ["leadForm", "crossAuthorContent"], query: [] },
    { path: ["review", "dashboard"] },
    { path: ["archive", "list"] },
    { path: ["weeklyReport", "get"] },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
  ]);
  expectDefined(captured["reports.saveDraft"]).mutationFn.mockResolvedValue({
    ...makeSection(),
    version: 2,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  return { Wrapper, captured };
}

/** Flushes pending promise microtasks while fake timers are installed. */
async function flush() {
  await act(() => vi.advanceTimersByTimeAsync(0));
}

/** Renders and settles the loaded form ("Autosaved" badge visible). */
async function renderLoaded() {
  const harness = buildHarness();
  render(
    <harness.Wrapper>
      <LeadForm />
    </harness.Wrapper>,
  );
  // Let the query cascade resolve through the mock proxy.
  await flush();
  await flush();
  await flush();
  expect(screen.queryByText("Autosaved")).not.toBeNull();
  return harness;
}

/** Clicks the first editable SDLC stage chip to dirty the draft. */
function clickEditableStageChip() {
  const chip = screen.getAllByRole("button").find((button) => {
    const label = button.getAttribute("aria-label") ?? "";
    return (
      /^Development: (on-track|empty)/.test(label) &&
      button.getAttribute("aria-disabled") !== "true"
    );
  });
  if (!chip) throw new Error("no editable stage chip rendered");
  act(() => chip.click());
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("lead-form draft: autosave cadence (1.1)", () => {
  it("issues no save while the freshly loaded draft is clean", async () => {
    const { captured } = await renderLoaded();
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(
      expectDefined(captured["reports.saveDraft"]).mutationFn,
    ).not.toHaveBeenCalled();
  });

  it("debounces a dirty edit, then fires exactly one save after the window", async () => {
    const { captured } = await renderLoaded();

    clickEditableStageChip();
    // Before the 5s debounce elapses no save is issued.
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(
      expectDefined(captured["reports.saveDraft"]).mutationFn,
    ).not.toHaveBeenCalled();
    // After the full window exactly one save fires.
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(
      expectDefined(captured["reports.saveDraft"]).mutationFn,
    ).toHaveBeenCalledTimes(1);
  });

  it("Save now flushes immediately, before the debounce elapses", async () => {
    const { captured } = await renderLoaded();

    clickEditableStageChip();
    await flush();
    const saveButton = screen
      .getAllByRole("button")
      .find((b) => /Save draft now/i.test(b.getAttribute("aria-label") ?? ""));
    if (!saveButton) throw new Error("no Save-now button rendered");
    act(() => saveButton.click());
    await flush();
    expect(
      expectDefined(captured["reports.saveDraft"]).mutationFn,
    ).toHaveBeenCalledTimes(1);
  });
});
