// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AuthErrorPage from "./page";

async function renderPage(reason?: string | string[]) {
  render(
    await AuthErrorPage({
      searchParams: Promise.resolve(reason === undefined ? {} : { reason }),
    }),
  );
}

describe("AuthErrorPage — query parameters", () => {
  it("uses the message selected by a scalar reason", async () => {
    await renderPage("session_expired");
    expect(
      screen.getByText("Your session has expired. Please sign in again."),
    ).toBeInTheDocument();
  });

  it("ignores repeated reason values", async () => {
    await renderPage(["session_expired", "unauthorized"]);
    // R76: the fallback must add a next step, not repeat the heading.
    expect(screen.getByText(/contact your administrator/i)).toBeInTheDocument();
    expect(
      screen.queryByText("An authentication error occurred."),
    ).not.toBeInTheDocument();
  });

  it("uses the login page surface and wordmark (R78)", async () => {
    await renderPage();
    expect(screen.getByText("Weekly Report")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("bg-[var(--color-card)]");
  });
});
