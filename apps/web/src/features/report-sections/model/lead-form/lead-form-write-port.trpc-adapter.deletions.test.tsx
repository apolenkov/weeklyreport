import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { TRPCProxyContext } from "../../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../../test-utils/expect-defined";
import { createMockTRPC } from "../../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { useLeadFormWritePort } from "./lead-form-write-port.trpc-adapter";

const section = makeReportSectionFixture({
  reportSectionId: "11111111-1111-4111-8111-111111111111",
  reportId: "22222222-2222-4222-8222-222222222222",
  authorId: "33333333-3333-4333-8333-333333333333",
  authorName: "Test Lead",
});
const readMetadata = {
  readOnly: false,
  canRequestReopen: false,
  reopenBlockedReason: null,
  publishedLineage: { itemStableIds: [], decisionStableIds: [] },
};

function buildHarness() {
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "submit"], mutation: true },
    { path: ["leadForm", "fillFrom"], mutation: true },
    { path: ["leadForm", "resolvePlan"], mutation: true },
    { path: ["leadForm", "restorePlan"], mutation: true },
    { path: ["leadForm", "promotePlan"], mutation: true },
    { path: ["leadForm", "revoke"], mutation: true },
    { path: ["leadForm", "requestReopen"], mutation: true },
    { path: ["reports", "getActive"] },
    { path: ["leadForm", "byPeriod"] },
  ]);
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
  return { Wrapper, captured, queryClient, proxy };
}

// The server deletes an unfinished risk or decision only when a save names it
// (openspec: lead-incomplete-record-drafts), so the adapter remembers what the
// last write left stored.
describe("useLeadFormWritePort — unfinished records", () => {
  it.each([true, false])(
    "keeps deletion intent across changed reads (initial read: %s)",
    async (initialRead) => {
      const { Wrapper, captured, queryClient, proxy } = buildHarness();
      const stableId = "44444444-4444-4444-8444-444444444444";
      const queryKey = proxy.leadForm.byPeriod.queryKey({
        reportId: section.reportId,
      });
      const initialSection = {
        ...section,
        version: 1,
        risks: [
          {
            id: stableId,
            stableId,
            projectId: null,
            activityId: null,
            risk: "Unfinished risk",
            impact: null,
            mitigation: null,
            severity: "at-risk" as const,
            stageNames: [],
          },
        ],
      };
      if (initialRead)
        queryClient.setQueryData(queryKey, {
          ...readMetadata,
          section: initialSection,
        });
      const saveDraft = expectDefined(captured["reports.saveDraft"]).mutationFn;
      saveDraft.mockRejectedValue(new Error("Response lost"));
      const { result } = renderHook(
        () => useLeadFormWritePort(section.reportSectionId),
        { wrapper: Wrapper },
      );
      const request = {
        reportSectionId: section.reportSectionId,
        version: 1,
        status: "draft" as const,
        projectStatuses: [],
        stageStatuses: [],
        activityStatuses: [],
        items: [],
        risks: [],
        decisions: [],
      };
      await act(async () => {
        await expect(result.current.saveDraft(request)).rejects.toMatchObject({
          kind: "ambiguous",
        });
      });
      expect(
        (saveDraft.mock.calls[0]?.[0] as { deletedIncompleteRecords?: unknown })
          .deletedIncompleteRecords,
      ).toEqual(initialRead ? [{ kind: "risk", stableId }] : undefined);
      await act(async () => {
        await expect(
          result.current.saveDraft({ ...request, risks: initialSection.risks }),
        ).rejects.toMatchObject({ kind: "ambiguous" });
      });
      expect(saveDraft.mock.calls[1]?.[0]).not.toHaveProperty(
        "deletedIncompleteRecords",
      );
      // An authorized read sees the committed deletion. It is not the original
      // request: its retry must still carry the original expected version/intent.
      await act(() =>
        queryClient.setQueryData(queryKey, {
          ...readMetadata,
          section: initialRead
            ? { ...section, version: 2, risks: [] }
            : initialSection,
        }),
      );
      await act(async () => {
        await expect(
          result.current.saveDraft(structuredClone(request)),
        ).rejects.toMatchObject({ kind: "ambiguous" });
      });
      expect(saveDraft.mock.calls[2]?.[0]).toEqual(
        saveDraft.mock.calls[0]?.[0],
      );
      // A later new-version write derives its own intent, not the old request's.
      queryClient.setQueryData(queryKey, {
        ...readMetadata,
        section: { ...section, version: 2, risks: [] },
      });
      await act(async () => {
        await expect(
          result.current.saveDraft({ ...request, version: 2 }),
        ).rejects.toMatchObject({ kind: "ambiguous" });
      });
      expect(saveDraft.mock.calls[3]?.[0]).not.toHaveProperty(
        "deletedIncompleteRecords",
      );
    },
  );

  it("names the stored unfinished records a later save leaves out", async () => {
    const { Wrapper, captured } = buildHarness();
    const RISK = "44444444-4444-4444-8444-444444444444";
    const emptySave = {
      reportSectionId: section.reportSectionId,
      status: "draft" as const,
      projectStatuses: [],
      stageStatuses: [],
      activityStatuses: [],
      items: [],
      risks: [],
      decisions: [],
    };
    const unfinishedRisk = {
      id: RISK,
      stableId: RISK,
      projectId: null,
      activityId: null,
      risk: "Vendor may slip",
      impact: null,
      mitigation: null,
      severity: "at-risk" as const,
      stageNames: [],
    };
    const saveDraft = expectDefined(captured["reports.saveDraft"]).mutationFn;
    saveDraft
      .mockResolvedValueOnce({
        ...section,
        version: 2,
        risks: [unfinishedRisk],
      })
      .mockResolvedValueOnce({
        ...section,
        version: 3,
        risks: [unfinishedRisk],
      })
      .mockResolvedValueOnce({ ...section, version: 4 });
    const { result } = renderHook(
      () => useLeadFormWritePort(section.reportSectionId),
      { wrapper: Wrapper },
    );

    // The form receives the missing details as empty fields.
    const first = await act(() =>
      result.current.saveDraft({
        ...emptySave,
        version: 1,
        risks: [unfinishedRisk],
      }),
    );
    expect(first.risks).toEqual([
      { ...unfinishedRisk, impact: "", mitigation: "" },
    ]);

    // Still carried: nothing is named for deletion.
    await act(() =>
      result.current.saveDraft({
        ...emptySave,
        version: 2,
        risks: [unfinishedRisk],
      }),
    );
    // Removed on the form: the save names it.
    await act(() => result.current.saveDraft({ ...emptySave, version: 3 }));

    const sent = saveDraft.mock.calls.map(
      ([input]) =>
        (input as { deletedIncompleteRecords?: unknown })
          .deletedIncompleteRecords,
    );
    expect(sent).toEqual([
      undefined,
      undefined,
      [{ kind: "risk", stableId: RISK }],
    ]);
  });
});
