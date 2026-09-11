// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Stub Sentry — server SDK is not available in jsdom.
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// global-error renders without the root layout, so it imports the app CSS
// itself; vitest cannot process the Tailwind stylesheet.
vi.mock("../styles/app.css", () => ({}));

import * as Sentry from "@sentry/nextjs";

import GlobalError from "./global-error";

function makeError(message = "Test error"): Error & { digest?: string } {
  return Object.assign(new Error(message), { digest: "abc123" });
}

describe("GlobalError — global-error.tsx", () => {
  it("renders a lang=en document with the failure announcement and recovery button", () => {
    const html = renderToStaticMarkup(
      <GlobalError error={makeError()} reset={vi.fn()} />,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.documentElement.getAttribute("lang")).toBe("en");
    const alert = doc.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Something went wrong");
    expect(alert?.textContent).toContain(
      "An unexpected error interrupted this page. Try again to continue.",
    );
    expect(alert?.textContent).not.toContain("Your data is safe");
    const btn = doc.querySelector("button");
    expect(btn?.getAttribute("type")).toBe("button");
  });

  it("clicking the recovery button invokes the reset callback", () => {
    const reset = vi.fn();
    const error = makeError();
    render(<GlobalError error={error} reset={reset} />, {
      container: document,
    });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(error);
  });
});
