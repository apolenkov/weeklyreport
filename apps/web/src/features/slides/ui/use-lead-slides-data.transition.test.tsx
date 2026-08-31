// @vitest-environment jsdom

import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SessionContext } from "../../../shared/lib/auth/session-provider";
import { makeQueryClient } from "../../../shared/lib/query/query-client";
import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
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

vi.mock("next/navigation", () => ({
  usePathname: () => "/lead/report/report-a",
  useSearchParams: () => new URLSearchParams(),
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

function makeProviders() {
  const { proxy } = createMockTRPC([
    { path: ["reports", "getActive"], query: { reportId: "report-a" } },
    { path: ["reports", "myHistory"], query: [] },
    {
      path: ["leadForm", "byPeriod"],
      queryByInput: (input) =>
        (input as { reportId: string }).reportId === "report-a"
          ? { section: { id: "section-a", marker: "Report A slide" } }
          : pending,
    },
    { path: ["leadForm", "crossAuthors"], queryByInput: () => [] },
  ]);
  const client = makeQueryClient();

  return function Providers({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SessionContext.Provider
          value={{
            user: {
              id: "lead-user",
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

describe("useLeadSlidesData report-key transitions", () => {
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
        initialProps: { reportId: "report-a" },
        wrapper: makeProviders(),
      },
    );
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    expect(JSON.stringify(rendered.result.current.slides)).toContain(
      "Report A slide",
    );
    expect(rendered.result.current.canInlineEdit).toBe(true);

    rendered.rerender({ reportId: "report-b" });

    await waitFor(() => expect(rendered.result.current.isLoading).toBe(true));
    expect(rendered.result.current.slides).toEqual([]);
    expect(rendered.result.current.section).toBeNull();
    expect(rendered.result.current.formData).toBeNull();
    expect(rendered.result.current.canInlineEdit).toBe(false);
  });

  it("passes loaded Everyone content into the deck and suppresses it in Mine", async () => {
    const foreignContent = [
      {
        authorId: "foreign-author",
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
          initialReportId: "report-a",
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
      expect.objectContaining({ id: "section-a" }),
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
      expect.objectContaining({ id: "section-a" }),
      [],
      [],
      false,
    );
  });

  it("keeps Everyone slides loading until the parent content read settles", async () => {
    const foreignContent = [
      {
        authorId: "foreign-author",
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
          initialReportId: "report-a",
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
