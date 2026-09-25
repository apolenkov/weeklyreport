// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { useQuery } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeQueryState } from "../../../test-utils/query-state";
import type { AdminTab } from "../model/admin-tab-dependencies";
import { AdminPanel } from "./admin-panel";

vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    admin: {
      snapshot: {
        queryOptions: () => ({ queryKey: ["admin.snapshot"] }),
      },
      getSettings: {
        queryOptions: () => ({ queryKey: ["admin.getSettings"] }),
      },
    },
  }),
}));
vi.mock("./admin-panel-content", () => ({
  AdminPanelContent: () => null,
}));

interface QueryOptions {
  readonly enabled?: boolean;
  readonly queryKey: readonly string[];
}

function queryEnabled(key: string): boolean | undefined {
  const call = vi
    .mocked(useQuery)
    .mock.calls.find(
      ([options]) => (options as QueryOptions).queryKey[0] === key,
    );
  return (call?.[0] as QueryOptions | undefined)?.enabled;
}

describe("AdminPanel query gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue(makeQueryState({ data: undefined }));
  });

  it.each([
    ["users", true, false],
    ["groups", true, false],
    ["products", true, false],
    ["activities", true, false],
    ["periods", false, false],
    ["reminders", true, true],
    ["reopen", false, false],
    ["jobs", false, false],
    ["actions", false, false],
    ["ai", false, false],
    ["settings", false, true],
  ] as const)(
    "%s wires snapshot=%s and settings=%s into query options",
    (activeTab, snapshot, settings) => {
      render(<AdminPanel activeTab={activeTab} />);
      expect(queryEnabled("admin.snapshot")).toBe(snapshot);
      expect(queryEnabled("admin.getSettings")).toBe(settings);
    },
  );

  it("does not report disabled parent query errors", async () => {
    vi.mocked(useQuery).mockReturnValue(
      makeQueryState({
        data: undefined,
        error: new Error("must stay silent"),
      }),
    );

    render(<AdminPanel activeTab={"periods" satisfies AdminTab} />);

    await waitFor(() => expect(toast.error).not.toHaveBeenCalled());
  });

  it("reports enabled parent query errors", async () => {
    vi.mocked(useQuery).mockImplementation((options) => {
      const key = (options as QueryOptions).queryKey[0];
      return makeQueryState({
        data: undefined,
        error:
          key === "admin.snapshot" ? new Error("snapshot unavailable") : null,
      });
    });

    render(<AdminPanel activeTab={"users" satisfies AdminTab} />);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to load admin data: snapshot unavailable",
      ),
    );
  });
});
