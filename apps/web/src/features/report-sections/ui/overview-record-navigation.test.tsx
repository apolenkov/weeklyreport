import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { setupPanel } from "./overview-record-panel.test-support";

afterEach(() => vi.restoreAllMocks());
it.each([true, false])(
  "tabbing out keeps a changed panel and closes a clean panel (changed %s)",
  async (changed) => {
    const { close, save } = setupPanel();
    render(<button>Following record</button>);
    const rects = document.body.getClientRects();
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue(
      Object.assign(Object.create(rects), { length: 1 }) as DOMRectList,
    );
    if (changed)
      await userEvent.type(
        screen.getByRole("textbox", { name: "Record text" }),
        " updated",
      );
    const last = screen.getByRole("button", { name: "Save" });
    last.focus();
    await userEvent.tab();
    expect(
      screen.getByRole("button", { name: "Following record" }),
    ).toHaveFocus();
    expect(close).toHaveBeenCalledTimes(changed ? 0 : 1);
    expect(save).not.toHaveBeenCalled();
  },
);
it("returns to the text button from the first field and leaves clean outside clicks unsaved", async () => {
  const { close, save } = setupPanel();
  const first = screen.getByRole("textbox", { name: "Record text" });
  first.focus();
  await userEvent.tab({ shift: true });
  expect(screen.getByRole("button", { name: /Edit text:/ })).toHaveFocus();
  expect(close).toHaveBeenCalled();
  close.mockClear();
  await userEvent.click(document.body);
  expect(close).toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});
it("keeps Enter during composition in the field", () => {
  const { save } = setupPanel();
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Record text" }), {
    key: "Enter",
    isComposing: true,
  });
  expect(save).not.toHaveBeenCalled();
});
