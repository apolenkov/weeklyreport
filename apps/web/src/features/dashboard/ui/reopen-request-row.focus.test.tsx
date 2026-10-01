// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ReopenRequestRow } from "./reopen-request-row";

const requests = [
  {
    id: "request-alice",
    reason: "Alice reason",
    createdAt: "2026-04-06T12:00:00.000Z",
    requestedBy: { name: "Иванова Алиса Петровна" },
    report: {
      periodStart: "2026-04-06T00:00:00.000Z",
      periodEnd: "2026-04-10T00:00:00.000Z",
      weekLabel: "W15-2026",
    },
  },
  {
    id: "request-bob",
    reason: "Bob reason",
    createdAt: "2026-04-06T12:00:00.000Z",
    requestedBy: { name: "Кузнецов Борис Сергеевич" },
    report: {
      periodStart: "2026-04-06T00:00:00.000Z",
      periodEnd: "2026-04-10T00:00:00.000Z",
      weekLabel: "W15-2026",
    },
  },
] as const;

function FocusHarness({
  onApprove,
  onReject,
}: {
  readonly onApprove: () => void;
  readonly onReject: () => void;
}) {
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  return (
    <ul>
      {requests.map((request) => (
        <ReopenRequestRow
          key={request.id}
          request={request}
          isResponding={respondingId === request.id}
          note={note}
          onNoteChange={setNote}
          onStartRespond={() => setRespondingId(request.id)}
          onCancel={() => setRespondingId(null)}
          onReject={onReject}
          onApprove={onApprove}
          isPending={false}
          pendingDecision={undefined}
        />
      ))}
    </ul>
  );
}

describe("ReopenRequestRow response focus", () => {
  it("moves focus into the keyboard-selected row and restores its Respond action on Cancel", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(<FocusHarness onApprove={onApprove} onReject={onReject} />);

    const aliceRow = screen.getByText("Иванова А.П.").closest("li");
    const bobRow = screen.getByText("Кузнецов Б.С.").closest("li");
    expect(screen.queryByText("Иванова Алиса Петровна")).toBeNull();
    expect(aliceRow).not.toBeNull();
    expect(bobRow).not.toBeNull();
    if (!aliceRow || !bobRow) return;

    await user.tab();
    expect(
      within(aliceRow).getByRole("button", { name: "Respond" }),
    ).toHaveFocus();
    await user.tab();
    const bobRespond = within(bobRow).getByRole("button", { name: "Respond" });
    expect(bobRespond).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(within(bobRow).getByRole("textbox")).toHaveFocus();
    expect(within(aliceRow).queryByRole("textbox")).not.toBeInTheDocument();

    await user.tab();
    const cancel = within(bobRow).getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(within(bobRow).queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      within(bobRow).getByRole("button", { name: "Respond" }),
    ).toHaveFocus();
    expect(
      within(aliceRow).getByRole("button", { name: "Respond" }),
    ).not.toHaveFocus();
    expect(onApprove).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("gives Respond the mobile touch-target minimum", () => {
    render(<FocusHarness onApprove={vi.fn()} onReject={vi.fn()} />);

    for (const button of screen.getAllByRole("button", { name: "Respond" })) {
      expect(button).toHaveClass("max-md:min-h-[var(--touch-target-min)]");
    }
  });
});
