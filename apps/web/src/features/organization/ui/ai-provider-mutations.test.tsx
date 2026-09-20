import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useMutation: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mocks.useMutation,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess },
}));

import { useAiProviderMutations } from "./ai-provider-mutations";

interface MutationOptions {
  readonly onMutate?: () => void;
  readonly onSuccess?: (...args: unknown[]) => void;
  readonly onError?: (error: Error) => void;
}

const operationNames = [
  "save",
  "test",
  "activate",
  "disable",
  "restore",
  "discard",
] as const;

const createTrpc = (optionsByOperation: Map<string, MutationOptions>) => {
  const procedures = Object.fromEntries(
    operationNames.map((operation) => [
      operation,
      {
        mutationOptions: vi.fn((options: MutationOptions) => {
          optionsByOperation.set(operation, options);
          return options;
        }),
      },
    ]),
  );
  return { admin: { aiProvider: procedures } };
};

describe("useAiProviderMutations activation polling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMutation.mockImplementation((options: MutationOptions) => ({
      isError: false,
      isPending: false,
      mutate: vi.fn(),
      options,
    }));
  });

  it.each(["activate", "restore"] as const)(
    "marks %s as pending and refreshes on mutate and error",
    (operation) => {
      const optionsByOperation = new Map<string, MutationOptions>();
      const onActivationPendingChange = vi.fn();
      const refresh = vi.fn();

      renderHook(() =>
        useAiProviderMutations({
          trpc: createTrpc(optionsByOperation) as never,
          refresh,
          onActivationPendingChange,
          setSavedRevision: vi.fn(),
          setMessage: vi.fn(),
          setOperationFailed: vi.fn(),
        }),
      );

      const options = optionsByOperation.get(operation);
      expect(options).toBeDefined();

      act(() => options?.onMutate?.());
      expect(onActivationPendingChange).toHaveBeenLastCalledWith(
        operation,
        true,
      );
      expect(refresh).toHaveBeenCalledTimes(1);

      act(() => options?.onError?.(new Error("activation failed")));
      expect(onActivationPendingChange).toHaveBeenLastCalledWith(
        operation,
        false,
      );
      expect(refresh).toHaveBeenCalledTimes(2);
    },
  );

  it("clears activation pending on success", () => {
    const optionsByOperation = new Map<string, MutationOptions>();
    const onActivationPendingChange = vi.fn();
    const refresh = vi.fn();

    renderHook(() =>
      useAiProviderMutations({
        trpc: createTrpc(optionsByOperation) as never,
        refresh,
        onActivationPendingChange,
        setSavedRevision: vi.fn(),
        setMessage: vi.fn(),
        setOperationFailed: vi.fn(),
      }),
    );

    const options = optionsByOperation.get("activate");
    act(() => options?.onMutate?.());
    act(() => options?.onSuccess?.());

    expect(onActivationPendingChange).toHaveBeenNthCalledWith(
      1,
      "activate",
      true,
    );
    expect(onActivationPendingChange).toHaveBeenLastCalledWith(
      "activate",
      false,
    );
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
