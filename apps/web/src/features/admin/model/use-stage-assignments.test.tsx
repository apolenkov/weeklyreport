import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { TRPCProxyContext } from "../../../lib/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { AdminUserView } from "../model/admin-types";
import { useStageAssignmentData } from "./use-stage-assignments";

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

function baseDescriptors() {
  return [
    { path: ["admin", "listStages"], query: [] as unknown[] },
    {
      path: ["admin", "listStageAssignments"],
      queryByInput: () => [] as unknown[],
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

    await waitFor(() => expect(result.current.filteredLeads).toEqual([]));
    expect(result.current.filteredLeads).not.toEqual(leads);
  });
});
