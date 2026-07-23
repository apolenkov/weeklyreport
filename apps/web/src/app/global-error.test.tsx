/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Stub Sentry — server SDK is not available in jsdom.
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import GlobalError from "./global-error";

function makeError(message = "Test error"): Error & { digest?: string } {
  return Object.assign(new Error(message), { digest: "abc123" });
}

/** Parse static markup into a Document for structural assertions. */
function renderToDocument(
  error: Error & { digest?: string },
  reset: () => void,
): Document {
  const html = renderToStaticMarkup(
    <GlobalError error={error} reset={reset} />,
  );
  return new DOMParser().parseFromString(html, "text/html");
}

describe("GlobalError — global-error.tsx a11y", () => {
  it("html element has lang='en'", () => {
    const doc = renderToDocument(makeError(), vi.fn());
    expect(doc.documentElement.getAttribute("lang")).toBe("en");
  });

  it("button element has type='button'", () => {
    const doc = renderToDocument(makeError(), vi.fn());
    const btn = doc.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("type")).toBe("button");
  });

  it("clicking the button invokes the reset callback", () => {
    const reset = vi.fn();
    render(<GlobalError error={makeError()} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("body element is rendered", () => {
    const doc = renderToDocument(makeError(), vi.fn());
    expect(doc.body).not.toBeNull();
    expect(doc.body.tagName.toLowerCase()).toBe("body");
  });
});
