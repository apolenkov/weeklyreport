import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReticleDev } from "./reticle-dev";

const install = vi.fn();

vi.mock("@reticlehq/react", () => ({
  install,
  registerCapabilities: vi.fn(),
  registerStore: vi.fn(),
  reticle: { connect: vi.fn() },
  tanstackQueryStore: vi.fn(),
}));

function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

describe("ReticleDev", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    install.mockClear();
    window.history.replaceState({}, "", "/print/report-1?jobId=job-1");
  });

  it("does not install Reticle on the worker-only print route", async () => {
    render(<ReticleDev />, { wrapper: Providers });
    await act(async () => {
      await import("@reticlehq/react");
    });

    expect(install).not.toHaveBeenCalled();
  });
});
