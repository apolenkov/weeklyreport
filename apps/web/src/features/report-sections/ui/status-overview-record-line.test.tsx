import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import {
  item,
  nextItem,
  previousItem,
} from "./status-overview-item-icons.test-support";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";

it("opens from the stage in the text button and reserves a decorative pencil", async () => {
  const edit = vi.fn();
  render(
    <StatusOverviewItemPreview
      item={item}
      onEditItem={edit}
      ownedStages={["Development", "Testing"]}
    />,
  );
  const text = screen.getByRole("button", {
    name: "Edit text: Original text, This week",
  });
  await userEvent.click(
    within(text).getByRole("img", { name: "Stage: Development" }),
  );
  expect(edit).toHaveBeenCalledWith(item.editTarget);
  expect(text.querySelector(".lucide-pencil")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(screen.queryByRole("button", { name: /discussion/i })).toBeNull();
});
it("shows no status on a Next week plan", () => {
  render(<StatusOverviewItemPreview item={nextItem} onSetStatus={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /status/i })).toBeNull();
});
it("answers a frozen plan through one outcome menu", async () => {
  const verdict = vi.fn().mockResolvedValue(null);
  const prior = { ...previousItem, verdict: "pending" as const };
  const original = JSON.stringify(prior);
  render(<StatusOverviewItemPreview item={prior} onVerdict={verdict} />);
  await userEvent.click(
    screen.getByTitle("Planned last week — choose what happened"),
  );
  expect(
    screen.getAllByRole("menuitem").map((node) => node.textContent),
  ).toEqual(["Done", "In progress", "Next week", "Paused…", "Won’t do…"]);
  await userEvent.click(screen.getByRole("menuitem", { name: "Done" }));
  expect(verdict).toHaveBeenCalledWith(prior, "done", undefined);
  expect(JSON.stringify(prior)).toBe(original);
});
