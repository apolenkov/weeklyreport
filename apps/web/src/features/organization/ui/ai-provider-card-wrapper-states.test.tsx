import type {
  AiProviderConfigurationRead,
  AiProviderControlRead,
} from "@customreport/shared";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useTRPC: vi.fn(),
  useAiProviderMutations: vi.fn(),
  useAiProviderMutationsInput: vi.fn(),
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

const dataWithPreparationState = (
  lifecycle: AiProviderConfigurationRead["lifecycle"],
  progress: Partial<
    AiProviderConfigurationRead["progress"] & { finishedAt: Date | null }
  >,
): AiProviderControlRead =>
  ({
    revisions: [
      {
        lifecycle,
        progress: {
          completed: 0,
          total: 0,
          failed: 0,
          elapsedMs: 0,
          finishedAt: null,
          ...progress,
        },
      },
    ],
  }) as unknown as AiProviderControlRead;

const validatedControl = (): AiProviderControlRead => {
  const finishedAt = new Date("2026-09-20T13:00:00.000Z");
  return {
    enabled: false,
    availability: "not_configured",
    runtimeFailure: null,
    activeRevisionId: null,
    profileCapabilities: [],
    active: null,
    revisions: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        lifecycle: "validated",
        generation: {
          profile: "mistral",
          baseUrl: "https://api.mistral.ai/v1",
          plannerModel: "planner",
          answerModel: "answer",
          reasoningMode: "provider_default",
          reasoningCustomValue: null,
          credentialConfigured: true,
          credentialMaskedSuffix: "••••test",
        },
        embeddings: {
          mode: "reuse_generation",
          model: "embed",
          dimensions: 3,
        },
        generationCompatibilityIdentity: "generation-identity",
        semanticInputVersion: "v1",
        testResult: null,
        latestExecution: null,
        progress: {
          completed: 0,
          total: 0,
          failed: 0,
          elapsedMs: 0,
          finishedAt,
        },
        createdAt: finishedAt,
        updatedAt: finishedAt,
        activatedAt: null,
      },
    ],
  };
};

describe("AiProviderCard wrapper states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useTRPC.mockReturnValue({
      admin: { aiProvider: { get: { queryOptions: mocks.queryOptions } } },
    });
    mocks.useAiProviderMutations.mockImplementation((input) => {
      mocks.useAiProviderMutationsInput(input);
      return mutations();
    });
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

  it.each([
    [
      "preparing with no discovered work",
      "preparing",
      { completed: 0, total: 0, failed: 0, finishedAt: null },
      1500,
    ],
    [
      "preparing with incomplete work",
      "preparing",
      { completed: 2, total: 5, failed: 0, finishedAt: null },
      1500,
    ],
    [
      "preparing after zero-work completion",
      "preparing",
      {
        completed: 0,
        total: 0,
        failed: 0,
        finishedAt: new Date("2026-09-20T13:00:00.000Z"),
      },
      false,
    ],
    [
      "failed preparation",
      "failed",
      {
        completed: 2,
        total: 5,
        failed: 1,
        finishedAt: new Date("2026-09-20T13:00:00.000Z"),
      },
      false,
    ],
    [
      "validated revision",
      "validated",
      { completed: 5, total: 5, failed: 0, finishedAt: null },
      false,
    ],
  ] as const)(
    "uses the expected polling interval for %s",
    (_name, lifecycle, progress, expected) => {
      mocks.useQuery.mockReturnValue(queryResult({ isLoading: true }));

      render(<AiProviderCard />);

      const options = mocks.useQuery.mock.calls.at(-1)?.[0] as
        QueryOptions | undefined;
      const refetchInterval = options?.refetchInterval;

      expect(refetchInterval).toBeTypeOf("function");
      expect(
        refetchInterval?.({
          state: {
            data: dataWithPreparationState(lifecycle, progress),
          },
        }),
      ).toBe(expected);
    },
  );

  it("polls when any revision still has unfinished preparation", () => {
    mocks.useQuery.mockReturnValue(queryResult({ isLoading: true }));

    render(<AiProviderCard />);

    const options = mocks.useQuery.mock.calls.at(-1)?.[0] as
      QueryOptions | undefined;
    const refetchInterval = options?.refetchInterval;

    expect(refetchInterval).toBeTypeOf("function");
    expect(
      refetchInterval?.({
        state: {
          data: {
            revisions: [
              dataWithPreparationState("failed", {
                completed: 5,
                total: 5,
                failed: 1,
                finishedAt: new Date("2026-09-20T13:00:00.000Z"),
              }).revisions[0],
              dataWithPreparationState("preparing", {
                completed: 2,
                total: 5,
                failed: 0,
                finishedAt: null,
              }).revisions[0],
            ],
          } as AiProviderControlRead,
        },
      }),
    ).toBe(1500);
  });

  it("polls cached validated data while activation or restore is pending", () => {
    const validated = validatedControl();
    mocks.useQuery.mockReturnValue(queryResult({ data: validated }));

    const { rerender } = render(<AiProviderCard />);
    const interval = () => {
      const options = mocks.useQuery.mock.calls.at(-1)?.[0] as
        QueryOptions | undefined;
      return options?.refetchInterval?.({ state: { data: validated } });
    };
    const input = mocks.useAiProviderMutationsInput.mock.calls.at(-1)?.[0] as {
      onActivationPendingChange: (
        operation: "activate" | "restore",
        pending: boolean,
      ) => void;
    };

    expect(interval()).toBe(false);

    act(() => input.onActivationPendingChange("activate", true));
    rerender(<AiProviderCard />);
    expect(interval()).toBe(1500);

    act(() => input.onActivationPendingChange("restore", true));
    act(() => input.onActivationPendingChange("activate", false));
    rerender(<AiProviderCard />);
    expect(interval()).toBe(1500);

    act(() => input.onActivationPendingChange("restore", false));
    rerender(<AiProviderCard />);
    expect(interval()).toBe(false);
  });
});
