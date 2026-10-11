import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type {
  AdminGroupView,
  AdminProductView,
  AdminUserView,
} from "../model/admin-types";
import { GroupsTab } from "./groups-tab";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const PRODUCTS: AdminProductView[] = [
  {
    id: "p-1",
    name: "Checkout",
    leadOwnerId: "u-head-1",
    stages: [],
    status: "active",
  },
];

const USERS: AdminUserView[] = [
  {
    id: "u-head-1",
    name: "Alice Head",
    lastName: "Alice",
    firstName: "Head",
    middleName: null,
    position: null,
    email: "alice@example.com",
    role: "head",
    groupId: "g-1",
    department: "Engineering",
    isActive: true,
  },
];

const GROUPS: AdminGroupView[] = [
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

function renderTab(opts?: {
  groups?: AdminGroupView[];
  users?: AdminUserView[];
  products?: AdminProductView[];
}) {
  const { proxy, captured } = createMockTRPC([
    { path: ["admin", "snapshot"] },
    { path: ["admin", "saveReportingGroup"], mutation: true },
    { path: ["admin", "archiveReportingGroup"], mutation: true },
    { path: ["admin", "listGroupProducts"], query: [] },
    { path: ["admin", "listProductGroupOwnership"], query: [] },
    { path: ["admin", "attachProductToGroup"], mutation: true },
    { path: ["admin", "detachProductFromGroup"], mutation: true },
  ]);

  expectDefined(
    captured["admin.saveReportingGroup"],
  ).mutationFn.mockResolvedValue({
    id: "g-new",
  });
  expectDefined(
    captured["admin.archiveReportingGroup"],
  ).mutationFn.mockResolvedValue({
    id: "g-1",
  });

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <TRPCProxyContext.Provider value={proxy}>
          {children}
        </TRPCProxyContext.Provider>
      </QueryClientProvider>
    );
  }

  const result = render(
    <GroupsTab
      groups={opts?.groups ?? GROUPS}
      users={opts?.users ?? USERS}
      products={opts?.products ?? PRODUCTS}
    />,
    { wrapper: Wrapper },
  );

  return { ...result, captured };
}

function openAddDialog() {
  const addBtn = screen.getByRole("button", { name: "Add new group" });
  fireEvent.click(addBtn);
}

describe("GroupsTab — a11y regression", () => {
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

  it("marks the save button as mutation-required for runtime discovery", () => {
    renderTab();
    openAddDialog();

    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add group",
      }),
    ).toHaveAttribute("data-interaction-effect", "mutation-required");
  });

  it("bounds the dialog while keeping overflow inside its form body", () => {
    renderTab();
    openAddDialog();

    expect(screen.getByRole("dialog")).toHaveClass(
      "max-h-[90vh]",
      "overflow-hidden",
    );
    const body = screen.getByTestId("group-dialog-body");
    expect(body).toHaveClass("overflow-y-auto");
    // Chromium does not clip a scrolling <fieldset>; the scroll box must be a div.
    expect(body.tagName).toBe("DIV");
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

  it("keeps the dialog open on Escape and backdrop click while Save is pending", async () => {
    const { captured } = renderTab({ groups: [] });
    expectDefined(
      captured["admin.saveReportingGroup"],
    ).mutationFn.mockReturnValue(new Promise<never>(() => undefined));
    const user = userEvent.setup();

    openAddDialog();
    await user.type(screen.getByLabelText(/^name$/i), "Platform");
    await user.click(screen.getByRole("button", { name: "Add group" }));

    await screen.findByRole("button", { name: "Saving…" });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("crud-sheet"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("locks the submitted draft while pending and unlocks it unchanged after failure", async () => {
    const deferred = Promise.withResolvers<unknown>();
    const { captured } = renderTab({ groups: [] });
    expectDefined(
      captured["admin.saveReportingGroup"],
    ).mutationFn.mockReturnValue(deferred.promise);
    const user = userEvent.setup();

    openAddDialog();
    const name = screen.getByLabelText(/^name$/i);
    await user.type(name, "Platform");
    await user.click(screen.getByRole("button", { name: "Add group" }));

    await screen.findByRole("button", { name: "Saving…" });
    expect(name).toBeDisabled();
    await user.click(name);
    await user.keyboard("Unsent replacement");
    expect(name).toHaveValue("Platform");
    expect(
      expectDefined(captured["admin.saveReportingGroup"]).calls[0],
    ).toMatchObject({ name: "Platform" });

    act(() => deferred.reject(new Error("save failed")));
    await waitFor(() => expect(name).toBeEnabled());
    expect(name).toHaveValue("Platform");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("GroupsTab — focus management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("group-name input receives focus when the dialog opens (autoFocus)", () => {
    renderTab();
    openAddDialog();

    const input = screen.getByLabelText(/^name$/i);
    // React honours autoFocus on conditionally-mounted elements in jsdom;
    // dropping the autoFocus wiring in production code fails this assert.
    expect(input).toHaveFocus();
  });

  it("focus returns to the trigger button after the dialog closes via Cancel", () => {
    renderTab();
    const addBtn = screen.getByRole("button", { name: "Add new group" });
    addBtn.focus();
    fireEvent.click(addBtn);

    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(addBtn);
  });

  it("focus returns to the trigger button after the dialog closes via Escape", () => {
    renderTab();
    const addBtn = screen.getByRole("button", { name: "Add new group" });
    addBtn.focus();
    fireEvent.click(addBtn);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(addBtn);
  });
});

describe("GroupsTab — picker names", () => {
  it("uses the canonical short name in the leader picker", () => {
    renderTab();
    openAddDialog();

    const leaderPicker = screen.getByRole("combobox", { name: "Leader" });
    expect(
      within(leaderPicker).getByRole("option", {
        name: "Alice H. (alice@example.com)",
      }),
    ).toBeInTheDocument();
  });
});

describe("GroupsTab — last active group protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks last-active archiving while still saving a rename", async () => {
    const group = expectDefined(GROUPS[0]);
    const { captured } = renderTab({ groups: [group], products: [] });
    const user = userEvent.setup();
    expect(
      screen.queryByRole("button", { name: `Archive ${group.name}` }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: `Edit ${group.name}` }),
    );
    const archived = screen.getByRole("checkbox", { name: /^Archived/ });
    expect(archived).toBeDisabled();
    await user.click(archived);
    expect(archived).not.toBeChecked();
    const name = screen.getByLabelText(/^name$/i);
    await user.clear(name);
    await user.type(name, "Renamed group");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(
        expectDefined(captured["admin.saveReportingGroup"]).calls,
      ).toHaveLength(1),
    );
    expect(
      expectDefined(captured["admin.saveReportingGroup"]).calls[0],
    ).toMatchObject({
      id: group.id,
      name: "Renamed group",
      archived: false,
    });
  });

  it("allows restoring an archived group while only one other group is active", async () => {
    const archivedGroup = { ...expectDefined(GROUPS[1]), archived: true };
    const { captured } = renderTab({
      groups: [expectDefined(GROUPS[0]), archivedGroup],
      products: [],
    });
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by archive status" }),
      "archived",
    );
    await user.click(
      screen.getByRole("button", { name: `Edit ${archivedGroup.name}` }),
    );
    const archived = screen.getByRole("checkbox", { name: /^Archived/ });
    expect(archived).toBeEnabled();
    expect(archived).toBeChecked();
    await user.click(archived);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(
        expectDefined(captured["admin.saveReportingGroup"]).calls,
      ).toHaveLength(1),
    );
    expect(
      expectDefined(captured["admin.saveReportingGroup"]).calls[0],
    ).toMatchObject({
      id: archivedGroup.id,
      archived: false,
    });
  });

  it("uses the global active roster when search displays just one of two groups", async () => {
    const { captured } = renderTab({ products: [] });
    const group = expectDefined(GROUPS[0]);
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Search groups" }),
      "Alpha",
    );
    expect(
      screen.queryByRole("button", { name: "Edit Beta Group" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: `Edit ${group.name}` }),
    );
    const archived = screen.getByRole("checkbox", { name: /^Archived/ });
    expect(archived).toBeEnabled();
    await user.click(archived);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(
        expectDefined(captured["admin.saveReportingGroup"]).calls,
      ).toHaveLength(1),
    );
    expect(
      expectDefined(captured["admin.saveReportingGroup"]).calls[0],
    ).toMatchObject({ id: group.id, archived: true });
  });

  it.each([false, true])(
    "lets a checked stale draft be cleared against the current roster (initially archived: %s)",
    async (initiallyArchived) => {
      const { rerender, captured } = renderTab({
        groups: [
          { ...expectDefined(GROUPS[0]), archived: initiallyArchived },
          expectDefined(GROUPS[1]),
        ],
        products: [],
      });
      const user = userEvent.setup();
      if (initiallyArchived) {
        await user.selectOptions(
          screen.getByRole("combobox", { name: "Filter by archive status" }),
          "all",
        );
      }
      await user.click(
        screen.getByRole("button", { name: "Edit Alpha Group" }),
      );
      if (!initiallyArchived) {
        await user.click(screen.getByRole("checkbox", { name: /^Archived/ }));
      }
      rerender(
        <GroupsTab
          groups={[
            expectDefined(GROUPS[0]),
            { ...expectDefined(GROUPS[1]), archived: true },
          ]}
          users={USERS}
          products={[]}
        />,
      );
      const archived = screen.getByRole("checkbox", { name: /^Archived/ });
      expect(archived).toBeChecked();
      expect(archived).toBeEnabled();
      await user.click(archived);
      expect(archived).not.toBeChecked();
      expect(archived).toBeDisabled();
      await user.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() =>
        expect(
          expectDefined(captured["admin.saveReportingGroup"]).calls,
        ).toHaveLength(1),
      );
      expect(
        expectDefined(captured["admin.saveReportingGroup"]).calls[0],
      ).toMatchObject({ id: "g-1", archived: false });
    },
  );

  it("restricts an open dialog when the refreshed roster leaves only its group active", async () => {
    const { rerender } = renderTab({ products: [] });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit Alpha Group" }));
    expect(screen.getByRole("checkbox", { name: /^Archived/ })).toBeEnabled();
    rerender(
      <GroupsTab
        groups={[
          expectDefined(GROUPS[0]),
          { ...expectDefined(GROUPS[1]), archived: true },
        ]}
        users={USERS}
        products={[]}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /^Archived/ })).toBeDisabled();
    expect(screen.getByLabelText(/^name$/i)).toBeEnabled();
  });
});
