import type { MyHistoryEntry } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { LeadForm } from "./lead-form";
import { makeLeadFormSectionFixture } from "./lead-form-test-fixtures";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mutable search-params so a test can target a FOREIGN slides deck via
// `?authorId=`. Hoisted so the vi.mock factory can read it; reset in beforeEach.
const navState = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => navState.searchParams,
  usePathname: () => "/lead/report",
}));

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "44444444-4444-4444-8444-444444444444";
const CO_OWNER_ID = "55555555-5555-4555-8555-555555555555";

// Unique foreign strings so a DOM/cache leak is unambiguous.
const FOREIGN_DECISION_TEXT = "ForeignDecisionXYZ";
const FOREIGN_RISK_TEXT = "ForeignRiskXYZ";
const FOREIGN_ITEM_TEXT = "ForeignItemXYZ";
const CO_OWNER_NAME = "Cohen Owner";

function keyFor(userId: string, reportId: string): string {
  return `leadRecordVisibility:${userId}:${reportId}`;
}

// jsdom in this test environment does not expose window.localStorage; the hook is
// exercised against an in-memory Storage stub (same approach as the hook test).
function installStorageStub(): void {
  const store = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: (i: number) => [...store.keys()][i] ?? null,
    removeItem: (k: string) => {
      store.delete(k);
    },
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
  vi.stubGlobal("localStorage", stub);
  Object.defineProperty(window, "localStorage", {
    value: stub,
    configurable: true,
  });
}

function makeSection() {
  return makeLeadFormSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Shared Product",
        trafficLight: "green" as const,
        ownedStages: [
          {
            stageId: "88888888-8888-4888-8888-888888888888",
            stageName: "Development",
            sortOrder: 3,
          },
        ],
        // Product stage set includes own Development and co-lead Testing so the
        // foreign Testing stage can render as a locked chip in Everyone mode.
        stageSet: [
          {
            stageId: "88888888-8888-4888-8888-888888888888",
            stageName: "Development",
            sortOrder: 3,
          },
          {
            stageId: "99999999-9999-4999-8999-999999999999",
            stageName: "Testing",
            sortOrder: 4,
          },
        ],
      },
    ],
    items: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        projectId: PROJECT_ID,
        type: "current" as const,
        text: "OwnItemABC",
        stageNames: ["Development"],
        tag: "tag",
        workflowStatus: "in_progress" as const,
        carriedOver: false,
      },
    ],
    decisions: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        productId: PROJECT_ID,
        text: "OwnDecisionABC",
        stageNames: ["Development"],
        owner: "Test Lead",
        impact: "Impact",
      },
    ],
  });
}

// Status-only row: co-lead red "Testing" (unassigned for this lead). Health
// folds it in via the always-fetched status read in both toggle states.
const FOREIGN_STAGE = "Testing";
const STATUS_ONLY_ROW = {
  projectId: PROJECT_ID,
  projectName: "Shared Product",
  authorId: CO_OWNER_ID,
  authorInitials: "CO",
  stageNames: [FOREIGN_STAGE],
  stages: [{ stageName: FOREIGN_STAGE, status: "red" as const }],
};

// One full-content row (Everyone read): the co-owner's item/risk/decision text
// + their full name. Mirrors the backend CrossAuthorSectionRow shape consumed
// by the mapForeign* mappers.
const FULL_CONTENT_ROW = {
  authorId: CO_OWNER_ID,
  authorName: CO_OWNER_NAME,
  items: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      projectId: PROJECT_ID,
      type: "current",
      text: FOREIGN_ITEM_TEXT,
      workflowStatus: "in_progress",
      stageNames: [FOREIGN_STAGE],
    },
  ],
  risks: [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      projectId: PROJECT_ID,
      risk: FOREIGN_RISK_TEXT,
      impact: "Foreign impact",
      mitigation: "Foreign mitigation",
      severity: "blocked",
      stageNames: [FOREIGN_STAGE],
    },
  ],
  decisions: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      productId: PROJECT_ID,
      text: FOREIGN_DECISION_TEXT,
      owner: CO_OWNER_NAME,
      impact: "Foreign decision impact",
      deadline: null,
      stageNames: [FOREIGN_STAGE],
    },
  ],
};

interface BuildOpts {
  seedEveryone?: boolean;
  seedHistory?: boolean;
}

function makeHistoryEntry(): MyHistoryEntry {
  return {
    sectionId: SECTION_ID,
    reportId: REPORT_ID,
    periodStart: new Date("2026-08-03T00:00:00.000Z"),
    periodEnd: new Date("2026-08-09T00:00:00.000Z"),
    reportStatus: "draft",
    sectionStatus: "draft",
    archived: false,
    submittedAt: null,
    publishedAt: null,
    itemCount: 1,
    riskCount: 0,
    decisionCount: 1,
    priorityCount: 0,
    productCount: 1,
  };
}

function buildHarness(opts: BuildOpts = {}) {
  // Track every full-content queryFn invocation. This is the positive control
  // for the "no fetch in Mine only" assertion: Everyone must drive it > 0 so an
  // absent count proves the gate, not a broken harness.
  const contentFetch = vi.fn();

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
      query: () => ({ items: opts.seedHistory ? [makeHistoryEntry()] : [] }),
    },
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    {
      path: ["leadForm", "byPeriod"],
      query: () => ({
        section: makeSection(),
        readOnly: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      }),
    },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["leadForm", "assistant"], mutation: true },
    { path: ["leadForm", "resolvePlan"], mutation: true },
    { path: ["leadForm", "restorePlan"], mutation: true },
    { path: ["leadForm", "promotePlan"], mutation: true },
    {
      path: ["ai", "availability"],
      query: { availability: "not_configured" },
    },
    { path: ["leadForm", "crossAuthors"], query: () => [STATUS_ONLY_ROW] },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
    },
    {
      path: ["leadForm", "crossAuthorContent"],
      query: () => {
        contentFetch();
        return [FULL_CONTENT_ROW];
      },
    },
    { path: ["review", "dashboard"] },
    { path: ["archive", "list"] },
    { path: ["weeklyReport", "get"] },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
  ]);

  if (opts.seedEveryone) {
    window.localStorage.setItem(keyFor(AUTHOR_ID, REPORT_ID), "everyone");
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
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
            <LeadReportAssistantStore>{children}</LeadReportAssistantStore>
          </SessionContext.Provider>
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return { Wrapper, captured, queryClient, contentFetch };
}

async function clickEveryone(): Promise<void> {
  const everyone = await screen.findByRole("button", { name: "Everyone" });
  act(() => {
    everyone.click();
  });
}

function clickMineOnly(): void {
  const mine = screen.getByRole("button", { name: "Mine only" });
  act(() => {
    mine.click();
  });
}

beforeEach(() => {
  installStorageStub();
  navState.searchParams = new URLSearchParams();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("LeadForm — Record visibility: Mine only", () => {
  it("issues NO crossAuthorContent fetch and renders no foreign text/name/chip", async () => {
    const { Wrapper, contentFetch } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Settle the query cascade — own content present.
    expect(await screen.findByText("OwnDecisionABC")).toBeInTheDocument();

    // Give any errant conditional fetch a chance to fire before asserting absence.
    await waitFor(() => {
      expect(screen.queryByText("Autosaved")).not.toBeNull();
    });

    // The guarantee is the absent REQUEST, not client-side filtering.
    expect(contentFetch).not.toHaveBeenCalled();
    // No foreign content / full name / foreign chip in the DOM.
    expect(screen.queryByText(FOREIGN_DECISION_TEXT)).toBeNull();
    expect(screen.queryByText(FOREIGN_RISK_TEXT)).toBeNull();
    expect(screen.queryByText(FOREIGN_ITEM_TEXT)).toBeNull();
    expect(screen.queryByText(CO_OWNER_NAME)).toBeNull();
    // Mine shows only own chips; foreign Testing is fully hidden.
    expect(screen.queryByLabelText(/^Testing:/)).toBeNull();
    expect(screen.getByLabelText(/^Development:/)).toBeInTheDocument();
  });
});

describe("LeadForm — Record visibility: Everyone", () => {
  it("renders co-owners' full records (text + full name) read-only alongside own", async () => {
    const { Wrapper, contentFetch } = buildHarness({ seedEveryone: true });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );

    // Foreign content surfaces once the gated read resolves.
    expect(await screen.findByText(FOREIGN_DECISION_TEXT)).toBeInTheDocument();
    expect(screen.getByText(FOREIGN_ITEM_TEXT)).toBeInTheDocument();
    expect(screen.getByText(FOREIGN_RISK_TEXT)).toBeInTheDocument();
    // The owning author's full name renders (full-content read carries it).
    expect(
      screen.getAllByText(new RegExp(CO_OWNER_NAME)).length,
    ).toBeGreaterThan(0);
    // Own records still render alongside the foreign ones.
    expect(screen.getByText("OwnDecisionABC")).toBeInTheDocument();
    // Positive control: the full-content read actually fired.
    expect(contentFetch).toHaveBeenCalled();
  });
});

describe("LeadForm — Record visibility: honest health is toggle-independent", () => {
  // Assert the card's left-edge stripe (blocked token), not section text —
  // the static subtitle already contains "Blocked" and would always match.
  async function productSectionRedSignal(): Promise<boolean> {
    const section = await screen.findByTestId("lead-section-product-status");
    const card = Array.from(section.querySelectorAll(".rounded-xl")).find(
      (el) => (el.getAttribute("style") ?? "").includes("border-left"),
    );
    const style = card?.getAttribute("style") ?? "";
    return (
      style.includes("var(--color-chip-blocked-border)") &&
      !style.includes("var(--color-chip-on-track-border)")
    );
  }

  it("Mine only: foreign chip hidden but health still reflects the foreign red", async () => {
    const { Wrapper, contentFetch } = buildHarness();
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await screen.findByText("OwnDecisionABC");
    expect(await productSectionRedSignal()).toBe(true);
    // Health derives from the always-fetched status read, not the gated content.
    expect(contentFetch).not.toHaveBeenCalled();
    // Foreign "locked" red chip is hidden in Mine only (Testing stays unassigned).
    expect(screen.queryByLabelText(/^Testing: Blocked/)).toBeNull();
  });

  it("Everyone: foreign chip shows and health still reflects the foreign red", async () => {
    const { Wrapper } = buildHarness({ seedEveryone: true });
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    await screen.findByText(FOREIGN_DECISION_TEXT);
    expect(await productSectionRedSignal()).toBe(true);
    // Everyone mode exposes the co-lead's red status on the foreign stage chip.
    expect(screen.getByLabelText(/^Testing: Blocked/)).toBeInTheDocument();
  });
});

describe("LeadForm — Record visibility: view-only submit", () => {
  // Drives Submit → Confirm in a given toggle state and returns the captured
  // submit payload. Foreign records must never reach the payload.
  async function captureSubmitPayload(seedEveryone: boolean): Promise<unknown> {
    const { Wrapper, captured } = buildHarness({ seedEveryone });
    const submit = expectDefined(captured["reports.submit"]);
    // submit resolves the persisted read model; the onSuccess handler reads its
    // `.version`, so give it one (the test asserts on the INPUT payload).
    submit.mutationFn.mockResolvedValue({ version: 2 });
    const { unmount } = render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    if (seedEveryone) {
      await screen.findByText(FOREIGN_DECISION_TEXT);
    } else {
      await screen.findByText("OwnDecisionABC");
    }

    // Open the submit confirm dialog (toolbar button), then confirm inside the
    // dialog. Both buttons read "Submit", so scope the confirm to the dialog
    // to avoid the ambiguous match.
    const headerSubmit = await screen.findByRole("button", {
      name: "Submit",
    });
    act(() => {
      headerSubmit.click();
    });
    const dialog = await screen.findByRole("alertdialog", {
      name: /Confirm submission/i,
    });
    const confirmBtn = within(dialog).getByRole("button", {
      name: "Submit",
    });
    act(() => {
      confirmBtn.click();
    });
    await waitFor(() => expect(submit.calls.length).toBeGreaterThan(0));
    const payload = submit.calls[0];
    unmount();
    return payload;
  }

  it("Everyone: submitted payload carries own records only (no foreign rows)", async () => {
    const payload = (await captureSubmitPayload(true)) as {
      items: { text: string }[];
      risks: { risk: string }[];
      decisions: { text: string }[];
    };
    const allText = JSON.stringify(payload);
    expect(allText).not.toContain(FOREIGN_DECISION_TEXT);
    expect(allText).not.toContain(FOREIGN_RISK_TEXT);
    expect(allText).not.toContain(FOREIGN_ITEM_TEXT);
    expect(allText).toContain("OwnDecisionABC");
  });

  it("submit payload is byte-identical in Mine only vs Everyone", async () => {
    const mine = await captureSubmitPayload(false);
    const everyone = await captureSubmitPayload(true);
    expect(JSON.stringify(everyone)).toBe(JSON.stringify(mine));
  });
});

describe("LeadForm — Record visibility: purge on toggle/identity/report", () => {
  it("Everyone → Mine only purges foreign content; later Everyone re-fetches", async () => {
    const { Wrapper, queryClient, contentFetch } = buildHarness({
      seedEveryone: true,
    });
    const removeSpy = vi.spyOn(queryClient, "removeQueries");
    render(
      <Wrapper>
        <LeadForm />
      </Wrapper>,
    );
    // Everyone: foreign content present and fetched once.
    expect(await screen.findByText(FOREIGN_DECISION_TEXT)).toBeInTheDocument();
    const fetchesWhileEveryone = contentFetch.mock.calls.length;
    expect(fetchesWhileEveryone).toBeGreaterThan(0);

    // Switch to Mine only — the purge effect removes the cached content query.
    clickMineOnly();
    await waitFor(() =>
      expect(screen.queryByText(FOREIGN_DECISION_TEXT)).toBeNull(),
    );
    // Foreign content gone from the DOM (state + cache purged).
    expect(screen.queryByText(FOREIGN_RISK_TEXT)).toBeNull();
    expect(screen.queryByText(FOREIGN_ITEM_TEXT)).toBeNull();
    expect(screen.queryByText(CO_OWNER_NAME)).toBeNull();
    // The purge effect fired removeQueries against the content query key.
    expect(removeSpy).toHaveBeenCalled();

    // Return to Everyone — a re-fetch (not stale serve) brings it back.
    await clickEveryone();
    await waitFor(() =>
      expect(screen.queryByText(FOREIGN_DECISION_TEXT)).not.toBeNull(),
    );
    expect(contentFetch.mock.calls.length).toBeGreaterThan(
      fetchesWhileEveryone,
    );
  });

  it("identity change (role switch) purges cached foreign content", async () => {
    // The identity-guard effect drops ALL cached content on any currentUserId /
    // sessionRole change so user B cannot read user A's foreign records on a
    // shared QueryClient. Re-render the SessionContext with a different role and
    // assert removeQueries fired for the content key.
    const { proxy } = createMockTRPC([
      {
        path: ["reports", "getActive"],
        query: {
          reportId: REPORT_ID,
          reportSectionId: SECTION_ID,
          authorName: "Test Lead",
          authorRole: "lead" as const,
        },
      },
      { path: ["reports", "myHistory"], query: { items: [] } },
      { path: ["reports", "saveDraft"], mutation: true },
      { path: ["reports", "submit"], mutation: true },
      {
        path: ["leadForm", "byPeriod"],
        query: () => ({
          section: makeSection(),
          readOnly: false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        }),
      },
      { path: ["leadForm", "revoke"], mutation: true },
      { path: ["leadForm", "fillFrom"], mutation: true },
      { path: ["leadForm", "requestReopen"], mutation: true },
      { path: ["leadForm", "assistant"], mutation: true },
      { path: ["leadForm", "resolvePlan"], mutation: true },
      { path: ["leadForm", "restorePlan"], mutation: true },
      { path: ["leadForm", "promotePlan"], mutation: true },
      {
        path: ["ai", "availability"],
        query: { availability: "not_configured" },
      },
      { path: ["leadForm", "crossAuthors"], query: () => [STATUS_ONLY_ROW] },
      {
        path: ["leadForm", "viewSettings"],
        query: { unifiedActivityView: false },
      },
      {
        path: ["leadForm", "crossAuthorContent"],
        query: () => [FULL_CONTENT_ROW],
      },
      { path: ["review", "dashboard"] },
      { path: ["archive", "list"] },
      { path: ["weeklyReport", "get"] },
      { path: ["admin", "snapshot"] },
      { path: ["admin", "getSettings"] },
    ]);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const removeSpy = vi.spyOn(queryClient, "removeQueries");

    function Tree({ role }: { role: "lead" | "head" }) {
      return (
        <QueryClientProvider client={queryClient}>
          <TRPCProxyContext.Provider value={proxy}>
            <SessionContext.Provider
              value={{
                user: {
                  id: AUTHOR_ID,
                  name: "Test Lead",
                  email: "lead@example.test",
                  role,
                },
                organization: null,
                isLoading: false,
                isAuthenticated: true,
              }}
            >
              <LeadReportAssistantStore>
                <LeadForm />
              </LeadReportAssistantStore>
            </SessionContext.Provider>
          </TRPCProxyContext.Provider>
        </QueryClientProvider>
      );
    }

    const { rerender } = render(<Tree role="lead" />);
    await screen.findByText("OwnDecisionABC");
    const callsBefore = removeSpy.mock.calls.length;

    // A role change re-runs the identity-guard purge effect.
    rerender(<Tree role="head" />);
    await waitFor(() =>
      expect(removeSpy.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });
});

describe("LeadForm — Record visibility: publish/export independence", () => {
  it("slides reuse the loaded Everyone content without another read", async () => {
    // The form owns the privileged read. Slides receive its settled result;
    // they must not issue a second cross-author query or hide the rows.
    const { Wrapper, contentFetch } = buildHarness({
      seedEveryone: true,
      seedHistory: true,
    });
    render(
      <Wrapper>
        <LeadForm mode="slides" />
      </Wrapper>,
    );
    expect(await screen.findByText(FOREIGN_DECISION_TEXT)).toBeInTheDocument();
    expect(screen.getByText(FOREIGN_ITEM_TEXT)).toBeInTheDocument();
    expect(screen.getByText(FOREIGN_RISK_TEXT)).toBeInTheDocument();
    expect(contentFetch).toHaveBeenCalledTimes(1);
  });

  it("foreign slides deck (?authorId) fires NO crossAuthorContent read even with persisted Everyone", async () => {
    // Foreign authorId slides deck keeps the content read disabled on the
    // toolbar host, regardless of the user's persisted Everyone toggle.
    navState.searchParams = new URLSearchParams(`authorId=${CO_OWNER_ID}`);
    const { Wrapper, contentFetch } = buildHarness({ seedEveryone: true });
    render(
      <Wrapper>
        <LeadForm mode="slides" />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(screen.queryByText(FOREIGN_DECISION_TEXT)).toBeNull();
    });
    expect(contentFetch).not.toHaveBeenCalled();
  });
});
