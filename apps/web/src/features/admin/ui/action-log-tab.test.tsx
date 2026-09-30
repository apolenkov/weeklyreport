// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { AdminActionLogEvent } from "@customreport/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { AdminUserView } from "../model/admin-types";
import { ActionLogTab } from "./action-log-tab";

interface ActionLogPage {
  readonly items: readonly AdminActionLogEvent[];
  readonly nextCursor: string | null;
}

interface ActionLogInput {
  readonly limit: number;
  readonly cursor?: string | undefined;
  readonly direction: "forward";
}

function event(id: string, userId: string): AdminActionLogEvent {
  return {
    id,
    createdAt: "2026-08-14T10:15:30.000Z",
    userId,
    role: "admin",
    procedure: "admin.updateUser",
    targetId: `${id}-target`,
    status: "success",
    reason: null,
    ip: "127.0.0.1",
    correlationId: `${id}-request`,
    durationMs: 18,
  };
}

function renderTab(
  query: (input: ActionLogInput) => Promise<ActionLogPage>,
  users?: readonly Pick<AdminUserView, "id" | "name">[],
) {
  const { proxy } = createMockTRPC([
    { path: ["admin", "actionLog", "list"], query },
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  return render(<ActionLogTab users={users} />, { wrapper: Wrapper });
}

describe("ActionLogTab pagination", () => {
  it("uses already-loaded actor names and keeps unknown actors identifiable", async () => {
    renderTab(
      () =>
        Promise.resolve({
          items: [event("first", "known-id"), event("second", "unknown-id")],
          nextCursor: null,
        }),
      [{ id: "known-id", name: "Alice Ivanova" }],
    );
    const user = userEvent.setup();

    expect(await screen.findByText("2 loaded")).toBeInTheDocument();
    expect(screen.getByText("Alice Ivanova")).toBeInTheDocument();
    expect(screen.getByText("unknown-id")).toBeInTheDocument();
    const scrollRegion = screen.getByRole("region", {
      name: "Action log table",
    });
    expect(scrollRegion).toHaveAccessibleDescription(
      "Scroll horizontally to see status and details.",
    );

    await user.type(
      screen.getByRole("searchbox", { name: "Search loaded actions" }),
      "alice",
    );
    expect(screen.getByText("1 matches · 2 loaded")).toBeInTheDocument();
    expect(screen.getByText("Alice Ivanova")).toBeInTheDocument();
    expect(screen.queryByText("unknown-id")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Show action details" }),
    );
    expect(
      screen.getByRole("region", { name: "Action details for first" }),
    ).toHaveTextContent("known-id");
  });
  it("distinguishes loaded rows from visible matches and updates the loaded count", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      event(
        `event-${index + 1}`,
        index < 2 ? `matching-user-${index + 1}` : `other-user-${index + 1}`,
      ),
    );
    const nextPage = event("event-21", "next-page-user");
    const list = (input: ActionLogInput): Promise<ActionLogPage> =>
      Promise.resolve(
        input.cursor === "cursor-2"
          ? { items: [nextPage], nextCursor: null }
          : { items: firstPage, nextCursor: "cursor-2" },
      );
    renderTab(list);
    const user = userEvent.setup();

    expect(await screen.findByText("20 loaded+")).toBeInTheDocument();
    const search = screen.getByRole("searchbox", {
      name: "Search loaded actions",
    });

    await user.type(search, "matching-user");
    expect(screen.getByText("2 matches · 20 loaded+")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "no-such-action");
    expect(screen.getByText("0 matches · 20 loaded+")).toBeInTheDocument();
    expect(
      screen.getByText("No loaded actions match the search."),
    ).toBeInTheDocument();

    await user.clear(search);
    expect(screen.getByText("20 loaded+")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("21 loaded")).toBeInTheDocument();
    expect(screen.getByText("next-page-user")).toBeInTheDocument();
  });

  it("requests the real cursor with limit 20, appends the page, then searches all loaded rows", async () => {
    const first = event("first", "first-user");
    const second = event("second", "second-user");
    const list = vi.fn((input: ActionLogInput): Promise<ActionLogPage> =>
      Promise.resolve(
        input.cursor === "cursor-2"
          ? { items: [second], nextCursor: null }
          : { items: [first], nextCursor: "cursor-2" },
      ),
    );
    renderTab(list);

    expect(await screen.findByText("first-user")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("second-user")).toBeInTheDocument();
    expect(screen.getByText("first-user")).toBeInTheDocument();
    expect(list).toHaveBeenNthCalledWith(1, {
      limit: 20,
      direction: "forward",
    });
    expect(list).toHaveBeenNthCalledWith(2, {
      limit: 20,
      cursor: "cursor-2",
      direction: "forward",
    });
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Search loaded actions" }),
      "second-user",
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("second-user")).toBeInTheDocument();
    expect(within(table).queryByText("first-user")).not.toBeInTheDocument();
  });

  it("retains loaded rows after a next-page failure and retries from Load more", async () => {
    const first = event("first", "first-user");
    const second = event("second", "second-user");
    let nextPageAttempts = 0;
    const list = vi.fn((input: ActionLogInput): Promise<ActionLogPage> => {
      if (input.cursor !== "cursor-2") {
        return Promise.resolve({ items: [first], nextCursor: "cursor-2" });
      }
      nextPageAttempts += 1;
      if (nextPageAttempts === 1) {
        return Promise.reject(new Error("page unavailable"));
      }
      return Promise.resolve({ items: [second], nextCursor: null });
    });
    renderTab(list);
    const user = userEvent.setup();

    expect(await screen.findByText("first-user")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));

    expect(screen.getByText("first-user")).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Load more" });
    expect(retry).toBeEnabled();

    await user.click(retry);
    expect(await screen.findByText("second-user")).toBeInTheDocument();
    expect(screen.getByText("first-user")).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(3);
    expect(list.mock.calls[2]?.[0]).toEqual({
      limit: 20,
      cursor: "cursor-2",
      direction: "forward",
    });
  });
});
