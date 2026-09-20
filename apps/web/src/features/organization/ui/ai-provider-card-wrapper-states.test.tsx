import type { AiProviderControlRead } from "@customreport/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useTRPC: vi.fn(),
  useAiProviderMutations: vi.fn(),
  refetch: vi.fn(),
  queryOptions: vi.fn(() => ({ queryKey: ["admin", "aiProvider", "get"] })),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}));

vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: mocks.useTRPC,
}));

vi.mock("./ai-provider-mutations", () => ({
  AI_PROVIDER_TEST_QUEUED_MESSAGE: "Provider test queued.",
  providerTestExecutionMessage: vi.fn(() => null),
  useAiProviderMutations: mocks.useAiProviderMutations,
}));

import { AiProviderCard } from "./ai-provider-card";

interface QueryResult {
  readonly data: AiProviderControlRead | undefined;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isLoading: boolean;
  readonly refetch: () => void;
}

interface QueryOptions {
  readonly refetchInterval?: (query: {
    readonly state: { readonly data: AiProviderControlRead | undefined };
  }) => number | false;
}

const mutationState = () => ({
  isError: false,
  isPending: false,
  mutate: vi.fn(),
});

const mutations = () => ({
  activate: mutationState(),
  disable: mutationState(),
  discard: mutationState(),
  restore: mutationState(),
  save: mutationState(),
  test: mutationState(),
});

const queryResult = (overrides: Partial<QueryResult> = {}): QueryResult => ({
  data: undefined,
  isError: false,
  isFetching: false,
  isLoading: false,
  refetch: mocks.refetch,
  ...overrides,
});

const dataWithExecutionState = (
  state: "queued" | "running" | "completed",
): AiProviderControlRead =>
  ({
    revisions: [{ latestExecution: { state } }],
  }) as unknown as AiProviderControlRead;

describe("AiProviderCard wrapper states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useTRPC.mockReturnValue({
      admin: { aiProvider: { get: { queryOptions: mocks.queryOptions } } },
    });
    mocks.useAiProviderMutations.mockReturnValue(mutations());
  });

  it("renders loading feedback while the provider query is in flight", () => {
    mocks.useQuery.mockReturnValue(queryResult({ isLoading: true }));

    render(<AiProviderCard />);

    expect(screen.getByText("Loading AI configuration…")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("exposes retry and disables it while the failed query is refetching", () => {
    mocks.useQuery.mockReturnValue(
      queryResult({ isError: true, isFetching: false }),
    );

    const { rerender } = render(<AiProviderCard />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to load AI configuration.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);

    mocks.useQuery.mockReturnValue(
      queryResult({ isError: true, isFetching: true }),
    );
    rerender(<AiProviderCard />);

    expect(screen.getByRole("button", { name: "Retrying…" })).toBeDisabled();
  });

  it.each([
    ["queued", 1500],
    ["running", 1500],
    ["completed", false],
  ] as const)(
    "uses the expected polling interval for %s executions",
    (state, expected) => {
      mocks.useQuery.mockReturnValue(queryResult({ isLoading: true }));

      render(<AiProviderCard />);

      const options = mocks.useQuery.mock.calls.at(-1)?.[0] as
        QueryOptions | undefined;
      const refetchInterval = options?.refetchInterval;

      expect(refetchInterval).toBeTypeOf("function");
      expect(
        refetchInterval?.({
          state: { data: dataWithExecutionState(state) },
        }),
      ).toBe(expected);
    },
  );
});
