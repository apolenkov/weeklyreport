import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  close: vi.fn(),
  isInitialized: vi.fn(),
}));

vi.mock("@sentry/nestjs", () => sentry);

import { handleBootFailure } from "./boot-failure.js";

beforeEach(() => {
  vi.restoreAllMocks();
  sentry.captureException.mockReset();
  sentry.close.mockReset().mockResolvedValue(true);
  sentry.isInitialized.mockReset().mockReturnValue(true);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("handleBootFailure", () => {
  it("captures the boot failure in Sentry before the Sentry flush", async () => {
    const exit = vi.fn();
    const failure = new Error("bootstrap broke");

    await handleBootFailure(failure, exit);

    expect(sentry.captureException).toHaveBeenCalledExactlyOnceWith(failure);
    expect(sentry.close).toHaveBeenCalledOnce();
    expect(sentry.captureException.mock.invocationCallOrder[0]).toBeLessThan(
      sentry.close.mock.invocationCallOrder[0] ?? 0,
    );
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("still drains and exits 1 when both capture and stderr write throw", async () => {
    sentry.captureException.mockImplementation(() => {
      throw new Error("capture broke");
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => {
      throw new Error("stderr broke");
    });
    const exit = vi.fn();

    await handleBootFailure(new Error("original"), exit);

    expect(sentry.close).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });
});
