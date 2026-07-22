import { useQueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { installClientLogger } from "./client-logger";
import { useTRPC } from "./trpc-context";
import { TRPCProvider } from "./trpc-provider";

const providerMocks = vi.hoisted(() => ({
  installClientLogger: vi.fn<() => void>(),
  providerValues: vi.fn<(queryClient: unknown, trpc: unknown) => void>(),
  toasterProps: vi.fn<(props: Record<string, unknown>) => void>(),
  transportOptions: vi.fn<(options: unknown) => void>(),
}));

vi.mock("./client-logger", () => ({
  installClientLogger: providerMocks.installClientLogger,
}));

vi.mock("@customreport/ui/components/ui/sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    providerMocks.toasterProps(props);
    return <div data-testid="toaster" />;
  },
}));

vi.mock("@trpc/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@trpc/client")>();
  return {
    ...actual,
    httpBatchLink: (options: Parameters<typeof actual.httpBatchLink>[0]) => {
      providerMocks.transportOptions(options);
      return actual.httpBatchLink(options);
    },
  };
});

vi.mock("./trpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./trpc")>();
  return {
    ...actual,
    makeTRPCProxy: (
      queryClient: Parameters<typeof actual.makeTRPCProxy>[0],
    ) => {
      const trpc = actual.makeTRPCProxy(queryClient);
      providerMocks.providerValues(queryClient, trpc);
      return trpc;
    },
  };
});

function ContextConsumer() {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const providerValues = providerMocks.providerValues.mock.calls.at(-1);
  return (
    <div data-testid="provider-context">
      {String(
        queryClient === providerValues?.[0] && trpc === providerValues[1],
      )}
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("superjson Date roundtrip (smoke)", () => {
  it("serializes and deserializes Date objects identically", () => {
    const original = new Date("2026-04-25T10:00:00Z");
    const serialized = superjson.serialize({ d: original });
    const deserialized = superjson.deserialize<{ d: Date }>(serialized);
    expect(deserialized.d).toBeInstanceOf(Date);
    expect(deserialized.d.getTime()).toBe(original.getTime());
  });

  it("configures every HTTP transport with the Date-capable transformer", () => {
    render(
      <TRPCProvider>
        <div />
      </TRPCProvider>,
    );

    const transportOptions = providerMocks.transportOptions.mock.calls.map(
      ([options]) => options,
    );
    expect(transportOptions).toHaveLength(2);
    transportOptions.forEach((options) => {
      expect(options).toEqual(
        expect.objectContaining({ transformer: superjson }),
      );
    });
    const transformer = (
      transportOptions[0] as { transformer: typeof superjson }
    ).transformer;
    const original = new Date("2026-04-25T10:00:00Z");
    const restored = transformer.deserialize<{ date: Date }>(
      transformer.serialize({ date: original }),
    );
    expect(restored.date).toEqual(original);
  });
});

describe("TRPCProvider", () => {
  it("installs logging and provides query, tRPC, and toaster wiring", async () => {
    render(
      <TRPCProvider>
        <ContextConsumer />
      </TRPCProvider>,
    );

    await waitFor(() => expect(installClientLogger).toHaveBeenCalledOnce());
    expect(screen.getByTestId("provider-context")).toHaveTextContent("true");
    expect(screen.getByTestId("toaster")).toBeInTheDocument();
    expect(providerMocks.toasterProps).toHaveBeenCalledWith({
      duration: 5000,
      position: "top-center",
      richColors: true,
    });
  });
});
