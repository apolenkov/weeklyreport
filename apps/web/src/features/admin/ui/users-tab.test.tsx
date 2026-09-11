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
import type { AdminGroupView, AdminUserView } from "../model/admin-types";
import { UsersTab } from "./users-tab";

// Mutation behavior is asserted through callbacks and UI state; toast output is
// stubbed so those assertions stay focused on the Users flow.
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function buildProxy() {
  return createMockTRPC([
    { path: ["admin", "saveUser"], mutation: true },
    { path: ["admin", "deleteUser"], mutation: true },
    { path: ["admin", "deactivateUser"], mutation: true },
    { path: ["admin", "activateUser"], mutation: true },
    { path: ["admin", "snapshot"] },
    { path: ["admin", "getSettings"] },
    { path: ["admin", "getOrganization"] },
    { path: ["org", "getPublic"] },
    { path: ["auth", "me"] },
    { path: ["weeklyReport", "get"] },
  ]);
}

const GROUP: AdminGroupView = {
  id: "g1",
  name: "Alpha",
  description: null,
  archived: false,
  headUserId: null,
};

const USER: AdminUserView = {
  id: "u1",
  name: "Ivanova Alice",
  lastName: "Ivanova",
  firstName: "Alice",
  middleName: null,
  position: "Team Lead",
  email: "alice@example.com",
  role: "lead",
  groupId: "g1",
  department: "Alpha",
  isActive: true,
};

function renderTab(
  users: AdminUserView[] = [USER],
  groups: AdminGroupView[] = [GROUP],
) {
  const { proxy, captured } = buildProxy();
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

  render(<UsersTab users={users} groups={groups} />, { wrapper: Wrapper });
  return { qc, captured, proxy };
}

function openDialog() {
  const addBtn = screen.getByRole("button", { name: /add new user/i });
  fireEvent.click(addBtn);
}

describe("UsersTab — dialog keyboard and click behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pressing Escape removes the dialog from the DOM", () => {
    renderTab();

    openDialog();
    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
  });

  it("clicking Cancel removes the dialog from the DOM", () => {
    renderTab();

    openDialog();
    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
  });

  it("clicking the backdrop div (data-testid=crud-sheet) removes the dialog from the DOM", () => {
    renderTab();

    openDialog();
    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("crud-sheet"));

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
  });

  it("clicking inside the dialog panel (role=dialog) does NOT remove the dialog", () => {
    renderTab();

    openDialog();
    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("dialog"));

    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();
  });

  it("keeps the dialog open on Escape and backdrop click while Save is pending", async () => {
    const { captured } = renderTab([], [GROUP]);
    expectDefined(captured["admin.saveUser"]).mutationFn.mockReturnValue(
      new Promise<never>(() => undefined),
    );
    const user = userEvent.setup();

    openDialog();
    await user.type(screen.getByLabelText(/^last name$/i), "Petrov");
    await user.type(screen.getByLabelText(/^first name$/i), "Ivan");
    await user.type(screen.getByLabelText(/^email$/i), "ivan@example.com");
    await user.click(screen.getByRole("button", { name: "Add User" }));

    await screen.findByRole("button", { name: "Saving…" });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("crud-sheet"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("locks the submitted draft while pending and unlocks it unchanged after failure", async () => {
    const deferred = Promise.withResolvers<unknown>();
    const { captured } = renderTab([], [GROUP]);
    const saveUser = expectDefined(captured["admin.saveUser"]);
    saveUser.mutationFn.mockReturnValue(deferred.promise);
    const user = userEvent.setup();

    openDialog();
    const lastName = screen.getByLabelText(/^last name$/i);
    await user.type(lastName, "Petrov");
    await user.type(screen.getByLabelText(/^first name$/i), "Ivan");
    await user.type(screen.getByLabelText(/^email$/i), "ivan@example.com");
    await user.click(screen.getByRole("button", { name: "Add User" }));

    await screen.findByRole("button", { name: "Saving…" });
    expect(lastName).toBeDisabled();
    await user.click(lastName);
    await user.keyboard("Unsent replacement");
    expect(lastName).toHaveValue("Petrov");
    expect(saveUser.calls[0]).toMatchObject({ lastName: "Petrov" });

    act(() => deferred.reject(new Error("save failed")));
    await waitFor(() => expect(lastName).toBeEnabled());
    expect(lastName).toHaveValue("Petrov");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the long user form scrollable inside the viewport", () => {
    renderTab();

    openDialog();

    expect(screen.getByRole("dialog")).toHaveClass(
      "max-h-[90vh]",
      "overflow-hidden",
    );
    expect(
      screen.getByLabelText(/^last name$/i).parentElement?.parentElement,
    ).toHaveClass("overflow-y-auto");
  });

  it("submits exactly once from Enter in a valid field", async () => {
    const { captured } = renderTab([], [GROUP]);
    const saveUser = expectDefined(captured["admin.saveUser"]);
    saveUser.mutationFn.mockResolvedValue(undefined);
    const user = userEvent.setup();

    openDialog();
    await user.type(screen.getByLabelText(/^last name$/i), "Petrov");
    await user.type(screen.getByLabelText(/^first name$/i), "Ivan");
    await user.type(screen.getByLabelText(/^email$/i), "ivan@example.com");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(saveUser.mutationFn).toHaveBeenCalledOnce());
  });

  it("validates email on blur and exposes the error to assistive technology", async () => {
    renderTab();
    const user = userEvent.setup();

    openDialog();
    const email = screen.getByLabelText<HTMLInputElement>(/^email$/i);
    await user.type(email, "not-an-email");
    await user.tab();

    expect(email).toHaveAttribute("name", "email");
    expect(email).toHaveAttribute("autocomplete", "email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAttribute("aria-describedby", "user-email-error");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address.",
    );
  });
});

describe("UsersTab — invalidation contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Save user invalidates admin.getOrganization by its specific queryKey", async () => {
    const { qc, captured, proxy } = renderTab([], [GROUP]);
    expectDefined(captured["admin.saveUser"]).mutationFn.mockResolvedValue(
      undefined,
    );
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    openDialog();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^last name$/i), "Petrov");
    await user.type(screen.getByLabelText(/^first name$/i), "Ivan");
    await user.type(screen.getByLabelText(/email/i), "new@example.com");

    await user.click(screen.getByRole("button", { name: /^add user$/i }));

    const organizationFilter = proxy.admin.getOrganization.pathFilter();
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(organizationFilter);
    });
  });
});

describe("UsersTab — group change confirmation", () => {
  it("keeps the only selected owning group visible but not editable", () => {
    renderTab([], [GROUP]);
    openDialog();

    const groupSelect = screen.getByLabelText(/owning group/i);
    expect(groupSelect).toBeDisabled();
    expect(groupSelect).toHaveValue(GROUP.id);
    expect(
      within(groupSelect).getByRole("option", { name: GROUP.name }),
    ).toBeInTheDocument();
  });

  it("defers the save mutation until the shared dialog is confirmed", async () => {
    const otherGroup: AdminGroupView = {
      ...GROUP,
      id: "g2",
      name: "Beta",
    };
    const { captured } = renderTab([USER], [GROUP, otherGroup]);
    const saveUser = expectDefined(captured["admin.saveUser"]);
    saveUser.mutationFn.mockResolvedValue(undefined);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /edit ivanova alice/i }),
    );
    await user.selectOptions(screen.getByLabelText(/owning group/i), "g2");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    const confirm = screen.getByRole("alertdialog", {
      name: /change this user's group/i,
    });
    expect(saveUser.mutationFn).not.toHaveBeenCalled();

    await user.click(
      within(confirm).getByRole("button", { name: /change group/i }),
    );

    await waitFor(() =>
      expect(saveUser.mutationFn).toHaveBeenCalledWith(
        expect.objectContaining({ reportingGroupId: "g2", id: USER.id }),
        expect.anything(),
      ),
    );
  });

  it("gives the nested confirmation exclusive Tab and first-Escape ownership", async () => {
    const otherGroup: AdminGroupView = {
      ...GROUP,
      id: "g2",
      name: "Beta",
    };
    const { captured } = renderTab([USER], [GROUP, otherGroup]);
    const saveUser = expectDefined(captured["admin.saveUser"]);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /edit ivanova alice/i }),
    );
    const lastName = screen.getByLabelText(/^last name$/i);
    await user.clear(lastName);
    await user.type(lastName, "Petrova");
    await user.selectOptions(screen.getByLabelText(/owning group/i), "g2");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    const confirmation = screen.getByRole("alertdialog", {
      name: /change this user's group/i,
    });
    const cancel = within(confirmation).getByRole("button", {
      name: /cancel/i,
    });
    const confirm = within(confirmation).getByRole("button", {
      name: /change group/i,
    });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(saveUser.mutationFn).not.toHaveBeenCalled();

    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("alertdialog", {
        name: /change this user's group/i,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /edit user/i })).toBeVisible();
    expect(screen.getByLabelText(/^last name$/i)).toHaveValue("Petrova");
    expect(screen.getByLabelText(/owning group/i)).toHaveValue("g2");
    expect(saveUser.mutationFn).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: /edit user/i }),
    ).not.toBeInTheDocument();
    expect(saveUser.mutationFn).not.toHaveBeenCalled();
  });

  it("assigns the only active group when a groupless viewer becomes a lead", async () => {
    const viewer: AdminUserView = {
      ...USER,
      role: "viewer",
      groupId: null,
      department: "No owning group",
    };
    const { captured } = renderTab([viewer], [GROUP]);
    const saveUser = expectDefined(captured["admin.saveUser"]);
    saveUser.mutationFn.mockResolvedValue(undefined);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /edit ivanova alice/i }),
    );
    await user.selectOptions(screen.getByLabelText(/^role$/i), "lead");

    const groupSelect = screen.getByLabelText(/owning group/i);
    expect(groupSelect).toBeDisabled();
    expect(groupSelect).toHaveValue(GROUP.id);

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    const confirm = screen.getByRole("alertdialog", {
      name: /change this user's group/i,
    });
    await user.click(
      within(confirm).getByRole("button", { name: /change group/i }),
    );

    await waitFor(() =>
      expect(saveUser.mutationFn).toHaveBeenCalledWith(
        expect.objectContaining({
          id: viewer.id,
          role: "lead",
          reportingGroupId: GROUP.id,
        }),
        expect.anything(),
      ),
    );
  });

  it("keeps an archived selected group visible while allowing a switch to an active group", async () => {
    const archivedGroup: AdminGroupView = {
      ...GROUP,
      id: "g-archived",
      name: "Legacy",
      archived: true,
    };
    const archivedUser: AdminUserView = {
      ...USER,
      groupId: archivedGroup.id,
      department: archivedGroup.name,
    };
    renderTab([archivedUser], [GROUP, archivedGroup]);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: /edit ivanova alice/i }),
    );

    const groupSelect = screen.getByLabelText(/owning group/i);
    expect(groupSelect).toBeEnabled();
    expect(groupSelect).toHaveValue(archivedGroup.id);
    expect(
      within(groupSelect).getByRole("option", {
        name: `${archivedGroup.name} (archived)`,
      }),
    ).toBeInTheDocument();

    await user.selectOptions(groupSelect, GROUP.id);

    expect(groupSelect).toHaveValue(GROUP.id);
  });
});

describe("UsersTab — focus management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("last-name input receives focus when the dialog opens", () => {
    renderTab();
    openDialog();

    const input = screen.getByLabelText(/^last name$/i);
    // The shared dialog focus hook targets the first enabled form control.
    expect(input).toHaveFocus();
  });

  it("focus returns to the trigger button after the dialog closes via Cancel", () => {
    renderTab();
    const addBtn = screen.getByRole("button", { name: /add new user/i });
    addBtn.focus();
    fireEvent.click(addBtn);

    expect(screen.getByTestId("crud-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(addBtn);
  });

  it("focus returns to the trigger button after the dialog closes via Escape", () => {
    renderTab();
    const addBtn = screen.getByRole("button", { name: /add new user/i });
    addBtn.focus();
    fireEvent.click(addBtn);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("crud-sheet")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(addBtn);
  });
});

describe("UsersTab — delete modal focus management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function openDeleteModal() {
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", {
      name: /more actions for ivanova alice/i,
    });
    trigger.focus();
    await user.click(trigger);
    expect(screen.getByRole("menu", { name: /more actions/i })).toHaveAttribute(
      "aria-label",
      "User actions",
    );
    await user.click(screen.getByRole("menuitem", { name: /delete user/i }));
    return trigger;
  }

  it("discovers Delete through overflow and restores focus after Escape", async () => {
    renderTab();
    expect(
      screen.queryByRole("button", { name: /delete ivanova alice/i }),
    ).not.toBeInTheDocument();
    const trigger = await openDeleteModal();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("closes on backdrop click and restores focus to the overflow trigger", async () => {
    renderTab();
    const trigger = await openDeleteModal();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    const backdrop = document.querySelector('[data-slot="dialog-overlay"]');
    expect(backdrop).not.toBeNull();
    if (!backdrop) return;
    await userEvent.click(backdrop);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("does NOT close when clicking inside the modal (stopPropagation)", async () => {
    renderTab();
    await openDeleteModal();

    fireEvent.click(screen.getByRole("alertdialog"));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("keeps routine actions inline and gives every row action a 40px target", () => {
    renderTab();
    const row = screen.getByText(USER.email).closest("tr");
    expect(row).not.toBeNull();
    const actions = [
      within(row as HTMLElement).getByRole("button", {
        name: /edit ivanova alice/i,
      }),
      within(row as HTMLElement).getByRole("button", {
        name: /deactivate ivanova alice/i,
      }),
      within(row as HTMLElement).getByRole("button", {
        name: /more actions for ivanova alice/i,
      }),
    ];

    actions.forEach((action) => {
      expect(action).toHaveClass("h-10", "min-w-10");
    });
    expect(actions[0]?.parentElement).toHaveClass("flex-wrap");
  });

  it("uses the existing delete mutation after confirmation", async () => {
    const { captured } = renderTab();
    const deleteUser = expectDefined(captured["admin.deleteUser"]);
    deleteUser.mutationFn.mockResolvedValue(undefined);
    await openDeleteModal();

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteUser.mutationFn).toHaveBeenCalledWith(
        { userId: USER.id },
        expect.anything(),
      );
    });
  });
});

describe("UsersTab — role label rendering", () => {
  it("contains the wide table in its local horizontal scroll surface", () => {
    renderTab();

    expect(screen.getByTestId("users-table").parentElement).toHaveClass(
      "relative",
      "overflow-x-auto",
    );
  });

  it("renders the head role's badge with the shared label, not the raw token", () => {
    const headUser: AdminUserView = { ...USER, id: "u2", role: "head" };
    renderTab([headUser]);

    const row = screen.getByText(headUser.email).closest("tr");
    expect(row).not.toBeNull();
    const badge = within(row as HTMLElement).getByText(/^Head$/);
    expect(badge.textContent).toBe("Head");
  });

  it("uses semantic muted tokens for the inactive badge", () => {
    const inactiveUser: AdminUserView = {
      ...USER,
      id: "u3",
      isActive: false,
    };
    renderTab([inactiveUser]);
    fireEvent.change(screen.getByLabelText("Filter by status"), {
      target: { value: "inactive" },
    });

    const row = screen.getByText(inactiveUser.email).closest("tr");
    expect(row).not.toBeNull();
    const badge = within(row as HTMLElement).getByText("inactive");
    expect(badge).toHaveClass(
      "bg-[var(--color-muted)]",
      "text-[var(--color-muted-foreground)]",
    );
  });
});
