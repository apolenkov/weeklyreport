import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { RecordCommentView } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { TRPCProxyContext } from "../../../shared/lib/trpc/trpc-context";
import { createMockTRPC } from "../../../test-utils/mock-trpc";
import type { StatusOverviewItem } from "../model/status-overview";
import {
  type ItemReplyOutcome,
  type ItemReplyPort,
  ItemReplyProvider,
} from "./item-reply-context";
import { StatusOverviewCommentsView } from "./status-overview-comments-view";
import { item as baseItem } from "./status-overview-item-icons.test-support";
import { useItemDiscussion } from "./use-item-reply-composer";

const RECORD_ID = "10000000-0000-4000-8000-000000000001";
const STABLE_ID = "10000000-0000-4000-8000-000000000002";
const SECTION_ID = "10000000-0000-4000-8000-000000000003";
const REPLY_LABEL = /Reply to/;
const persisted: StatusOverviewItem = {
  ...baseItem,
  recordId: RECORD_ID,
  stableId: STABLE_ID,
  editTarget: { recordId: RECORD_ID, source: "current" },
};

function message(text: string): RecordCommentView {
  return {
    id: "10000000-0000-4000-8000-000000000009",
    reviewerId: RECORD_ID,
    reviewerName: "Lead",
    text,
    createdAt: new Date("2026-11-09T10:00:00Z"),
  };
}

function Harness({ item }: { readonly item: StatusOverviewItem }) {
  const discussion = useItemDiscussion(item);
  return (
    <StatusOverviewCommentsView
      id="comments"
      itemLabel={item.text}
      comments={discussion.comments}
      onClose={() => undefined}
      {...discussion.reply}
    />
  );
}

function renderWith(
  send: ItemReplyPort["send"] | null,
  server: () => unknown = () => ({ status: "available", comments: [] }),
  item: StatusOverviewItem = persisted,
) {
  const read = vi.fn(server);
  const { proxy } = createMockTRPC([
    { path: ["review", "leadItemDiscussion"], queryByInput: () => read() },
  ]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TRPCProxyContext.Provider value={proxy}>
        <ItemReplyProvider
          value={send ? { reportSectionId: SECTION_ID, send } : null}
        >
          <Harness item={item} />
        </ItemReplyProvider>
      </TRPCProxyContext.Provider>
    </QueryClientProvider>,
  );
  return read;
}

const sending = (outcome: ItemReplyOutcome) =>
  vi.fn(() => Promise.resolve(outcome));

async function typeAndSend(text: string) {
  fireEvent.change(await screen.findByLabelText(REPLY_LABEL), {
    target: { value: text },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await Promise.resolve();
  });
}

describe("Lead item discussion", () => {
  it("shows the live discussion and re-reads only it after a confirmed reply", async () => {
    let server: RecordCommentView[] = [];
    const send = sending("sent");
    const read = renderWith(send, () => ({
      status: "available",
      comments: server,
    }));
    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
    server = [message("Thanks, fixed")];
    await typeAndSend("  Thanks, fixed  ");
    expect(send).toHaveBeenCalledWith(persisted, "Thanks, fixed");
    expect(await screen.findByText("Thanks, fixed")).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText(REPLY_LABEL)).toHaveValue("");
  });

  it("keeps the typed reply after a definite rejection", async () => {
    renderWith(sending("rejected"));
    await typeAndSend("Reply");
    expect(screen.getByRole("alert")).toHaveTextContent("Could not send");
    expect(screen.getByLabelText(REPLY_LABEL)).toHaveValue("Reply");
  });

  it("asks for a refresh instead of resending an uncertain reply", async () => {
    const send = sending("uncertain");
    const read = renderWith(send);
    await typeAndSend("Reply");
    expect(screen.getByRole("alert")).toHaveTextContent("uncertain");
    expect(screen.getByLabelText(REPLY_LABEL)).toHaveValue("Reply");
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Refresh discussion" }),
      );
      await Promise.resolve();
    });
    expect(await screen.findByLabelText(REPLY_LABEL)).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("withholds the composer for an unavailable discussion or a local row", async () => {
    renderWith(sending("sent"), () => ({ status: "unavailable" }));
    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
    await act(async () => Promise.resolve());
    expect(screen.queryByLabelText(REPLY_LABEL)).toBeNull();
  });

  it("does not read a local row without a persisted identity", () => {
    const read = renderWith(sending("sent"), undefined, {
      ...persisted,
      recordId: "local-row",
    });
    expect(screen.queryByLabelText(REPLY_LABEL)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
