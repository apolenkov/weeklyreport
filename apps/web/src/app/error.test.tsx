// @vitest-environment jsdom

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

describe("ErrorBoundary — error.tsx", () => {
  it("announces the failure and exposes one stable recovery button", () => {
    render(<ErrorBoundary error={makeError()} reset={vi.fn()} />);

    // role=alert makes the boundary an assertive live region for screen readers.
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "An unexpected error interrupted this page. Try again to continue.",
    );
    expect(screen.queryByText(/Your data is safe/i)).toBeNull();
    const btn = screen.getByRole("button", { name: "Try again" });
    expect(btn).toHaveAttribute("type", "button");
  });

  it("clicking the recovery button invokes the reset callback", () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={makeError()} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("reports the error to Sentry on mount", () => {
    const error = makeError("boom");
    render(<ErrorBoundary error={error} reset={vi.fn()} />);
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
  });

  it("uses the design system's Alert and Button rather than raw HTML", () => {
    render(<ErrorBoundary error={makeError()} reset={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-slot", "alert");
    expect(screen.getByRole("button", { name: "Try again" })).toHaveAttribute(
      "data-slot",
      "button",
    );
  });
});
