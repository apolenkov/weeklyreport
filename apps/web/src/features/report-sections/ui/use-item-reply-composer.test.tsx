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
const RESEND = "Send again (may duplicate)";
const UNAVAILABLE = "This discussion is no longer available.";
const FORBIDDEN = { data: { code: "FORBIDDEN" } };
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

function Harness({
  item,
  id = "comments",
}: {
  readonly item: StatusOverviewItem;
  readonly id?: string;
}) {
  const discussion = useItemDiscussion(item);
  return (
    <StatusOverviewCommentsView
      id={id}
      itemLabel={item.text}
      comments={discussion.comments}
      onClose={() => undefined}
      {...discussion.reply}
    />
  );
}

function renderWith(
  send: ItemReplyPort["send"],
  server: () => unknown = () => ({ status: "available", comments: [] }),
  items: readonly StatusOverviewItem[] = [persisted],
) {
  const read = vi.fn(server);
  const { proxy } = createMockTRPC([
    { path: ["review", "leadItemDiscussion"], queryByInput: () => read() },
  ]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const port = { reportSectionId: SECTION_ID, send };
  const tree = (open: readonly StatusOverviewItem[]) => (
    <QueryClientProvider client={client}>
      <TRPCProxyContext.Provider value={proxy}>
        <ItemReplyProvider value={port}>
          {open.map((item) => (
            <Harness key={item.key} item={item} id={item.key} />
          ))}
        </ItemReplyProvider>
      </TRPCProxyContext.Provider>
    </QueryClientProvider>
  );
  const view = render(tree(items));
  return { read, show: (open: typeof items) => view.rerender(tree(open)) };
}

const sending = (outcome: ItemReplyOutcome) =>
  vi.fn(() => Promise.resolve(outcome));

function deferred() {
  let resolve: (outcome: ItemReplyOutcome) => void = () => undefined;
  const promise = new Promise<ItemReplyOutcome>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function clickAndSettle(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
    await Promise.resolve();
  });
}

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
    const { read } = renderWith(send, () => ({
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

  it("keeps an uncertain reply unresolved until an explicit resend", async () => {
    const send = sending("uncertain");
    const { read } = renderWith(send);
    await typeAndSend("Reply");
    expect(screen.getByRole("alert")).toHaveTextContent("uncertain");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: RESEND })).toBeNull();
    await clickAndSettle("Refresh discussion");
    expect(read).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("uncertain");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByLabelText(REPLY_LABEL)).toHaveValue("Reply");
    await clickAndSettle(RESEND);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("keeps text typed while the earlier reply was pending", async () => {
    const pending = deferred();
    renderWith(vi.fn(() => pending.promise));
    await typeAndSend("First");
    fireEvent.change(screen.getByLabelText(REPLY_LABEL), {
      target: { value: "Second" },
    });
    await act(async () => {
      pending.resolve("sent");
      await Promise.resolve();
    });
    expect(screen.getByLabelText(REPLY_LABEL)).toHaveValue("Second");
  });

  it("keeps the unsent reply while the comments are closed", async () => {
    const { show } = renderWith(sending("sent"));
    fireEvent.change(await screen.findByLabelText(REPLY_LABEL), {
      target: { value: "Draft" },
    });
    show([]);
    expect(screen.queryByLabelText(REPLY_LABEL)).toBeNull();
    show([persisted]);
    expect(await screen.findByLabelText(REPLY_LABEL)).toHaveValue("Draft");
  });

  it("shares one draft and one pending send between Current and Next", async () => {
    const pending = deferred();
    const send = vi.fn(() => pending.promise);
    const next = { ...persisted, key: "next:alias", source: "next" as const };
    renderWith(send, undefined, [persisted, next]);
    const [first, second] = await screen.findAllByLabelText(REPLY_LABEL);
    if (!first) throw new Error("Expected two open composers");
    fireEvent.change(first, { target: { value: "Once" } });
    expect(second).toHaveValue("Once");
    await act(async () => {
      for (const button of screen.getAllByRole("button", { name: "Send" }))
        fireEvent.click(button);
      await Promise.resolve();
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: "Sending…" })).toHaveLength(2);
  });

  it("offers the live discussion on a resolved own item", async () => {
    renderWith(sending("sent"), undefined, [
      { ...persisted, editTarget: null, canRestore: true },
    ]);
    expect(await screen.findByLabelText(REPLY_LABEL)).toBeInTheDocument();
  });

  it("hides messages and the composer once the discussion is unavailable", async () => {
    renderWith(sending("sent"), () => ({ status: "unavailable" }), [
      { ...persisted, comments: [message("Private")] },
    ]);
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByText("Private")).toBeNull();
    expect(screen.queryByLabelText(REPLY_LABEL)).toBeNull();
  });

  it("hides the discussion and drops the draft after an authorization error", async () => {
    let denied = false;
    const { show } = renderWith(sending("uncertain"), () => {
      if (denied) throw Object.assign(new Error("no"), FORBIDDEN);
      return { status: "available", comments: [message("Private")] };
    });
    expect(await screen.findByText("Private")).toBeInTheDocument();
    await typeAndSend("Draft");
    denied = true;
    await clickAndSettle("Refresh discussion");
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument();
    expect(screen.queryByText("Private")).toBeNull();
    expect(screen.queryByLabelText(REPLY_LABEL)).toBeNull();
    denied = false;
    show([]);
    show([persisted]);
    expect(await screen.findByLabelText(REPLY_LABEL)).toHaveValue("");
  });

  it("keeps the last messages with a note after a transient read failure", async () => {
    let failing = false;
    renderWith(sending("uncertain"), () => {
      if (failing) throw new Error("network");
      return { status: "available", comments: [message("Earlier")] };
    });
    expect(await screen.findByText("Earlier")).toBeInTheDocument();
    await typeAndSend("Draft");
    failing = true;
    await clickAndSettle("Refresh discussion");
    expect(await screen.findByText(/Could not refresh/)).toBeInTheDocument();
    expect(screen.getByText("Earlier")).toBeInTheDocument();
    expect(screen.getByLabelText(REPLY_LABEL)).toHaveValue("Draft");
    expect(screen.queryByRole("button", { name: RESEND })).toBeNull();
  });

  it("does not read a local row without a persisted identity", () => {
    const { read } = renderWith(sending("sent"), undefined, [
      { ...persisted, recordId: "local-row" },
    ]);
    expect(screen.queryByLabelText(REPLY_LABEL)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
