import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AdminUserView } from "../model/admin-types";
import { UsersTable } from "./users-table";

const USER: AdminUserView = {
  id: "user-1",
  name: "Ivanova Alice",
  lastName: "Ivanova",
  firstName: "Alice",
  middleName: null,
  email: "alice.with.a.long.email.address@example.com",
  position: "Engineering Team Lead",
  role: "lead",
  groupId: "group-1",
  department: "Platform Engineering",
  isActive: false,
};

describe("UsersTable responsive rows", () => {
  it("stacks each record with labelled metadata and the same reachable actions", async () => {
    const onEdit = vi.fn();
    const onActivate = vi.fn();
    const onDelete = vi.fn();
    render(
      <UsersTable
        users={[USER]}
        activatePending={false}
        deactivatePending={false}
        onEdit={onEdit}
        onActivate={onActivate}
        onDeactivate={vi.fn()}
        onDelete={onDelete}
      />,
    );
    const user = userEvent.setup();
    const row = screen.getByText("Ivanova A.").closest("tr");
    if (!(row instanceof HTMLElement)) throw new Error("User row missing");

    expect(row).toHaveClass("grid", "sm:table-row");
    expect(row).not.toHaveClass("opacity-60");
    const record = within(row);
    expect(record.getByText("inactive")).toBeInTheDocument();
    for (const label of ["Email", "Role", "Group", "Position"]) {
      expect(record.getByText(label)).toHaveClass("sm:hidden");
    }
    expect(record.getByText(USER.email)).toHaveTextContent(USER.email);
    expect(record.getByText(USER.department)).toBeInTheDocument();
    expect(record.getByText("Engineering Team Lead")).toBeInTheDocument();
    await user.click(
      record.getByRole("button", { name: "Edit Ivanova Alice" }),
    );
    await user.click(
      record.getByRole("button", { name: "Activate Ivanova Alice" }),
    );
    expect(onEdit).toHaveBeenCalledWith(USER);
    expect(onActivate).toHaveBeenCalledWith(USER);
    await user.click(
      record.getByRole("button", { name: "More actions for Ivanova Alice" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete user" }));
    expect(onDelete).toHaveBeenCalledWith(USER, expect.any(HTMLButtonElement));
  });
});
