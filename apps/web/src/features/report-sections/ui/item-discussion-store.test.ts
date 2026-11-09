import { describe, expect, it, vi } from "vitest";

import { createItemDiscussionStore } from "./item-discussion-store";
import type { ItemReplyOutcome } from "./item-reply-context";

const KEY = "section:lineage";
const outcome = (value: ItemReplyOutcome) => () => Promise.resolve(value);

describe("item discussion store", () => {
  it("clears only the draft that the acknowledged attempt carried", async () => {
    const store = createItemDiscussionStore();
    store.edit(KEY, " First ");
    const dispatch = vi.fn(outcome("sent"));
    const sending = store.send(KEY, dispatch);
    store.edit(KEY, "Second");
    await sending;
    expect(dispatch).toHaveBeenCalledWith("First");
    expect(store.read(KEY)).toMatchObject({
      value: "Second",
      delivery: "idle",
    });
    await store.send(KEY, outcome("sent"));
    expect(store.read(KEY).value).toBe("");
  });

  it("dispatches one attempt while pending", async () => {
    const store = createItemDiscussionStore();
    store.edit(KEY, "Once");
    const dispatch = vi.fn(outcome("sent"));
    const [first, second] = [
      store.send(KEY, dispatch),
      store.send(KEY, dispatch),
    ];
    expect(await second).toBeNull();
    expect(await first).toBe("sent");
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("keeps an uncertain attempt blocked until the Lead checked", async () => {
    const store = createItemDiscussionStore();
    store.edit(KEY, "Reply");
    await store.send(KEY, outcome("uncertain"));
    const dispatch = vi.fn(outcome("sent"));
    expect(await store.send(KEY, dispatch)).toBeNull();
    store.edit(KEY, "Reply edited");
    expect(store.read(KEY).delivery).toBe("uncertain");
    store.markChecked(KEY);
    expect(await store.send(KEY, dispatch)).toBe("sent");
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("keeps rejected text and clears the error on the next edit", async () => {
    const store = createItemDiscussionStore();
    store.edit(KEY, "Reply");
    await store.send(KEY, outcome("rejected"));
    expect(store.read(KEY)).toMatchObject({
      value: "Reply",
      delivery: "error",
    });
    store.edit(KEY, "Reply!");
    expect(store.read(KEY).delivery).toBe("idle");
  });

  it("ignores a late answer for a dropped entry", async () => {
    const store = createItemDiscussionStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.edit(KEY, "Private");
    const sending = store.send(KEY, outcome("sent"));
    store.drop(KEY);
    expect(await sending).toBeNull();
    expect(store.read(KEY)).toMatchObject({ value: "", sentAt: null });
    expect(listener).toHaveBeenCalledTimes(3);
  });
});
