import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../../test-utils/mock-trpc";
import { LeadReportAssistantStore } from "../../lead-report-assistant-store";
import { LeadForm } from "./lead-form";
import { makeLeadFormSectionFixture } from "./lead-form-test-fixtures";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const replace = vi.fn();
const push = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/lead/report",
}));

const ACTIVE_REPORT_ID = "11111111-1111-4111-8111-111111111111";
const ACTIVE_SECTION_ID = "22222222-2222-4222-8222-222222222222";
const PAST_REPORT_ID = "33333333-3333-4333-8333-333333333333";
const PAST_SECTION_ID = "44444444-4444-4444-8444-444444444444";
const PROJECT_ID = "55555555-5555-4555-8555-555555555555";
const AUTHOR_ID = "66666666-6666-4666-8666-666666666666";

function makeSection(
  opts: {
    reportSectionId?: string;
    reportId?: string;
    status?: "draft" | "submitted";
  } = {},
) {
  return makeLeadFormSectionFixture({
    reportSectionId: opts.reportSectionId ?? ACTIVE_SECTION_ID,
    reportId: opts.reportId ?? ACTIVE_REPORT_ID,
    authorId: AUTHOR_ID,
    status: opts.status ?? ("draft" as const),
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Test Product",
        trafficLight: "green" as const,
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
  });
}

function buildHarness(opts: {
  byPeriodSection?: ReturnType<typeof makeSection>;
  byPeriodReadOnly?: boolean;
  onByPeriodQuery?: () => void;
}) {
  const { proxy } = createMockTRPC([
    {
      path: ["ai", "availability"],
      query: { availability: "not_configured" },
    },
    {
      path: ["reports", "getActive"],
      query: {
        reportId: ACTIVE_REPORT_ID,
        reportSectionId: ACTIVE_SECTION_ID,
        authorName: "Test Lead",
        authorRole: "lead" as const,
      },
    },
    {
      path: ["reports", "myHistory"],
      query: {
        items: [
          {
            sectionId: ACTIVE_SECTION_ID,
            reportId: ACTIVE_REPORT_ID,
            periodStart: new Date("2026-04-14T00:00:00Z"),
            periodEnd: new Date("2026-04-20T00:00:00Z"),
            reportStatus: "open",
            sectionStatus: "draft",
            submittedAt: null,
            publishedAt: null,
          },
          {
            sectionId: PAST_SECTION_ID,
            reportId: PAST_REPORT_ID,
            periodStart: new Date("2026-04-07T00:00:00Z"),
            periodEnd: new Date("2026-04-13T00:00:00Z"),
            reportStatus: "published",
            sectionStatus: "submitted",
            submittedAt: new Date("2026-04-13T20:00:00Z"),
            publishedAt: new Date("2026-04-14T08:00:00Z"),
          },
        ],
      },
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
      query: () => {
        opts.onByPeriodQuery?.();
        return {
          section: opts.byPeriodSection ?? makeSection(),
          readOnly: opts.byPeriodReadOnly ?? false,
          publishedLineage: { itemStableIds: [], decisionStableIds: [] },
        };
      },
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
  ]);

  return proxy;
}

function Wrapper({
  children,
  proxy,
}: {
  readonly children: ReactNode;
  readonly proxy: ReturnType<typeof buildHarness>;
}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <TRPCProxyContext.Provider value={proxy}>
        <SessionContext.Provider
          value={{
            user: {
              id: "test-lead",
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

describe("LeadForm — addressable URLs", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    document.title = "";
  });

  it("bare editor + redirectToCanonical preserves explicit edit mode", async () => {
    const proxy = buildHarness({});
    render(
      <Wrapper proxy={proxy}>
        <LeadForm redirectToCanonical />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/lead/report/${ACTIVE_REPORT_ID}?mode=edit`,
      ),
    );
  });

  it("preserves authorId while resolving the bare route", async () => {
    mockSearchParams = new URLSearchParams({ authorId: "author_9" });
    const proxy = buildHarness({});
    render(
      <Wrapper proxy={proxy}>
        <LeadForm redirectToCanonical />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/lead/report/${ACTIVE_REPORT_ID}?authorId=author_9&mode=edit`,
      ),
    );
  });

  it("preserves a feedback deep link while resolving the bare route", async () => {
    mockSearchParams = new URLSearchParams({
      feedback: "feedback_123",
      feedbackUrl: "/lead/report",
      agentationSession: "session_123",
      agentationAnnotation: "annotation_123",
    });
    const proxy = buildHarness({});
    render(
      <Wrapper proxy={proxy}>
        <LeadForm redirectToCanonical />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        `/lead/report/${ACTIVE_REPORT_ID}?feedback=feedback_123&feedbackUrl=%2Flead%2Freport&agentationSession=session_123&agentationAnnotation=annotation_123&mode=edit`,
      ),
    );
  });

  it("addressed route (reportId prop set) → no redirect, just renders the form", async () => {
    const proxy = buildHarness({
      byPeriodSection: makeSection({
        reportSectionId: PAST_SECTION_ID,
        reportId: PAST_REPORT_ID,
        status: "submitted",
      }),
      byPeriodReadOnly: true,
    });
    render(
      <Wrapper proxy={proxy}>
        <LeadForm reportId={PAST_REPORT_ID} />
      </Wrapper>,
    );
    // Positive anchor: wait for the query cascade to settle by confirming the
    // form rendered its section content, THEN assert no redirect fired.
    await screen.findAllByText("Test Product");
    expect(replace).not.toHaveBeenCalled();
  });

  it("head session on /lead/report/<reportId> without authorId redirects to head report and does not load lead form", async () => {
    const byPeriodQuery = vi.fn();
    const proxy = buildHarness({
      onByPeriodQuery: byPeriodQuery,
    });
    render(
      <Wrapper proxy={proxy}>
        <SessionContext.Provider
          value={{
            user: {
              id: "head-id",
              name: "Head User",
              email: "head@example.test",
              role: "head",
            },
            // Organization is intentionally absent to exercise fallback brand
            // rendering in this redirect-focused scenario.
            organization: null,
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <LeadForm reportId={PAST_REPORT_ID} />
        </SessionContext.Provider>
      </Wrapper>,
    );
    // Wait for the head-session redirect to fire, then assert no lead query ran.
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/head/report/${PAST_REPORT_ID}`),
    );
    expect(byPeriodQuery).not.toHaveBeenCalled();
  });

  it("addressed route → sets document.title to the addressed week", async () => {
    const proxy = buildHarness({
      byPeriodSection: makeSection({
        reportSectionId: PAST_SECTION_ID,
        reportId: PAST_REPORT_ID,
        status: "submitted",
      }),
      byPeriodReadOnly: true,
    });
    render(
      <Wrapper proxy={proxy}>
        <LeadForm reportId={PAST_REPORT_ID} />
      </Wrapper>,
    );
    // History entry for PAST_REPORT_ID → Apr 7–13, 2026, ISO Week 15. The
    // provided session has no organization, so title branding falls back to
    // neutral placeholder text.
    await waitFor(() => expect(document.title).toContain("Week 15"));
    expect(document.title).toContain("Apr 7–13, 2026");
    expect(document.title).toContain("Organization");
  });

  it("document title brand comes from the session organization, not a hard-coded product brand", async () => {
    const proxy = buildHarness({
      byPeriodSection: makeSection({
        reportSectionId: PAST_SECTION_ID,
        reportId: PAST_REPORT_ID,
        status: "submitted",
      }),
      byPeriodReadOnly: true,
    });
    render(
      <Wrapper proxy={proxy}>
        <SessionContext.Provider
          value={{
            user: {
              id: "lead-id",
              name: "Lead User",
              email: "lead@example.test",
              role: "lead",
            },
            organization: {
              shortName: "PEO",
              fullName: "Product Engineering",
            },
            isLoading: false,
            isAuthenticated: true,
          }}
        >
          <LeadForm reportId={PAST_REPORT_ID} />
        </SessionContext.Provider>
      </Wrapper>,
    );
    await waitFor(() => expect(document.title).toContain("Week 15"));
    expect(document.title).toContain("· Product Engineering");
    expect(document.title).not.toContain("WeeklyReport");
  });
});
