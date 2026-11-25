import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { setupPanel as setup } from "./overview-record-panel.test-support";
it("retains a changed draft outside and asks before discarding", async () => {
  const { save, close } = setup();
  const field = screen.getByRole("textbox", { name: "Record text" });
  await userEvent.type(field, " revised");
  fireEvent.pointerDown(document.body);
  expect(field).toHaveValue("Original text revised");
  expect(screen.getByText("Not saved")).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    screen.getByRole("alertdialog", { name: "Discard changes?" }),
  ).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(field).toHaveFocus();
  expect(close).not.toHaveBeenCalled();
});
it("edits only the step field in the reduced panel and saves on Enter", async () => {
  const { store, save } = setup(true);
  expect(screen.queryByText("Stage")).toBeNull();
  const field = screen.getByRole("textbox", { name: "Step text" });
  await userEvent.clear(field);
  await userEvent.type(field, "Revised plan{Enter}");
  expect(store.getSnapshot().text).toBe("Original text");
  expect(store.getSnapshot().nextStepText).toBe("Revised plan");
  expect(save).toHaveBeenCalledOnce();
});

it("returns focus to Delete after cancelling deletion", async () => {
  setup(true);
  const trigger = screen.getByRole("button", { name: "Delete" });
  await userEvent.click(trigger);
  await userEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Cancel",
    }),
  );
  expect(trigger).toHaveFocus();
});

it("expands only the derived step in More details", async () => {
  setup(true);
  await userEvent.click(screen.getByRole("button", { name: "More details" }));
  const details = screen.getByRole("dialog", { name: "Next step details" });
  expect(
    within(details).getByRole("textbox", { name: "Step text" }),
  ).toHaveValue("Draft plan");
  expect(
    within(details).queryByRole("textbox", { name: "Record text" }),
  ).toBeNull();
  expect(within(details).queryByText("Stage")).toBeNull();
});

it("retains the draft when the pointer or viewport switches to a modal bottom sheet", async () => {
  let narrow = false;
  const media = new EventTarget();
  vi.stubGlobal("matchMedia", () => Object.assign(media, { matches: narrow }));
  try {
    const { store } = setup();
    const field = screen.getByRole("textbox", { name: "Record text" });
    await userEvent.type(field, " retained");
    narrow = true;
    act(() => {
      media.dispatchEvent(new Event("change"));
    });
    expect(screen.getByRole("dialog", { name: "Record" }).dataset.slot).toBe(
      "sheet-content",
    );
    expect(screen.getByRole("textbox", { name: "Record text" })).toHaveValue(
      "Original text retained",
    );
    narrow = false;
    act(() => {
      media.dispatchEvent(new Event("change"));
    });
    expect(store.getSnapshot().text).toBe("Original text retained");
  } finally {
    vi.unstubAllGlobals();
  }
});
