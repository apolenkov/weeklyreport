/**
 * Phase 35-07 (UX-15): tests for the addressed-URL behaviour layered on
 * top of <LeadForm/>.
 *
 * Two paths under test:
 *
 *   1. Bare route (`/lead/report` with no `?period=` and no `reportId`
 *      prop, `redirectToCanonical={true}`) → form fires
 *      `router.replace('/lead/report/<activeReportId>')` once the active
 *      report is resolved. The `?period=` legacy path suppresses the
 *      redirect.
 *
 *   2. Addressed route (`/lead/report/[reportId]`) → form scopes the data
 *      load to the path-segment id, surfaces the "Viewing past period"
 *      banner when the pinned report is not the active one, and does NOT
 *      redirect.
 *
 * The tRPC proxy is mocked at the boundary; we don't exercise the network
 * stack. This mirrors the harness used by lead-form.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { LeadForm } from "./lead-form";
import { TRPCProxyContext } from "../../lib/trpc-context";
import { SessionContext } from "../../lib/session-provider";

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
  return {
    reportSectionId: opts.reportSectionId ?? ACTIVE_SECTION_ID,
    reportId: opts.reportId ?? ACTIVE_REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead" as const,
    status: opts.status ?? ("draft" as const),
    submittedAt: null,
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
      },
    ],
    items: [],
    risks: [],
    decisions: [],
    priorities: [],
  };
}

async function flushAll() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

function buildHarness(opts: {
  pinnedReportId?: string;
  // The byPeriod section returned by the mock; defaults to active-report data.
  byPeriodSection?: ReturnType<typeof makeSection>;
  byPeriodReadOnly?: boolean;
  onByPeriodQuery?: () => void;
}) {
  const trpcMock = {
    reports: {
      getActive: {
        queryOptions: () => ({
          queryKey: ["reports.getActive"],
          queryFn: async () => ({
            reportId: ACTIVE_REPORT_ID,
            reportSectionId: ACTIVE_SECTION_ID,
            authorName: "Test Lead",
          }),
        }),
        pathFilter: () => ({ queryKey: ["reports.getActive"] }),
      },
      myHistory: {
        queryOptions: () => ({
          queryKey: ["reports.myHistory"],
          queryFn: async () => [
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
        }),
        pathFilter: () => ({ queryKey: ["reports.myHistory"] }),
      },
      saveDraft: {
        mutationOptions: (
          passed: {
            onSuccess?: () => void;
            onError?: (e: unknown) => void;
          } = {},
        ) => ({
          ...passed,
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["reports.saveDraft"] }),
      },
      submit: {
        mutationOptions: (
          passed: {
            onSuccess?: () => void;
            onError?: (e: unknown) => void;
          } = {},
        ) => ({
          ...passed,
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["reports.submit"] }),
      },
    },
    leadForm: {
      byPeriod: {
        queryOptions: () => ({
          queryKey: ["leadForm.byPeriod"],
          queryFn: async () => {
            opts.onByPeriodQuery?.();
            return {
              section: opts.byPeriodSection ?? makeSection(),
              readOnly: opts.byPeriodReadOnly ?? false,
            };
          },
        }),
        pathFilter: () => ({ queryKey: ["leadForm.byPeriod"] }),
      },
      versions: {
        queryOptions: () => ({
          queryKey: ["leadForm.versions"],
          queryFn: async () => [],
        }),
        pathFilter: () => ({ queryKey: ["leadForm.versions"] }),
      },
      revoke: {
        mutationOptions: (
          passed: {
            onSuccess?: () => void;
            onError?: (e: unknown) => void;
          } = {},
        ) => ({
          ...passed,
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.revoke"] }),
      },
      fillFrom: {
        mutationOptions: (
          passed: {
            onSuccess?: () => void;
            onError?: (e: unknown) => void;
          } = {},
        ) => ({
          ...passed,
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.fillFrom"] }),
      },
      restoreVersion: {
        mutationOptions: (
          passed: {
            onSuccess?: () => void;
            onError?: (e: unknown) => void;
          } = {},
        ) => ({
          ...passed,
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.restoreVersion"] }),
      },
      requestReopen: {
        mutationOptions: (
          passed: {
            onSuccess?: () => void;
            onError?: (e: unknown) => void;
          } = {},
        ) => ({
          ...passed,
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.requestReopen"] }),
      },
      createSnapshot: {
        mutationOptions: (
          passed: {
            onSuccess?: () => void;
            onError?: (e: unknown) => void;
          } = {},
        ) => ({
          ...passed,
          mutationFn: async () => ({ ok: true }),
        }),
        pathFilter: () => ({ queryKey: ["leadForm.createSnapshot"] }),
      },
    },
    ai: {
      onTrack: {
        queryOptions: () => ({
          queryKey: ["ai.onTrack"],
          queryFn: async () => ({ available: false }) as const,
        }),
        pathFilter: () => ({ queryKey: ["ai.onTrack"] }),
      },
    },
  };

  return trpcMock;
}

function Wrapper({ children }: { readonly children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("LeadForm — Phase 35-07 addressable URLs", () => {
  beforeEach(() => {
    replace.mockReset();
    push.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    document.title = "";
  });

  it("bare route + redirectToCanonical → router.replace(/lead/report/<activeReportId>)", async () => {
    const trpcMock = buildHarness({});
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={trpcMock as never}>
          <LeadForm redirectToCanonical />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );
    await act(async () => {
      await flushAll();
    });

    expect(replace).toHaveBeenCalledWith(`/lead/report/${ACTIVE_REPORT_ID}`);
  });

  it("bare route with ?period= → no redirect (legacy back-compat)", async () => {
    mockSearchParams = new URLSearchParams("period=2026-W15");
    const trpcMock = buildHarness({});
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={trpcMock as never}>
          <LeadForm period="2026-W15" redirectToCanonical />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );
    await act(async () => {
      await flushAll();
    });

    expect(replace).not.toHaveBeenCalled();
  });

  it("addressed route (reportId prop set) → no redirect, just renders the form", async () => {
    const trpcMock = buildHarness({
      pinnedReportId: PAST_REPORT_ID,
      byPeriodSection: makeSection({
        reportSectionId: PAST_SECTION_ID,
        reportId: PAST_REPORT_ID,
        status: "submitted",
      }),
      byPeriodReadOnly: true,
    });
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={trpcMock as never}>
          <LeadForm reportId={PAST_REPORT_ID} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );
    await act(async () => {
      await flushAll();
    });

    // No redirect when explicitly pinned.
    expect(replace).not.toHaveBeenCalled();
  });

  it("head session on /lead/report/<reportId> without authorId redirects to head report and does not load lead form", async () => {
    const byPeriodQuery = vi.fn();
    const trpcMock = buildHarness({
      pinnedReportId: PAST_REPORT_ID,
      onByPeriodQuery: byPeriodQuery,
    });
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={trpcMock as never}>
          <SessionContext.Provider
            value={{
              user: {
                id: "head-id",
                name: "Head User",
                email: "head@example.test",
                role: "head",
              },
              // UFB-047 / Phase 48-A: SessionState now carries an
              // organization slot. Tests that don't exercise the brand
              // hydration set it to null — the consumer falls back to
              // the seeded defaults.
              organization: null,
              isLoading: false,
              isAuthenticated: true,
            }}
          >
            <LeadForm reportId={PAST_REPORT_ID} />
          </SessionContext.Provider>
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );
    await act(async () => {
      await flushAll();
    });

    expect(replace).toHaveBeenCalledWith(`/head/report/${PAST_REPORT_ID}`);
    expect(byPeriodQuery).not.toHaveBeenCalled();
  });

  it("addressed route → sets document.title to the addressed week", async () => {
    const trpcMock = buildHarness({
      pinnedReportId: PAST_REPORT_ID,
      byPeriodSection: makeSection({
        reportSectionId: PAST_SECTION_ID,
        reportId: PAST_REPORT_ID,
        status: "submitted",
      }),
      byPeriodReadOnly: true,
    });
    render(
      <Wrapper>
        <TRPCProxyContext.Provider value={trpcMock as never}>
          <LeadForm reportId={PAST_REPORT_ID} />
        </TRPCProxyContext.Provider>
      </Wrapper>,
    );
    await act(async () => {
      await flushAll();
    });

    // History entry for PAST_REPORT_ID → Apr 7-13, ISO Week 15.
    expect(document.title).toContain("Week 15");
    expect(document.title).toContain("Apr 7-13");
    expect(document.title).toContain("CustomReport");
  });
});
