import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useDiscardGuard } from "./use-discard-guard";

function Harness({
  isDirty,
  isPending,
  onDiscard,
}: {
  readonly isDirty: boolean;
  readonly isPending?: boolean;
  readonly onDiscard: () => void;
}) {
  const { requestClose, discardDialog } = useDiscardGuard(
    isDirty,
    onDiscard,
    isPending,
  );
  return (
    <>
      <button type="button" onClick={requestClose}>
        Close
      </button>
      {discardDialog}
    </>
  );
}

describe("useDiscardGuard", () => {
  it("closes a clean draft without asking", async () => {
    const onDiscard = vi.fn();
    render(<Harness isDirty={false} onDiscard={onDiscard} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("asks first for a dirty draft and discards only on confirmation", async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    render(<Harness isDirty onDiscard={onDiscard} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onDiscard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onDiscard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("ignores dismissal while a save is in flight", async () => {
    const onDiscard = vi.fn();
    render(<Harness isDirty isPending onDiscard={onDiscard} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDiscard).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("disables discard confirmation buttons when isPending becomes true while open", () => {
    const onDiscard = vi.fn();
    const { rerender } = render(
      <Harness isDirty isPending={false} onDiscard={onDiscard} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    // Discard confirmation dialog is open
    const discardBtn = screen.getByRole("button", { name: "Discard" });
    const cancelBtn = screen.getByRole("button", { name: "Keep editing" });
    expect(discardBtn).not.toBeDisabled();
    expect(cancelBtn).not.toBeDisabled();

    // Pending save starts while discard dialog is already visible
    rerender(<Harness isDirty isPending={true} onDiscard={onDiscard} />);
    expect(discardBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();
  });
});
