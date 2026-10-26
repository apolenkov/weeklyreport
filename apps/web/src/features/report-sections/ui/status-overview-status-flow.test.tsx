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

  it.each([
    ["Plan for next week", "plan"],
    ["Clear", "clear"],
  ] as const)(
    "resolves Done with a next step using %s in three clicks",
    async (label, action) => {
      const user = userEvent.setup();
      const onSetStatus = vi.fn().mockResolvedValue(null);
      const committed = { ...item, nextStepText: "Verify production" };
      render(
        <StatusOverviewItemPreview
          item={committed}
          onSetStatus={onSetStatus}
        />,
      );
      await choose(user, "Done");
      expect(screen.getByText(/Mark done\. Next step/)).toBeVisible();
      expect(
        screen.getByText(
          /current result stays in history and its status is unchanged/,
        ),
      ).toBeVisible();
      expect(onSetStatus).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: label }));
      expect(onSetStatus).toHaveBeenCalledWith(
        committed,
        "done",
        "edit:current:stable-1",
        { nextStepAction: action },
      );
      expect(screen.queryByText(/Cancel, then choose/)).toBeNull();
    },
  );

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
      } else await user.click(screen.getByRole("button", { name: "Clear" }));
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
      screen.getByRole("button", { name: "Plan for next week" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Wait for autosave to finish.",
    );
    expect(
      screen.getByRole("button", { name: "Plan for next week" }),
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
