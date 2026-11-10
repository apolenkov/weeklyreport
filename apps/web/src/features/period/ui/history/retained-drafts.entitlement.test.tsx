// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  type MyHistoryResult,
  type RetainedIncompleteRecordsOutput,
  type UserSession,
  userSessionSchema,
} from "@weeklyreport/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionProvider } from "../../../../shared/lib/auth/session-provider";
import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { RetainedDraftsDialog } from "./retained-drafts-dialog";

const AUTHOR_ID = "a0000000-0000-4000-8000-000000000001";
const REPORT_ID = "a0000000-0000-4000-8000-000000000002";
const SECTION_ID = "a0000000-0000-4000-8000-000000000003";
const PRIVATE_TEXT = "Synthetic private vendor draft";
const AUTHOR = userSessionSchema.parse({
  userId: AUTHOR_ID,
  name: "Synthetic author",
  email: "author@example.test",
  role: "lead",
});
const source = {
  reportId: REPORT_ID,
  reportSectionId: SECTION_ID,
  periodLabel: "Week 20",
};
const AVAILABLE: RetainedIncompleteRecordsOutput = {
  status: "available",
  reportId: REPORT_ID,
  reportSectionId: SECTION_ID,
  periodStart: new Date("2026-05-11T00:00:00Z"),
  periodEnd: new Date("2026-05-17T00:00:00Z"),
  readOnlyReason: "published",
  risks: [
    {
      stableId: "a0000000-0000-4000-8000-000000000004",
      projectId: "a0000000-0000-4000-8000-000000000005",
      risk: PRIVATE_TEXT,
      impact: null,
      mitigation: "Synthetic mitigation",
      severity: "at-risk",
      stageNames: ["Development"],
    },
  ],
  decisions: [],
};
const PUBLIC_HISTORY: MyHistoryResult = {
  items: [
    {
      sectionId: SECTION_ID,
      reportId: REPORT_ID,
      periodStart: new Date("2026-05-11T00:00:00Z"),
      periodEnd: new Date("2026-05-17T00:00:00Z"),
      reportStatus: "published",
      sectionStatus: "draft",
      submittedAt: null,
      publishedAt: new Date("2026-05-18T00:00:00Z"),
      itemCount: 2,
      riskCount: 1,
      decisionCount: 1,
      publishedOmissions: { risks: 1, decisions: 0, unknown: false },
    },
  ],
  nextCursor: null,
};
const PRIVATE_HISTORY: MyHistoryResult = {
  ...PUBLIC_HISTORY,
  items: PUBLIC_HISTORY.items.map((entry) => ({
    ...entry,
    retainedDrafts: { risks: 1, decisions: 0, readOnlyReason: "published" },
  })),
};
const clients: QueryClient[] = [];

function harness(initial: UserSession | null = AUTHOR) {
  let current = initial;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  clients.push(queryClient);
  const { proxy } = createMockTRPC([
    { path: ["auth", "me"], query: () => current },
    { path: ["reports", "getActive"] },
    { path: ["leadForm", "byPeriod"] },
    { path: ["reports", "myHistory"], query: () => PUBLIC_HISTORY },
    {
      path: ["leadForm", "retainedIncompleteRecords"],
      queryByInput: () =>
        current?.userId === AUTHOR_ID && current.role !== "viewer"
          ? AVAILABLE
          : { status: "unavailable" },
    },
  ]);
  const retainedKey = proxy.leadForm.retainedIncompleteRecords.queryOptions({
    reportId: REPORT_ID,
    reportSectionId: SECTION_ID,
  }).queryKey;
  const historyKey = proxy.reports.myHistory.queryOptions({
    limit: 50,
  }).queryKey;
  const infiniteKey = proxy.reports.myHistory.infiniteQueryKey({ limit: 20 });
  queryClient.setQueryData(proxy.auth.me.queryKey(), initial);
  queryClient.setQueryData(retainedKey, AVAILABLE);
  const section = makeReportSectionFixture({
    reportId: REPORT_ID,
    reportSectionId: SECTION_ID,
    authorId: AUTHOR_ID,
  });
  queryClient.setQueryData(proxy.reports.getActive.queryKey(), section);
  queryClient.setQueryData(proxy.leadForm.byPeriod.queryKey(), {
    section,
    readOnly: false,
    canRequestReopen: false,
    reopenBlockedReason: null,
    publishedLineage: { itemStableIds: [], decisionStableIds: [] },
  });
  queryClient.setQueryData(historyKey, PRIVATE_HISTORY);
  queryClient.setQueryData(infiniteKey, {
    pages: [PRIVATE_HISTORY, PRIVATE_HISTORY],
    pageParams: [null, "page-2"],
  });

  render(
    <QueryClientProvider client={queryClient}>
      <TRPCProxyContext.Provider value={proxy}>
        <SessionProvider>
          <RetainedDraftsDialog source={source} onClose={() => undefined} />
        </SessionProvider>
      </TRPCProxyContext.Provider>
    </QueryClientProvider>,
  );
  const changeSession = async (next: UserSession | null) => {
    current = next;
    await act(async () => {
      await queryClient.refetchQueries(proxy.auth.me.pathFilter());
    });
  };
  return {
    queryClient,
    proxy,
    retainedKey,
    historyKey,
    infiniteKey,
    changeSession,
  };
}

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_AUTH_STUB", "false"));
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.unstubAllEnvs();
});

describe("observed private-draft entitlement loss", () => {
  it("hides an open recovery view and strips only private discovery from both history cache forms", async () => {
    const h = harness();
    await screen.findByText(PRIVATE_TEXT);
    await h.changeSession({ ...AUTHOR, role: "viewer" });
    await waitFor(() =>
      expect(screen.queryByText(PRIVATE_TEXT)).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(h.queryClient.getQueryData(h.historyKey)).toEqual(PUBLIC_HISTORY),
    );
    expect(h.queryClient.getQueryData(h.infiniteKey)).toEqual({
      pages: [PUBLIC_HISTORY, PUBLIC_HISTORY],
      pageParams: [null, "page-2"],
    });
    expect(
      h.queryClient.getQueryData(h.proxy.reports.getActive.queryKey()),
    ).toBeUndefined();
    expect(
      h.queryClient.getQueryData(h.proxy.leadForm.byPeriod.queryKey()),
    ).toBeUndefined();
    expect(
      JSON.stringify(h.queryClient.getQueryData(h.retainedKey)),
    ).not.toContain(PRIVATE_TEXT);
  });

  it("does not let a late pre-demotion response restore the private draft", async () => {
    const h = harness();
    await screen.findByText(PRIVATE_TEXT);
    const late = Promise.withResolvers<RetainedIncompleteRecordsOutput>();
    const fetching = h.queryClient
      .query({
        queryKey: h.retainedKey,
        queryFn: () => late.promise,
        staleTime: 0,
      })
      .catch(() => undefined);
    await h.changeSession({ ...AUTHOR, role: "viewer" });
    await waitFor(() =>
      expect(screen.queryByText(PRIVATE_TEXT)).not.toBeInTheDocument(),
    );
    await act(async () => {
      late.resolve(AVAILABLE);
      await fetching;
    });
    expect(screen.queryByText(PRIVATE_TEXT)).not.toBeInTheDocument();
    expect(
      JSON.stringify(h.queryClient.getQueryData(h.retainedKey)),
    ).not.toContain(PRIVATE_TEXT);
  });

  it("clears private and own-history caches when the session becomes anonymous", async () => {
    const h = harness();
    await screen.findByText(PRIVATE_TEXT);
    await h.changeSession(null);
    await waitFor(() =>
      expect(screen.queryByText(PRIVATE_TEXT)).not.toBeInTheDocument(),
    );
    expect(h.queryClient.getQueryData(h.historyKey)).toBeUndefined();
    expect(h.queryClient.getQueryData(h.infiniteKey)).toBeUndefined();
  });

  it.each(["ordinary", "infinite"] as const)(
    "cancels late private discovery from a pending %s history response",
    async (kind) => {
      const h = harness();
      await screen.findByText(PRIVATE_TEXT);
      const cached =
        kind === "ordinary"
          ? PRIVATE_HISTORY
          : {
              pages: [PRIVATE_HISTORY, PRIVATE_HISTORY],
              pageParams: [null, "page-2"],
            };
      const key = kind === "ordinary" ? h.historyKey : h.infiniteKey;
      const late = Promise.withResolvers<typeof cached>();
      const fetching = h.queryClient
        .query({
          queryKey: key,
          queryFn: () => late.promise,
          staleTime: 0,
        })
        .catch(() => undefined);
      await h.changeSession({ ...AUTHOR, role: "viewer" });
      await waitFor(() =>
        expect(h.queryClient.getQueryData(h.historyKey)).toEqual(
          PUBLIC_HISTORY,
        ),
      );
      await act(async () => {
        late.resolve(cached);
        await fetching;
      });
      expect(h.queryClient.getQueryData(key)).toEqual(
        kind === "ordinary"
          ? PUBLIC_HISTORY
          : {
              pages: [PUBLIC_HISTORY, PUBLIC_HISTORY],
              pageParams: [null, "page-2"],
            },
      );
      expect(screen.queryByText(PRIVATE_TEXT)).not.toBeInTheDocument();
    },
  );

  it("does not carry the previous author's cache into a different author identity", async () => {
    const h = harness();
    await screen.findByText(PRIVATE_TEXT);
    await h.changeSession({
      ...AUTHOR,
      userId: "a0000000-0000-4000-8000-000000000099",
    });
    await waitFor(() =>
      expect(screen.queryByText(PRIVATE_TEXT)).not.toBeInTheDocument(),
    );
    expect(h.queryClient.getQueryData(h.historyKey)).toBeUndefined();
    expect(h.queryClient.getQueryData(h.infiniteKey)).toBeUndefined();
  });

  it("clears a private recovery cache already present when a viewer session is observed", async () => {
    const h = harness({ ...AUTHOR, role: "viewer" });
    await waitFor(() =>
      expect(screen.queryByText(PRIVATE_TEXT)).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(h.queryClient.getQueryData(h.historyKey)).toBeUndefined(),
    );
  });

  it.each(["lead", "head", "admin"] as const)(
    "preserves the same entitled %s author's cached drafts after group/role refresh",
    async (role) => {
      const h = harness();
      await screen.findByText(PRIVATE_TEXT);
      await h.changeSession({
        ...AUTHOR,
        role,
        reportingGroupId: "a0000000-0000-4000-8000-000000000077",
        reportingGroupName: "Changed group",
      });
      expect(screen.getByText(PRIVATE_TEXT)).toBeInTheDocument();
      expect(h.queryClient.getQueryData(h.retainedKey)).toEqual(AVAILABLE);
      expect(h.queryClient.getQueryData(h.historyKey)).toEqual(PRIVATE_HISTORY);
    },
  );
});
