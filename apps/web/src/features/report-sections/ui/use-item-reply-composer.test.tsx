import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import {
  type ItemReplyOutcome,
  type ItemReplyPort,
  ItemReplyProvider,
} from "./item-reply-context";
import { StatusOverviewCommentsView } from "./status-overview-comments-view";
import { item as baseItem } from "./status-overview-item-icons.test-support";
import { useItemReplyProps } from "./use-item-reply-composer";

const RECORD_ID = "10000000-0000-4000-8000-000000000001";
const persisted: StatusOverviewItem = {
  ...baseItem,
  recordId: RECORD_ID,
  editTarget: { recordId: RECORD_ID, source: "current" },
};

function Harness({ item }: { readonly item: StatusOverviewItem }) {
  const reply = useItemReplyProps(item);
  return (
    <StatusOverviewCommentsView
      id="comments"
      itemLabel={item.text}
      comments={[]}
      onClose={() => undefined}
      {...reply}
    />
  );
}

function renderWith(
  port: ItemReplyPort | null,
  item: StatusOverviewItem = persisted,
) {
  return render(
    <ItemReplyProvider value={port}>
      <Harness item={item} />
    </ItemReplyProvider>,
  );
}

function portSending(outcome: ItemReplyOutcome, refreshed = true) {
  return {
    send: vi.fn(() => Promise.resolve(outcome)),
    refresh: vi.fn(() => Promise.resolve(refreshed)),
  };
}

async function typeAndSend(text: string) {
  fireEvent.change(screen.getByLabelText(/Reply to/), {
    target: { value: text },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await Promise.resolve();
  });
}

describe("Lead item reply composer", () => {
  it("sends the trimmed reply and clears the field once confirmed", async () => {
    const port = portSending("sent");
    renderWith(port);
    await typeAndSend("  Thanks, fixed  ");
    expect(port.send).toHaveBeenCalledWith(persisted, "Thanks, fixed");
    expect(screen.getByLabelText(/Reply to/)).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the typed reply after a definite rejection", async () => {
    renderWith(portSending("rejected"));
    await typeAndSend("Reply");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not send");
    expect(screen.getByLabelText(/Reply to/)).toHaveValue("Reply");
  });

  it("asks for a refresh instead of resending an uncertain reply", async () => {
    const port = portSending("uncertain");
    renderWith(port);
    await typeAndSend("Reply");
    expect(screen.getByRole("alert")).toHaveTextContent("uncertain");
    expect(screen.getByLabelText(/Reply to/)).toHaveValue("Reply");
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Refresh discussion" }),
      );
      await Promise.resolve();
    });
    expect(port.refresh).toHaveBeenCalledTimes(1);
    expect(port.send).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("withholds the composer without a persisted own record or a port", () => {
    const { unmount } = renderWith(portSending("sent"), {
      ...persisted,
      recordId: "local-row",
    });
    expect(screen.queryByLabelText(/Reply to/)).toBeNull();
    unmount();
    renderWith(null);
    expect(screen.queryByLabelText(/Reply to/)).toBeNull();
    expect(screen.getByText("No comments yet.")).toBeInTheDocument();
  });
});
