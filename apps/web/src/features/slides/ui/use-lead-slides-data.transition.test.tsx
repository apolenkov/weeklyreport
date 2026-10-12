// @vitest-environment jsdom

import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../shared/lib/auth/session-provider";
import { makeQueryClient } from "../../../shared/lib/query/query-client";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import { useLeadSlidesData } from "./use-lead-slides-data";

const buildLeadDeckModelMock = vi.hoisted(() =>
  vi.fn(
    (
      section: unknown,
      foreignHealth: unknown,
      foreignContent: unknown,
      showOwnerBadges: boolean,
    ) => ({ section, foreignHealth, foreignContent, showOwnerBadges }),
  ),
);

const { byPeriodInputMock, navigation } = vi.hoisted(() => ({
  byPeriodInputMock: vi.fn(),
  navigation: {
    pathname: "/lead/report/10000000-0000-4000-8000-000000000001",
    searchParams: new URLSearchParams(),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));

vi.mock("../../../shared/hooks/query/use-query-error-handler", () => ({
  useQueryErrorHandler: () => undefined,
}));

vi.mock("../model/lead-slide-periods", () => ({
  buildLeadSlidePeriodOptions: () => [],
  resolveLeadSlideReportId: ({
    requestedReportId,
  }: {
    requestedReportId: string | null;
  }) => requestedReportId ?? "",
}));

vi.mock("../model/lead-slides-deck-model", () => ({
  buildLeadDeckModel: buildLeadDeckModelMock,
}));

vi.mock("../../report-sections", () => ({
  mapLeadFormData: () => ({ readOnly: false }),
}));

const pending = new Promise<never>(() => undefined);

function makeProviders(crossAuthors: () => unknown = () => []) {
  const { proxy } = createMockTRPC([
    {
      path: ["reports", "getActive"],
      query: makeReportSectionFixture({
        reportId: "10000000-0000-4000-8000-000000000001",
      }),
    },
    { path: ["reports", "myHistory"], query: { items: [] } },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: (input) => {
        byPeriodInputMock(input);
        return (input as { reportId: string }).reportId ===
          "10000000-0000-4000-8000-000000000001"
          ? {
              section: makeReportSectionFixture({
                reportSectionId: "10000000-0000-4000-8000-000000000003",
                reportId: "10000000-0000-4000-8000-000000000001",
                items: [
                  {
                    projectId: "10000000-0000-4000-8000-000000000004",
                    type: "current",
                    text: "Report A slide",
                    tag: "",
                    workflowStatus: "in_progress",
                    carriedOver: false,
                  },
                ],
              }),
            }
          : pending;
      },
    },
    { path: ["leadForm", "crossAuthors"], queryByInput: crossAuthors },
  ]);
  const client = makeQueryClient();

  return function Providers({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SessionContext.Provider
          value={{
            user: {
              id: "10000000-0000-4000-8000-000000000006",
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
            {children}
          </TRPCProxyContext.Provider>
        </SessionContext.Provider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  byPeriodInputMock.mockClear();
  navigation.pathname = "/lead/report/10000000-0000-4000-8000-000000000001";
  navigation.searchParams = new URLSearchParams();
});

describe("useLeadSlidesData report-key transitions", () => {
  it.each([
    {
      label: "keeps one author",
      query: "authorId=10000000-0000-4000-8000-000000000004",
      expectedAuthorId: "10000000-0000-4000-8000-000000000004",
    },
    {
      label: "ignores repeated authors",
      query:
        "authorId=10000000-0000-4000-8000-000000000004&authorId=10000000-0000-4000-8000-000000000005",
      expectedAuthorId: undefined,
    },
  ])("$label in the deck request", async ({ query, expectedAuthorId }) => {
    navigation.searchParams = new URLSearchParams(query);

    renderHook(
      () =>
        useLeadSlidesData({
          initialReportId: "10000000-0000-4000-8000-000000000001",
          foreignContent: undefined,
          foreignContentPending: false,
          visibilityMode: "mine",
          visibilityHydrated: true,
        }),
      { wrapper: makeProviders() },
    );

    await waitFor(() =>
      expect(byPeriodInputMock).toHaveBeenCalledWith({
        reportId: "10000000-0000-4000-8000-000000000001",
        authorId: expectedAuthorId,
      }),
    );
  });

  it.each([
    {
      label: "keeps one report",
      query: "reportId=10000000-0000-4000-8000-000000000001",
      expectedReportId: "10000000-0000-4000-8000-000000000001",
    },
    {
      label: "ignores repeated reports",
      query:
        "reportId=10000000-0000-4000-8000-000000000001&reportId=10000000-0000-4000-8000-000000000002",
      expectedReportId: "",
    },
  ])("$label in the deck request", async ({ query, expectedReportId }) => {
    navigation.pathname = "/lead/slides";
    navigation.searchParams = new URLSearchParams(query);

    const rendered = renderHook(
      () =>
        useLeadSlidesData({
          initialReportId: null,
          foreignContent: undefined,
          foreignContentPending: false,
          visibilityMode: "mine",
          visibilityHydrated: true,
        }),
      { wrapper: makeProviders() },
    );

    await waitFor(() =>
      expect(rendered.result.current.targetReportId).toBe(expectedReportId),
    );
  });

  it("drops report A slides and edit state while report B is pending", async () => {
    const rendered = renderHook(
      ({ reportId }) =>
        useLeadSlidesData({
          initialReportId: reportId,
          foreignContent: undefined,
          foreignContentPending: false,
          visibilityMode: "mine",
          visibilityHydrated: true,
        }),
      {
        initialProps: { reportId: "10000000-0000-4000-8000-000000000001" },
        wrapper: makeProviders(),
      },
    );
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    expect(JSON.stringify(rendered.result.current.slides)).toContain(
      "Report A slide",
    );
    expect(rendered.result.current.canInlineEdit).toBe(true);

    rendered.rerender({ reportId: "10000000-0000-4000-8000-000000000002" });

    await waitFor(() => expect(rendered.result.current.isLoading).toBe(true));
    expect(rendered.result.current.slides).toEqual([]);
    expect(rendered.result.current.section).toBeNull();
    expect(rendered.result.current.formData).toBeNull();
    expect(rendered.result.current.canInlineEdit).toBe(false);
  });

  it("passes loaded Everyone content into the deck and suppresses it in Mine", async () => {
    const foreignContent = [
      {
        authorId: "10000000-0000-4000-8000-000000000004",
        authorName: "Maria",
        authorRole: "lead",
        items: [],
        risks: [],
        decisions: [],
      },
    ] as const;
    buildLeadDeckModelMock.mockClear();

    const rendered = renderHook(
      ({ visibilityMode }) =>
        useLeadSlidesData({
          initialReportId: "10000000-0000-4000-8000-000000000001",
          foreignContent,
          foreignContentPending: false,
          visibilityMode,
          visibilityHydrated: true,
        }),
      {
        initialProps: {
          visibilityMode: "everyone" as "everyone" | "mine",
        },
        wrapper: makeProviders(),
      },
    );

    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    await waitFor(() =>
      expect(rendered.result.current.slides[0]).toMatchObject({
        foreignContent,
        showOwnerBadges: true,
      }),
    );
    expect(buildLeadDeckModelMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reportSectionId: "10000000-0000-4000-8000-000000000003",
      }),
      [],
      foreignContent,
      true,
    );

    rendered.rerender({ visibilityMode: "mine" });

    await waitFor(() =>
      expect(rendered.result.current.slides[0]).toMatchObject({
        foreignContent: [],
        showOwnerBadges: false,
      }),
    );
    expect(buildLeadDeckModelMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reportSectionId: "10000000-0000-4000-8000-000000000003",
      }),
      [],
      [],
      false,
    );
  });

  it("keeps Everyone slides loading until the parent content read settles", async () => {
    const foreignContent = [
      {
        authorId: "10000000-0000-4000-8000-000000000004",
        authorName: "Maria",
        authorRole: "lead",
        items: [],
        risks: [],
        decisions: [],
      },
    ] as const;
    const rendered = renderHook(
      ({ content, pending }) =>
        useLeadSlidesData({
          initialReportId: "10000000-0000-4000-8000-000000000001",
          foreignContent: content,
          foreignContentPending: pending,
          visibilityMode: "everyone",
          visibilityHydrated: true,
        }),
      {
        initialProps: {
          content: undefined as typeof foreignContent | undefined,
          pending: true,
        },
        wrapper: makeProviders(),
      },
    );

    await waitFor(() => expect(rendered.result.current.section).not.toBeNull());
    expect(rendered.result.current.isLoading).toBe(true);

    rendered.rerender({ content: foreignContent, pending: false });

    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    expect(rendered.result.current.slides[0]).toMatchObject({
      foreignContent,
      showOwnerBadges: true,
    });
  });
});

describe("useLeadSlidesData enabled health read", () => {
  it.each(["mine", "everyone"] as const)(
    "keeps %s loading until cross-author health resolves",
    async (visibilityMode) => {
      const health = Promise.withResolvers<readonly never[]>();
      const rendered = renderHook(
        () =>
          useLeadSlidesData({
            initialReportId: "10000000-0000-4000-8000-000000000001",
            foreignContent: undefined,
            foreignContentPending: false,
            visibilityMode,
            visibilityHydrated: true,
          }),
        { wrapper: makeProviders(() => health.promise) },
      );
      await waitFor(() =>
        expect(rendered.result.current.section).not.toBeNull(),
      );
      expect(rendered.result.current.isLoading).toBe(true);
      await act(async () => {
        health.resolve([]);
        await health.promise;
      });
      await waitFor(() =>
        expect(rendered.result.current.isLoading).toBe(false),
      );
    },
  );

  it("does not wait for the disabled health read on another author's deck", async () => {
    navigation.searchParams = new URLSearchParams(
      "authorId=10000000-0000-4000-8000-000000000004",
    );
    const readHealth = vi.fn(() => pending);
    const rendered = renderHook(
      () =>
        useLeadSlidesData({
          initialReportId: "10000000-0000-4000-8000-000000000001",
          foreignContent: undefined,
          foreignContentPending: false,
          visibilityMode: "mine",
          visibilityHydrated: true,
        }),
      { wrapper: makeProviders(readHealth) },
    );
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    expect(rendered.result.current.section).not.toBeNull();
    expect(readHealth).not.toHaveBeenCalled();
  });
});
