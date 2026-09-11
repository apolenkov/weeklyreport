import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { useReopenTabState } from "../use-reopen-tab-state";

type ReopenTabState = ReturnType<typeof useReopenTabState>;

const useReopenTabStateMock = vi.fn<() => ReopenTabState>();

vi.mock("../use-reopen-tab-state", () => ({
  useReopenTabState: () => useReopenTabStateMock(),
}));

import { ReopenTab } from "../reopen-tab";

function state(isPending: boolean): ReopenTabState {
  return {
    filter: "pending" as const,
    setFilter: vi.fn(),
    search: "",
    setSearch: vi.fn(),
    requests: [],
    listQuery: {
      isPending,
      isError: false,
      error: null,
    },
    respondingId: null,
    note: "",
    isSaving: false,
    pendingDecision: undefined,
    onNoteChange: vi.fn(),
    startRespond: vi.fn(),
    cancelRespond: vi.fn(),
    respond: vi.fn(),
  } as unknown as ReopenTabState;
}

describe("ReopenTab loading semantics", () => {
  it("exposes the initial request query as a busy status", () => {
    useReopenTabStateMock.mockReturnValue(state(true));
    render(<ReopenTab />);

    expect(
      screen.getByRole("status", { name: "Loading reopen requests" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("does not retain the busy marker for the empty result", () => {
    useReopenTabStateMock.mockReturnValue(state(false));
    render(<ReopenTab />);

    expect(screen.getByText("No pending reopen requests.")).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
