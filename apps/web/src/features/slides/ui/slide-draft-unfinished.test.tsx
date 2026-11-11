import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { AuthorReportSectionReadModel } from "@weeklyreport/shared";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import { withSlideSections } from "../../report-sections";
import { useSlideDraftSaveMutation } from "./use-slide-inline-editor-support";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const stored: AuthorReportSectionReadModel = {
  ...makeReportSectionFixture(),
  risks: [
    {
      id: "risk-row",
      stableId: "risk-lineage",
      projectId: "project",
      risk: "Private risk",
      impact: null,
      mitigation: null,
      severity: "at-risk",
      stageNames: ["Development"],
    },
  ],
  decisions: [
    {
      id: "decision-row",
      stableId: "decision-lineage",
      productId: "project",
      text: "Private decision",
      owner: "Test Lead",
      impact: null,
      stageNames: ["Development"],
    },
  ],
};

function setup(cached = stored) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const { proxy, captured } = createMockTRPC([
    { path: ["reports", "saveDraft"], mutation: true },
    { path: ["reports", "getActive"], query: null },
    { path: ["leadForm", "byPeriod"], query: null },
  ]);
  const mutation = expectDefined(captured["reports.saveDraft"]);
  mutation.mutationFn.mockResolvedValue({
    ...stored,
    version: stored.version + 1,
  });
  client.setQueryData([["leadForm", "byPeriod"]], { section: cached });
  const onSaved = vi.fn();
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  const hook = renderHook(
    () =>
      useSlideDraftSaveMutation({
        refetchSection: () => Promise.resolve(undefined),
        onSaved,
      }),
    { wrapper: Wrapper },
  );
  return { ...hook, mutation, onSaved };
}

describe("slides save transport and retained unfinished records", () => {
  it("keeps hidden nullable rows in an unrelated slide edit", async () => {
    const h = setup();
    const section = withSlideSections({ section: stored }).editableSection;
    act(() => h.result.current.saveDraftSection(section, section, "saved"));
    await waitFor(() => expect(h.onSaved).toHaveBeenCalled());
    expect(h.mutation.calls[0]).toMatchObject({
      version: stored.version,
      risks: [
        expect.objectContaining({
          stableId: "risk-lineage",
          impact: null,
          mitigation: null,
        }),
      ],
      decisions: [
        expect.objectContaining({ stableId: "decision-lineage", impact: null }),
      ],
    });
    expect(h.mutation.calls[0]).not.toHaveProperty("deletedIncompleteRecords");
  });

  it("names only the explicitly removed unfinished identity at the exact stored version", async () => {
    const h = setup();
    const section = withSlideSections({ section: stored }).editableSection;
    act(() =>
      h.result.current.saveDraftSection(
        section,
        { ...section, risks: [] },
        "deleted",
      ),
    );
    await waitFor(() => expect(h.onSaved).toHaveBeenCalled());
    expect(h.mutation.calls[0]).toMatchObject({
      deletedIncompleteRecords: [{ kind: "risk", stableId: "risk-lineage" }],
      decisions: [expect.objectContaining({ stableId: "decision-lineage" })],
    });
  });

  it("does not infer deletions from a different version", async () => {
    const h = setup({ ...stored, version: stored.version + 1 });
    const section = withSlideSections({ section: stored }).editableSection;
    act(() =>
      h.result.current.saveDraftSection(
        section,
        { ...section, risks: [] },
        "deleted",
      ),
    );
    await waitFor(() => expect(h.onSaved).toHaveBeenCalled());
    expect(h.mutation.calls[0]).not.toHaveProperty("deletedIncompleteRecords");
  });

  it("uses the confirmed write version when the read cache is still older", async () => {
    const h = setup();
    const section = withSlideSections({ section: stored }).editableSection;
    act(() => h.result.current.saveDraftSection(section, section, "saved"));
    await waitFor(() => expect(h.result.current.isPending).toBe(false));
    await waitFor(() => expect(h.onSaved).toHaveBeenCalledTimes(1));
    const next = { ...section, version: section.version + 1 };
    act(() =>
      h.result.current.saveDraftSection(
        next,
        { ...next, decisions: [] },
        "deleted",
      ),
    );
    await waitFor(() => expect(h.onSaved).toHaveBeenCalledTimes(2));
    expect(h.mutation.calls[1]).toMatchObject({
      version: next.version,
      deletedIncompleteRecords: [
        { kind: "decision", stableId: "decision-lineage" },
      ],
    });
  });
});
