import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../lib/trpc-context";
import { GroupsTab } from "./groups-tab";
import type { MockGroup, MockUser } from "./mock-data";

// ----- mocks ---------------------------------------------------------

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// ----- fixtures ------------------------------------------------------

const USERS: MockUser[] = [
  {
    id: "u-head-1",
    name: "Alice Head",
    email: "alice@example.com",
    role: "head",
    groupId: "g-1",
    department: "Engineering",
    isActive: true,
  },
];

const GROUPS: MockGroup[] = [
  {
    id: "g-1",
    name: "Alpha Group",
    description: "First group",
    archived: false,
    headUserId: "u-head-1",
  },
  {
    id: "g-2",
    name: "Beta Group",
    description: null,
    archived: false,
    headUserId: null,
  },
];

// ----- tRPC test double ----------------------------------------------

function makeMockTRPC(opts: {
  saveMutationFn: ReturnType<typeof vi.fn>;
  archiveMutationFn: ReturnType<typeof vi.fn>;
}) {
  return {
    admin: {
      snapshot: { pathFilter: () => ({ queryKey: ["admin", "snapshot"] }) },
      saveReportingGroup: {
        pathFilter: () => ({ queryKey: ["admin", "saveReportingGroup"] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.saveMutationFn,
          onSuccess: mopts.onSuccess,
          onError: mopts.onError,
        }),
      },
      archiveReportingGroup: {
        pathFilter: () => ({ queryKey: ["admin", "archiveReportingGroup"] }),
        mutationOptions: (mopts: Record<string, unknown>) => ({
          mutationFn: opts.archiveMutationFn,
          onSuccess: mopts.onSuccess,
          onError: mopts.onError,
        }),
      },
    },
  } as never;
}

function renderTab(opts?: { groups?: MockGroup[]; users?: MockUser[] }) {
  const saveMutationFn = vi.fn().mockResolvedValue({ id: "g-new" });
  const archiveMutationFn = vi.fn().mockResolvedValue({ id: "g-1" });

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const trpc = makeMockTRPC({ saveMutationFn, archiveMutationFn });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={trpc}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  const result = render(
    <GroupsTab groups={opts?.groups ?? GROUPS} users={opts?.users ?? USERS} />,
    { wrapper: Wrapper },
  );

  return { ...result, saveMutationFn, archiveMutationFn };
}

/** Opens the Add Group dialog by clicking the header button. */
function openAddDialog() {
  const addBtn = screen.getByRole("button", { name: "Add group" });
  fireEvent.click(addBtn);
}

// ----- tests ---------------------------------------------------------

describe("GroupsTab — a11y regression (verify-a11y-recommended-flip)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dialog backdrop ARIA attributes", () => {
    it("backdrop outer div has role='presentation'", () => {
      renderTab();
      openAddDialog();

      const backdrop = screen.getByTestId("crud-sheet");
      expect(backdrop).toHaveAttribute("role", "presentation");
    });

    it("inner dialog div has role='dialog' and aria-modal='true'", () => {
      renderTab();
      openAddDialog();

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });
  });

  describe("Escape closes the dialog", () => {
    it("pressing Escape removes data-testid='crud-sheet' from the DOM", () => {
      renderTab();
      openAddDialog();

      expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
    });
  });

  describe("Cancel button closes the dialog", () => {
    it("clicking Cancel removes data-testid='crud-sheet' from the DOM", async () => {
      renderTab();
      openAddDialog();

      expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      await userEvent.click(cancelBtn);

      expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
    });
  });

  describe("backdrop click closes the dialog", () => {
    it("clicking the backdrop div removes data-testid='crud-sheet' from the DOM", async () => {
      renderTab();
      openAddDialog();

      expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

      const backdrop = screen.getByTestId("crud-sheet");
      await userEvent.click(backdrop);

      expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
    });
  });

  describe("clicking inside dialog does NOT close it (stopPropagation)", () => {
    it("clicking the role='dialog' element keeps data-testid='crud-sheet' in the DOM", async () => {
      renderTab();
      openAddDialog();

      expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

      const dialogPanel = screen.getByRole("dialog");
      await userEvent.click(dialogPanel);

      expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();
    });
  });
});
