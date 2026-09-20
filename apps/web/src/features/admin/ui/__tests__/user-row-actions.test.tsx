// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AdminUserView } from "../../model/admin-types";
import { UserRowActions } from "../user-row-actions";

const user: AdminUserView = {
  id: "user-1",
  name: "Alice Lead",
  lastName: "Lead",
  firstName: "Alice",
  middleName: null,
  position: null,
  email: "alice@example.com",
  role: "lead",
  groupId: "group-1",
  department: "Engineering",
  isActive: true,
};

describe("UserRowActions", () => {
  it("keeps activation actions in the admin token domains", () => {
    const { rerender } = render(
      <UserRowActions
        user={user}
        deactivatePending={false}
        activatePending={false}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        onActivate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const deactivate = screen.getByRole("button", {
      name: "Deactivate Alice Lead",
    });
    expect(deactivate).toHaveClass(
      "text-[var(--color-destructive)]",
      "hover:border-[var(--color-destructive)]",
      "hover:bg-[var(--color-destructive-surface-subtle)]",
    );
    expect(deactivate.className).not.toMatch(/color-status-/);

    rerender(
      <UserRowActions
        user={{ ...user, isActive: false }}
        deactivatePending={false}
        activatePending={false}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        onActivate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const activate = screen.getByRole("button", {
      name: "Activate Alice Lead",
    });
    expect(activate).toHaveClass(
      "text-[var(--color-starbucks-accent)]",
      "hover:border-[var(--color-border-accent-hover)]",
      "hover:bg-[var(--color-success)]",
    );
    expect(activate.className).not.toMatch(/color-status-/);
  });

  it("gives every user action the mobile touch-target floor", async () => {
    render(
      <UserRowActions
        user={user}
        deactivatePending={false}
        activatePending={false}
        onEdit={vi.fn()}
        onDeactivate={vi.fn()}
        onActivate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    for (const name of [
      "Edit Alice Lead",
      "Deactivate Alice Lead",
      "More actions for Alice Lead",
    ]) {
      expect(screen.getByRole("button", { name })).toHaveClass(
        "max-md:min-h-[var(--touch-target-min)]",
        "max-md:min-w-[var(--touch-target-min)]",
      );
    }

    await userEvent.click(
      screen.getByRole("button", { name: "More actions for Alice Lead" }),
    );
    expect(screen.getByRole("menuitem", { name: "Delete user" })).toHaveClass(
      "max-md:min-h-[var(--touch-target-min)]",
    );
  });
});
