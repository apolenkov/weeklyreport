import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { useLeadFormFillFrom } from "./use-lead-form-fill-from";

describe("useLeadFormFillFrom", () => {
  it("keeps an unsaved overwrite pending until the shared dialog confirms it", async () => {
    const { proxy, captured } = createMockTRPC([
      { path: ["leadForm", "fillFrom"], mutation: true },
      { path: ["reports", "getActive"] },
      { path: ["leadForm", "byPeriod"] },
    ]);
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
    const fillFrom = expectDefined(captured["leadForm.fillFrom"]);
    const { result } = renderHook(
      () =>
        useLeadFormFillFrom({
          generation: "report-a:section-a",
          sectionIdForActions: "target",
          autosaveDirty: true,
          version: 4,
          handleConflict: () => undefined,
        }),
      { wrapper },
    );

    act(() => result.current.handleFillFrom("source"));
    expect(result.current.pendingFillFrom).toBe(true);
    expect(fillFrom.mutationFn).not.toHaveBeenCalled();

    act(() => result.current.confirmPendingFillFrom());
    expect(result.current.pendingFillFrom).toBe(false);
    await waitFor(() =>
      expect(fillFrom.mutationFn).toHaveBeenCalledWith(
        {
          targetSectionId: "target",
          sourceSectionId: "source",
          version: 4,
        },
        expect.anything(),
      ),
    );
  });
});
