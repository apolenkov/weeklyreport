// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CorrelationCell } from "./action-log-correlation-cell";

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => {
      toastError(...args);
    },
  },
}));

const copyToClipboard = vi.fn();
vi.mock("../model/action-log-format", () => ({
  copyToClipboard: (...args: unknown[]) => {
    return copyToClipboard(...args) as Promise<boolean>;
  },
  truncate: (value: string) => value,
}));

describe("CorrelationCell", () => {
  beforeEach(() => {
    toastError.mockClear();
    copyToClipboard.mockReset();
    vi.useRealTimers();
  });

  it("shows copied feedback on a successful copy", async () => {
    copyToClipboard.mockResolvedValue(true);
    render(<CorrelationCell value="req-123" />);

    fireEvent.click(screen.getByRole("button", { name: /copy reference id/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Copied");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("surfaces a failed copy instead of staying silent", async () => {
    copyToClipboard.mockResolvedValue(false);
    render(<CorrelationCell value="req-123" />);

    fireEvent.click(screen.getByRole("button", { name: /copy reference id/i }));
    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("Copy failed"),
      );
    });
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });

  it("clears the feedback timer on unmount", async () => {
    copyToClipboard.mockResolvedValue(true);
    vi.useFakeTimers();
    const { unmount } = render(<CorrelationCell value="req-123" />);

    fireEvent.click(screen.getByRole("button", { name: /copy reference id/i }));
    unmount();

    // If the timer leaked, it would fire setState on an unmounted component.
    await vi.advanceTimersByTimeAsync(2000);
    expect(() => unmount()).not.toThrow();
  });
});
