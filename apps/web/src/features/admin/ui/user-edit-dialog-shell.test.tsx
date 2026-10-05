import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { UserEditDialogShell } from "./user-edit-dialog-shell";

describe("UserEditDialogShell", () => {
  // R91: the dialog needs a visible dismiss control besides Cancel and Escape.
  it("renders a close button that dismisses the dialog", () => {
    const onClose = vi.fn();
    render(
      <UserEditDialogShell
        surfaceRef={createRef<HTMLDivElement>()}
        title="Edit user"
        ariaLabel="Edit user"
        onClose={onClose}
      >
        <p>body</p>
      </UserEditDialogShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
