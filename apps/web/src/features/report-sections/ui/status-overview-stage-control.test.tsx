import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { expect, it, vi } from "vitest";

import { setupPanel } from "./overview-record-panel.test-support";
import { item, nextItem } from "./status-overview-item-icons.test-support";

it.each([item, nextItem])(
  "keeps stage and text edits in one draft for $source until Save",
  async (record) => {
    const user = userEvent.setup();
    const { store, save } = setupPanel(false, { record });
    const field = screen.getByRole("textbox", { name: "Record text" });
    await user.type(field, " edited");
    const selected = screen.getByRole("button", { name: "Development" });
    const announce = vi.spyOn(toast, "info");
    selected.focus();
    await user.keyboard("{Enter}");
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(announce).toHaveBeenCalledWith("A record needs at least one stage.");
    await user.click(screen.getByRole("button", { name: "Testing" }));
    expect(screen.getByText("Not saved")).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledOnce();
    expect(store.getSnapshot()).toMatchObject({
      text: "Original text edited",
      stageNames: ["Development", "Testing"],
    });
  },
);

it("keeps stale stages and the text until the Lead chooses an eligible replacement", async () => {
  const { save } = setupPanel(false, { selected: ["Design"] });
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Choose an available stage.",
  );
  expect(save).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Testing" }));
  await userEvent.click(screen.getByRole("button", { name: "Design" }));
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledOnce();
});

it("holds stage changes during a pending save", async () => {
  const { save, store } = setupPanel(false, { pending: true });
  const testing = screen.getByRole("button", { name: "Testing" });
  expect(testing).toBeDisabled();
  await userEvent.click(testing);
  expect(store.getSnapshot().stageNames).toEqual(["Development"]);
  expect(save).not.toHaveBeenCalled();
});
