import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";

const item: StatusOverviewItem = {
  key: "current:stable-1",
  recordId: "item-1",
  stableId: "stable-1",
  source: "current",
  editTarget: { recordId: "item-1", source: "current" },
  text: "Ship importer",
  tag: "delivery",
  stageNames: ["Development"],
  pausedReason: null,
  resolution: null,
  outcomeHistory: [],
  comments: [],
  canResolve: true,
  canRestore: false,
  workflowStatus: "in_progress",
  continuity: null,
};

async function choose(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(
    screen.getByRole("button", {
      name: "Status of Ship importer: In progress",
    }),
  );
  await user.click(screen.getByRole("menuitem", { name }));
}

describe("Overview inline status input", () => {
  it("asks for a pause reason after two clicks and submits on Enter without the full editor", async () => {
    const user = userEvent.setup();
    const onSetStatus = vi.fn().mockResolvedValue(null);
    const onEditItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={item}
        onSetStatus={onSetStatus}
        onEditItem={onEditItem}
      />,
    );
    await choose(user, "Paused");
    const reason = screen.getByRole("textbox", {
      name: "Paused reason — Ship importer",
    });
    await waitFor(() => expect(reason).toHaveFocus());
    expect(onSetStatus).not.toHaveBeenCalled();
    await user.keyboard("Waiting for access{Enter}");
    await waitFor(() =>
      expect(onSetStatus).toHaveBeenCalledWith(
        item,
        "paused",
        "edit:current:stable-1",
        { pausedReason: "Waiting for access" },
      ),
    );
    expect(onEditItem).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: /Description/ })).toBeNull();
  });

  it("rejects blank and invisible pause reasons without emitting a patch", async () => {
    const user = userEvent.setup();
    const onSetStatus = vi.fn();
    render(<StatusOverviewItemPreview item={item} onSetStatus={onSetStatus} />);
    await choose(user, "Paused");
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(screen.getByRole("alert")).toBeVisible();
    await user.type(screen.getByRole("textbox"), "\u200B");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("alert")).toBeVisible();
    expect(onSetStatus).not.toHaveBeenCalled();
  });

  it("returns focus to the status icon on Escape without writing", async () => {
    const user = userEvent.setup();
    const onSetStatus = vi.fn();
    render(<StatusOverviewItemPreview item={item} onSetStatus={onSetStatus} />);
    await choose(user, "Paused");
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Status of Ship importer/ }),
      ).toHaveFocus(),
    );
    expect(onSetStatus).not.toHaveBeenCalled();
  });

  it("offers only clear-and-done or cancel, focusing the safe completion", async () => {
    const user = userEvent.setup();
    const onSetStatus = vi.fn().mockResolvedValue(null);
    const committed = { ...item, nextStepText: "Verify production" };
    render(
      <StatusOverviewItemPreview item={committed} onSetStatus={onSetStatus} />,
    );
    await choose(user, "Done");
    expect(
      screen.queryByRole("button", { name: "Plan for next week" }),
    ).toBeNull();
    const clear = screen.getByRole("button", { name: "Clear and mark done" });
    await waitFor(() => expect(clear).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onSetStatus).toHaveBeenCalledWith(
      committed,
      "done",
      "edit:current:stable-1",
      { nextStepAction: "clear" },
    );
  });

  it("keeps the typed pause reason and locks the other statuses until Save or Cancel", async () => {
    const user = userEvent.setup();
    const onSetStatus = vi.fn().mockResolvedValue(null);
    render(<StatusOverviewItemPreview item={item} onSetStatus={onSetStatus} />);
    await choose(user, "Paused");
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
    await user.keyboard("Waiting for access");
    await user.click(
      screen.getByRole("button", { name: /Status of Ship importer/ }),
    );
    const reason =
      "Save or cancel the open status input before choosing another status.";
    expect(screen.getByTestId("overview-status-lock-reason")).toHaveTextContent(
      reason,
    );
    expect(screen.getByRole("menu")).toHaveAccessibleDescription(reason);
    for (const entry of screen.getAllByRole("menuitem")) {
      expect(entry).toHaveAttribute("aria-disabled", "true");
      expect(entry).toHaveAccessibleDescription(reason);
    }
    await user.click(screen.getByRole("menuitem", { name: "Paused" }));
    await user.click(screen.getByRole("menuitem", { name: "Postponed" }));
    expect(screen.getByRole("menu")).toBeVisible();
    expect(onSetStatus).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("textbox")).toHaveValue("Waiting for access"),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSetStatus).toHaveBeenCalledWith(
      item,
      "paused",
      "edit:current:stable-1",
      { pausedReason: "Waiting for access" },
    );
  });

  it("returns focus to the status icon after Cancel even when the locked menu was opened", async () => {
    const user = userEvent.setup();
    const onSetStatus = vi.fn().mockResolvedValue(null);
    render(<StatusOverviewItemPreview item={item} onSetStatus={onSetStatus} />);
    await choose(user, "Paused");
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
    await user.click(
      screen.getByRole("button", { name: /Status of Ship importer/ }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Paused" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Status of Ship importer/ }),
      ).toHaveFocus(),
    );
    expect(onSetStatus).not.toHaveBeenCalled();
  });

  it("allows carried confirmation under a risk and describes every menu choice", async () => {
    const user = userEvent.setup();
    const onConfirmItem = vi.fn();
    const onSetStatus = vi.fn();
    const covered = {
      ...item,
      needsConfirmation: true,
      statusRiskText: "Access unavailable",
    };
    render(
      <StatusOverviewItemPreview
        item={covered}
        onSetStatus={onSetStatus}
        onConfirmItem={onConfirmItem}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Status of Ship importer/ }),
    );
    expect(screen.getByRole("menu")).toHaveAccessibleDescription(
      "Set by risk: Access unavailable — resolve it in Risks & Blockers",
    );
    const current = screen.getByRole("menuitem", { name: "In progress" });
    expect(current).not.toHaveAttribute("aria-disabled", "true");
    expect(current).toHaveAccessibleDescription(
      "Set by risk: Access unavailable — resolve it in Risks & Blockers",
    );
    for (const entry of screen
      .getAllByRole("menuitem")
      .filter((entry) => entry !== current))
      expect(entry).toHaveAttribute("aria-disabled", "true");
    await user.click(current);
    expect(onConfirmItem).toHaveBeenCalledExactlyOnceWith(covered);
    expect(onSetStatus).not.toHaveBeenCalled();
  });

  it.each(["paused", "clear"] as const)(
    "restores focus after a carried item is confirmed by %s",
    async (action) => {
      const user = userEvent.setup();
      const carried = {
        ...item,
        needsConfirmation: true,
        ...(action === "clear" ? { nextStepText: "Verify production" } : {}),
      };
      const onSetStatus = vi.fn().mockResolvedValue(null);
      const { rerender } = render(
        <StatusOverviewItemPreview item={carried} onSetStatus={onSetStatus} />,
      );
      await user.click(
        screen.getByRole("button", { name: /Status of Ship importer/ }),
      );
      await user.click(
        screen.getByRole("menuitem", {
          name: action === "paused" ? "Paused" : "Done",
        }),
      );
      if (action === "paused") {
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
        await user.keyboard("Waiting{Enter}");
      } else
        await user.click(
          screen.getByRole("button", { name: "Clear and mark done" }),
        );
      rerender(
        <StatusOverviewItemPreview
          item={{
            ...item,
            workflowStatus: action === "paused" ? "paused" : "done",
          }}
          onSetStatus={onSetStatus}
        />,
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /Status of Ship importer/ }),
        ).toHaveFocus(),
      );
    },
  );

  it("retains a failed inline action for retry", async () => {
    const user = userEvent.setup();
    const onSetStatus = vi
      .fn()
      .mockResolvedValue("Wait for autosave to finish.");
    render(
      <StatusOverviewItemPreview
        item={{ ...item, nextStepText: "Verify production" }}
        onSetStatus={onSetStatus}
      />,
    );
    await choose(user, "Done");
    await user.click(
      screen.getByRole("button", { name: "Clear and mark done" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wait for autosave to finish.",
    );
    expect(
      screen.getByRole("button", { name: "Clear and mark done" }),
    ).toBeEnabled();
  });

  it("disables every status under a covering risk with a visible explanation", async () => {
    const user = userEvent.setup();
    const onSetStatus = vi.fn();
    const onEditItem = vi.fn();
    render(
      <StatusOverviewItemPreview
        item={{ ...item, statusRiskText: "Access unavailable" }}
        onSetStatus={onSetStatus}
        onEditItem={onEditItem}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /Status of Ship importer/ }),
    );
    expect(
      screen.getByText(
        "Set by risk: Access unavailable — resolve it in Risks & Blockers",
      ),
    ).toBeVisible();
    for (const entry of screen.getAllByRole("menuitem")) {
      expect(entry).toHaveAttribute("aria-disabled", "true");
      await user.click(entry);
    }
    expect(onSetStatus).not.toHaveBeenCalled();
    expect(onEditItem).not.toHaveBeenCalled();
  });
});
