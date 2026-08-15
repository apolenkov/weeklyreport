// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import type { AdminActionLogEvent } from "@customreport/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActionLogRow } from "../action-log-row";

const { copyToClipboard } = vi.hoisted(() => ({
  copyToClipboard: vi.fn<(_: string) => Promise<boolean>>(),
}));
vi.mock("../../model/action-log-format", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../model/action-log-format")>();
  return { ...actual, copyToClipboard };
});

const EVENT: AdminActionLogEvent = {
  id: "action-1",
  createdAt: "2026-08-14T10:15:30.000Z",
  userId: "full-admin-user-id",
  role: "admin",
  procedure: "admin.updateUser",
  targetId: "full-target-user-id",
  status: "fail",
  reason: "BAD_REQUEST",
  ip: "127.0.0.1",
  correlationId: "request-1",
  durationMs: 18,
};

function renderRow() {
  return render(
    <table>
      <tbody>
        <ActionLogRow row={EVENT} />
      </tbody>
    </table>,
  );
}

describe("ActionLogRow details", () => {
  beforeEach(() => {
    copyToClipboard.mockReset();
    copyToClipboard.mockResolvedValue(true);
  });

  it("opens and closes the labelled region from the same keyboard control", async () => {
    const user = userEvent.setup();
    renderRow();
    const trigger = screen.getByRole("button", {
      name: /show action details/i,
    });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("region", { name: /action details/i }),
    ).toBeNull();

    trigger.focus();
    await user.keyboard("{Enter}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveFocus();
    const region = screen.getByRole("region", { name: /action details/i });
    expect(region).toHaveTextContent("full-admin-user-id");
    expect(within(region).getByText("full-target-user-id")).toBeInTheDocument();
    expect(within(region).getByText("127.0.0.1")).toBeInTheDocument();
    expect(within(region).getByText("18 ms")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(
      screen.queryByRole("region", { name: /action details/i }),
    ).toBeNull();
  });

  it("copies exact safe JSON and announces success without moving focus", async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(
      screen.getByRole("button", { name: /show action details/i }),
    );
    const copyButton = screen.getByRole("button", {
      name: /copy action details/i,
    });

    await user.click(copyButton);

    expect(copyToClipboard).toHaveBeenCalledOnce();
    const copied = copyToClipboard.mock.calls[0]?.[0];
    expect(JSON.parse(copied ?? "{}")).toEqual(EVENT);
    expect(copyButton).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });

  it("announces clipboard failure and keeps the disclosure open", async () => {
    copyToClipboard.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    renderRow();
    const trigger = screen.getByRole("button", {
      name: /show action details/i,
    });
    await user.click(trigger);

    await user.click(
      screen.getByRole("button", { name: /copy action details/i }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("Copy failed");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
