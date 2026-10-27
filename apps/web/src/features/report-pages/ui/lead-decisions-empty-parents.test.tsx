// The Lead form's own "+ Add decision" stays enabled when the section has no
// assigned products and no attached activities (the sibling item/risk Add
// controls disable themselves with a "no record parents" title). Create mode
// then has an unresolved parent and no owned stages, so the stage dead end
// must stay readable instead of interpolating an empty product name.
// Drives the public Lead form rather than the dialog props: the reported
// defect is the notice the lead sees after that click.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { ProjectFixture } from "../../../test-utils/report-section-fixtures";
import { LeadForm } from "./lead/shell/lead-form";
import { makeLeadFormSectionFixture } from "./lead/shell/lead-form-test-fixtures";
import { LeadReportAssistantStore } from "./lead-report-assistant-store";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/lead/report",
}));

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "44444444-4444-4444-8444-444444444444";

function sectionFixture(projects: readonly ProjectFixture[]) {
  return makeLeadFormSectionFixture({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    version: 1,
    status: "draft",
    projects,
  });
}

// An assigned product with no owned stages reaches the same dead end WITH a
// resolvable name, so the notice keeps naming it.
const unstagedProduct = {
  projectId: PROJECT_ID,
  projectName: "Test Product",
  trafficLight: "green" as const,
  ownedStages: [],
  stageSet: [],
};

function buildHarness(section: ReturnType<typeof sectionFixture>) {
  const { proxy } = createMockTRPC([
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
      query: { items: [] },
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
      query: () => ({
        section,
        readOnly: false,
        canRequestReopen: false,
        publishedLineage: { itemStableIds: [], decisionStableIds: [] },
      }),
    },
    {
      path: ["leadForm", "viewSettings"],
      query: { unifiedActivityView: false },
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

  return { Wrapper };
}

async function openDecisionCreate(section: ReturnType<typeof sectionFixture>) {
  const { Wrapper } = buildHarness(section);
  render(
    <Wrapper>
      <LeadForm />
    </Wrapper>,
  );

  const addDecision = await screen.findByRole("button", {
    name: "+ Add decision",
  });
  act(() => addDecision.click());

  return screen.findByRole("dialog", { name: "Add decision" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Lead form decisions — no resolvable parent", () => {
  it("keeps the dead-end notice readable without an empty product name", async () => {
    const dialog = await openDecisionCreate(sectionFixture([]));

    expect(
      within(dialog).getByText(/^No stages assigned — contact admin\.$/),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/on\s{2,}—/)).not.toBeInTheDocument();
    // Expected context: no parent can be chosen and Save stays blocked.
    expect(
      within(dialog).getByRole("combobox", { name: "Product" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Save decision" }),
    ).toBeDisabled();
  });

  it("keeps naming the product when the parent resolves", async () => {
    const dialog = await openDecisionCreate(sectionFixture([unstagedProduct]));

    expect(
      within(dialog).getByText(
        /^No stages assigned on Test Product — contact admin\.$/,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Save decision" }),
    ).toBeDisabled();
  });
});
