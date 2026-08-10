import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { DialogSurface } from "./dialog-surface";

function renderSurface(onDismiss = vi.fn()) {
  render(
    <DialogSurface
      surfaceRef={createRef()}
      onDismiss={onDismiss}
      surfaceClassName="surface"
      ariaLabel="Editor"
    >
      <button type="button">Inside</button>
    </DialogSurface>,
  );
  return onDismiss;
}

describe("DialogSurface", () => {
  it("dismisses only a direct backdrop click", () => {
    const onDismiss = renderSurface();
    const backdrop = screen.getByRole("presentation");

    fireEvent.click(screen.getByRole("button", { name: "Inside" }));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("owns the modal role and accessible label", () => {
    renderSurface();

    expect(screen.getByRole("dialog", { name: "Editor" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
  });
});
