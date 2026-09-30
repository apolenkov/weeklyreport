import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerPush = vi.fn();
const useQueryMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown): unknown => useQueryMock(options) as unknown,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));
vi.mock("../../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    admin: {
      dlqCount: {
        queryOptions: () => ({ queryKey: ["admin", "dlqCount"] }),
      },
      pendingReopenCount: {
        queryOptions: (_input: unknown, options: Record<string, unknown>) => ({
          queryKey: ["admin", "pendingReopenCount"],
          ...options,
        }),
      },
    },
  }),
}));

import { ReopenTabLabel } from "../../../review";
import { AdminTabsMobileSelect } from "../admin-tabs-mobile-select";
import { JobsTabLabel } from "../jobs-tab-label";

interface QueryOptions {
  readonly queryKey: readonly unknown[];
}

function hasQueryKey(options: unknown): options is QueryOptions {
  return (
    typeof options === "object" &&
    options !== null &&
    "queryKey" in options &&
    Array.isArray(options.queryKey)
  );
}

function countForQuery(options: unknown): number {
  if (!hasQueryKey(options)) return 0;
  return options.queryKey.includes("pendingReopenCount") ? 3 : 2;
}

function queryOptionsCalls(): readonly unknown[] {
  return (
    useQueryMock.mock.calls as unknown as readonly (readonly [unknown])[]
  ).map(([options]) => options);
}

describe("AdminTabsMobileSelect", () => {
  beforeEach(() => {
    routerPush.mockReset();
    useQueryMock.mockReset();
    useQueryMock.mockReturnValue({ data: { count: 0 } });
  });

  it("exposes every canonical destination in order", () => {
    render(<AdminTabsMobileSelect activeTab="settings" />);

    const picker = screen.getByRole<HTMLSelectElement>("combobox", {
      name: "Admin tab",
    });
    const options = within(picker).getAllByRole<HTMLOptionElement>("option");

    expect(options.map((option) => option.value)).toEqual([
      "users",
      "groups",
      "products",
      "activities",
      "periods",
      "reminders",
      "reopen",
      "jobs",
      "actions",
      "ai",
      "settings",
    ]);
    expect(picker.value).toBe("settings");
  });

  it("navigates through the client router", () => {
    render(<AdminTabsMobileSelect activeTab="users" />);

    fireEvent.change(screen.getByRole("combobox", { name: "Admin tab" }), {
      target: { value: "actions" },
    });

    expect(routerPush).toHaveBeenCalledWith("/admin?tab=actions");
  });

  it("owns the compact breakpoint and token-driven focus treatment", () => {
    render(<AdminTabsMobileSelect activeTab="users" />);

    expect(screen.getByRole("combobox", { name: "Admin tab" })).toHaveClass(
      "lg:hidden",
      "focus-visible:ring-2",
      "focus-visible:ring-[var(--color-ring)]",
      "focus-visible:ring-offset-2",
    );
  });

  it("renders no alert navigation when both operational counts are zero", () => {
    render(<AdminTabsMobileSelect activeTab="users" />);

    expect(
      screen.queryByRole("navigation", { name: "Admin alerts" }),
    ).not.toBeInTheDocument();
  });

  it("shows unavailable alerts when either operational count query fails", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      /* expected client error telemetry */
    });
    useQueryMock.mockReturnValue({
      data: undefined,
      error: new Error("unavailable"),
      isError: true,
    });

    try {
      render(<AdminTabsMobileSelect activeTab="users" />);

      const alerts = screen.getByRole("navigation", { name: "Admin alerts" });
      expect(screen.getByRole("link", { name: /reopen/i })).toHaveAttribute(
        "href",
        "/admin?tab=reopen",
      );
      expect(screen.getByTestId("mobile-reopen-tab-count")).toHaveTextContent(
        "Pending reopen count unavailable",
      );
      expect(
        screen.getByText("Pending reopen count unavailable"),
      ).not.toHaveClass("sr-only");
      expect(
        screen.getByRole("link", { name: "Failed job count unavailable" }),
      ).toHaveAttribute("href", "/admin?tab=jobs");
      expect(screen.getByTestId("mobile-jobs-tab-count")).toHaveTextContent(
        "Failed job count unavailable",
      );
      expect(screen.getByText("Failed job count unavailable")).not.toHaveClass(
        "sr-only",
      );
      expect(alerts).toHaveClass("lg:hidden");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("links both non-zero counts to canonical responsive destinations", () => {
    useQueryMock.mockImplementation((options: unknown) => ({
      data: { count: countForQuery(options) },
    }));

    render(<AdminTabsMobileSelect activeTab="users" />);

    const alerts = screen.getByRole("navigation", { name: "Admin alerts" });
    expect(alerts).toHaveClass("lg:hidden");
    expect(screen.getByRole("link", { name: /reopen/i })).toHaveAttribute(
      "href",
      "/admin?tab=reopen",
    );
    expect(screen.getByText("3 pending reopen requests")).not.toHaveClass(
      "sr-only",
    );
    expect(screen.getByRole("link", { name: /jobs/i })).toHaveAttribute(
      "href",
      "/admin?tab=jobs",
    );
    expect(screen.getByText("2 failed jobs in DLQ")).not.toHaveClass("sr-only");
    expect(within(alerts).queryByText("2", { exact: true })).toBeNull();
    for (const link of within(alerts).getAllByRole("link")) {
      expect(link).toHaveClass(
        "focus-visible:ring-2",
        "focus-visible:ring-[var(--color-ring)]",
        "focus-visible:ring-offset-2",
      );
    }
  });

  it("describes one pending reopen request in the visible destination", () => {
    useQueryMock.mockImplementation((options: unknown) => ({
      data: {
        count:
          hasQueryKey(options) &&
          options.queryKey.includes("pendingReopenCount")
            ? 1
            : 0,
      },
    }));

    render(<AdminTabsMobileSelect activeTab="users" />);

    const link = screen.getByRole("link", {
      name: "1 pending reopen request",
    });
    expect(link).toHaveAttribute("href", "/admin?tab=reopen");
    expect(within(link).getByText("1 pending reopen request")).not.toHaveClass(
      "sr-only",
    );
    expect(within(link).queryByText("1", { exact: true })).toBeNull();
  });

  it("describes one failed job in the visible destination", () => {
    useQueryMock.mockImplementation((options: unknown) => ({
      data: {
        count:
          hasQueryKey(options) && options.queryKey.includes("dlqCount") ? 1 : 0,
      },
    }));

    render(<AdminTabsMobileSelect activeTab="users" />);

    const link = screen.getByRole("link", { name: "1 failed job in DLQ" });
    expect(link).toHaveAttribute("href", "/admin?tab=jobs");
    expect(within(link).getByText("1 failed job in DLQ")).not.toHaveClass(
      "sr-only",
    );
    expect(within(link).queryByText("1", { exact: true })).toBeNull();
  });

  it("shares operational query identity and refresh semantics with the wide labels", () => {
    useQueryMock.mockReturnValue({ data: { count: 0 } });

    render(<AdminTabsMobileSelect activeTab="users" />);
    const [compactReopen, compactDlq] = queryOptionsCalls();

    useQueryMock.mockClear();
    render(<ReopenTabLabel />);
    const [wideReopen] = queryOptionsCalls();

    useQueryMock.mockClear();
    render(<JobsTabLabel />);
    const [wideDlq] = queryOptionsCalls();

    expect(compactReopen).toMatchObject({
      queryKey: ["admin", "pendingReopenCount"],
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    });
    expect(compactReopen).toEqual(wideReopen);
    expect(compactDlq).toMatchObject({
      queryKey: ["admin", "dlqCount"],
      refetchInterval: 30_000,
    });
    expect(compactDlq).toEqual(wideDlq);
  });
});
