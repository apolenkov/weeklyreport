// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { NavLogoutButton } from "./nav-logout-button";

describe("NavLogoutButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a rejected logout and keeps the current page", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    render(<NavLogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Sign out failed. You are still signed in.",
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith("/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  });
});
