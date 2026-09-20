import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { AdminUserView } from "../model/admin-types";
import {
  useStageAssignmentData,
  useStageAssignmentMutations,
} from "./use-stage-assignments";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  vi.clearAllMocks();
});

const PROJECT_ID = "p-1";
const GROUP_ID = "g-1";

const leads: readonly AdminUserView[] = [
  {
    id: "u-1",
    name: "Alice Lead",
    lastName: "Alice",
    firstName: "Lead",
    middleName: null,
    position: null,
    email: "alice@example.com",
    role: "lead",
    groupId: GROUP_ID,
    department: "Eng",
    isActive: true,
  },
  {
    id: "u-2",
    name: "Bob Else",
    lastName: "Bob",
    firstName: "Else",
    middleName: null,
    position: null,
    email: "bob@example.com",
    role: "lead",
    groupId: "g-other",
    department: "Eng",
    isActive: true,
  },
];

function renderHookInProvider(
  descriptors: Parameters<typeof createMockTRPC>[0],
) {
  const { proxy } = createMockTRPC(descriptors);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }
  const rendered = renderHook(() => useStageAssignmentData(PROJECT_ID, leads), {
    wrapper: Wrapper,
  });
  return rendered;
}

function renderMutationHook() {
  const { proxy, captured } = createMockTRPC([
    { path: ["admin", "listStageAssignments"] },
    { path: ["admin", "listStageAssignmentCounts"] },
    { path: ["admin", "saveStageAssignment"], mutation: true },
    { path: ["admin", "deleteStageAssignment"], mutation: true },
  ]);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const assignmentKey = proxy.admin.listStageAssignments.queryKey({
    projectId: PROJECT_ID,
  });
  const countsKey = proxy.admin.listStageAssignmentCounts.queryKey();
  qc.setQueryData(assignmentKey, []);
  qc.setQueryData(countsKey, []);

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  const rendered = renderHook(() => useStageAssignmentMutations(), {
    wrapper: Wrapper,
  });
  return { ...rendered, captured, qc, assignmentKey, countsKey };
}

const SAVE_INPUT = {
  userId: "00000000-0000-4000-8000-000000000001",
  stageId: "00000000-0000-4000-8000-000000000002",
  projectId: PROJECT_ID,
};
const DELETE_INPUT = { id: "00000000-0000-4000-8000-000000000003" };

function baseDescriptors() {
  return [
    { path: ["admin", "listStages"], query: [] },
    {
      path: ["admin", "listStageAssignments"],
      queryByInput: () => [],
    },
  ] as Parameters<typeof createMockTRPC>[0];
}

describe("useStageAssignmentData — lead scoping", () => {
  it("scopes the picker to the product's owning group", async () => {
    const { result } = renderHookInProvider([
      ...baseDescriptors(),
      {
        path: ["admin", "listProductGroups"],
        queryByInput: () => [{ id: GROUP_ID, name: "Platform" }],
      },
    ]);

    await waitFor(() => expect(result.current.filteredLeads).toHaveLength(1));
    expect(result.current.filteredLeads[0]?.id).toBe("u-1");
  });

  it("fails closed with no selectable leads when the group query fails", async () => {
    const { result } = renderHookInProvider([
      ...baseDescriptors(),
      {
        path: ["admin", "listProductGroups"],
        queryByInput: () => Promise.reject(new Error("ownership failed")),
      },
    ]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.filteredLeads).toEqual([]);
  });

  it("fails closed with no selectable leads while ownership data is missing", async () => {
    const { result } = renderHookInProvider([
      ...baseDescriptors(),
      {
        path: ["admin", "listProductGroups"],
        queryByInput: () => [],
      },
    ]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isError).toBe(false);
    expect(result.current.filteredLeads).toEqual([]);
    expect(result.current.filteredLeads).not.toEqual(leads);
  });
});

describe("useStageAssignmentMutations", () => {
  it("save success invalidates assignment and coverage queries and shows a success toast", async () => {
    const hook = renderMutationHook();

    await act(async () => {
      await hook.result.current.saveMut.mutateAsync(SAVE_INPUT);
    });

    await waitFor(() => {
      expect(hook.qc.getQueryState(hook.assignmentKey)?.isInvalidated).toBe(
        true,
      );
      expect(hook.qc.getQueryState(hook.countsKey)?.isInvalidated).toBe(true);
    });
    expect(toast.success).toHaveBeenCalledWith("Stage assignment saved");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("delete success invalidates assignment and coverage queries and shows a success toast", async () => {
    const hook = renderMutationHook();

    await act(async () => {
      await hook.result.current.deleteMut.mutateAsync(DELETE_INPUT);
    });

    await waitFor(() => {
      expect(hook.qc.getQueryState(hook.assignmentKey)?.isInvalidated).toBe(
        true,
      );
      expect(hook.qc.getQueryState(hook.countsKey)?.isInvalidated).toBe(true);
    });
    expect(toast.success).toHaveBeenCalledWith("Stage assignment removed");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("save failure shows the server error without invalidating queries", async () => {
    const hook = renderMutationHook();
    hook.captured["admin.saveStageAssignment"]?.mutationFn.mockRejectedValue(
      new Error("save failed"),
    );

    await act(async () => {
      await expect(
        hook.result.current.saveMut.mutateAsync(SAVE_INPUT),
      ).rejects.toThrow("save failed");
    });

    expect(hook.qc.getQueryState(hook.assignmentKey)?.isInvalidated).toBe(
      false,
    );
    expect(hook.qc.getQueryState(hook.countsKey)?.isInvalidated).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("save failed");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("delete failure shows the server error without invalidating queries", async () => {
    const hook = renderMutationHook();
    hook.captured["admin.deleteStageAssignment"]?.mutationFn.mockRejectedValue(
      new Error("delete failed"),
    );

    await act(async () => {
      await expect(
        hook.result.current.deleteMut.mutateAsync(DELETE_INPUT),
      ).rejects.toThrow("delete failed");
    });

    expect(hook.qc.getQueryState(hook.assignmentKey)?.isInvalidated).toBe(
      false,
    );
    expect(hook.qc.getQueryState(hook.countsKey)?.isInvalidated).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("delete failed");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
