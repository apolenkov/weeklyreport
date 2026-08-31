// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { NavLogoutButton } from "./nav-logout-button";

function renderWithQueryClient(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
}

describe("NavLogoutButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the shared responsive toolbar geometry", () => {
    renderWithQueryClient(<NavLogoutButton />);

    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveClass(
      "h-[var(--toolbar-control-h)]",
      "min-w-[var(--toolbar-control-h)]",
      "w-10",
    );
  });

  it("reports a rejected logout and keeps the current page", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<NavLogoutButton />);
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
    expect(screen.getByRole("button", { name: "Sign out" })).not.toBeDisabled();
  });

  it("allows only one logout transition while the request is pending", async () => {
    const logout = {
      reject: undefined as ((error: Error) => void) | undefined,
    };
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((_resolve, reject) => {
        logout.reject = reject;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithQueryClient(<NavLogoutButton />);
    const button = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(button).toBeDisabled();

    logout.reject?.(new Error("offline"));
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
