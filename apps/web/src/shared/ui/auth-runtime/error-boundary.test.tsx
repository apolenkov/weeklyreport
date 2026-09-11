// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QueryErrorBoundary } from "./error-boundary";

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => {
      toastError(...args);
    },
  },
}));

const thrower = { armed: true };
class BoomChild extends Component<{ readonly text: string }, object> {
  override render(): ReactNode {
    if (thrower.armed) {
      throw new Error("leaky-internal-detail");
    }
    return <div>{this.props.text}</div>;
  }
}

describe("QueryErrorBoundary", () => {
  beforeEach(() => {
    thrower.armed = true;
    toastError.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("does not leak the raw exception message into the fallback DOM", () => {
    render(
      <QueryErrorBoundary>
        <BoomChild text="child" />
      </QueryErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("We hit an error.");
    expect(alert.textContent).not.toContain("leaky-internal-detail");
  });

  it("does not leak the raw exception message into the toast", () => {
    render(
      <QueryErrorBoundary>
        <BoomChild text="child" />
      </QueryErrorBoundary>,
    );

    expect(toastError).toHaveBeenCalledWith(
      "The page hit an unexpected error.",
    );
    expect(toastError.mock.calls.join()).not.toContain("leaky-internal-detail");
  });

  it("offers a working recovery button that re-renders children", () => {
    render(
      <QueryErrorBoundary>
        <BoomChild text="child" />
      </QueryErrorBoundary>,
    );

    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry).toHaveAttribute("data-slot", "button");

    // Recovery path: the transient error clears (e.g. a refetch succeeded), so
    // resetting the boundary must re-render the children, not the fallback.
    thrower.armed = false;
    fireEvent.click(retry);
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
