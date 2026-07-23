/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub Sentry — server SDK is not available in jsdom.
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";

import ErrorBoundary from "./error";

function makeError(message = "Test error"): Error & { digest?: string } {
  return Object.assign(new Error(message), { digest: "abc123" });
}

describe("ErrorBoundary — error.tsx a11y", () => {
  it("button has explicit type='button'", () => {
    render(<ErrorBoundary error={makeError()} reset={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /try again/i });
    expect(btn).toHaveAttribute("type", "button");
  });

  it("button inner text content is 'Try again'", () => {
    render(<ErrorBoundary error={makeError()} reset={vi.fn()} />);
    const btn = screen.getByRole("button");
    expect(btn.textContent.replaceAll(/\s+/g, " ").trim()).toBe("Try again");
  });

  it("clicking the button invokes the reset callback", () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={makeError()} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("button is accessible via getByRole('button')", () => {
    render(<ErrorBoundary error={makeError()} reset={vi.fn()} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("Sentry.captureException is called with the error on mount", () => {
    const error = makeError("boom");
    render(<ErrorBoundary error={error} reset={vi.fn()} />);
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
  });
});
