import type { ItemReplyOutcome } from "./item-reply-context";

type ReplyDelivery = "idle" | "pending" | "error" | "uncertain";

/** One lineage's reply draft and its single delivery attempt. */
export interface ReplyDraft {
  readonly value: string;
  /** Grows with every edit; an acknowledgement clears only its own text. */
  readonly sequence: number;
  readonly delivery: ReplyDelivery;
  /** The Lead re-read the discussion after the uncertain attempt. */
  readonly checked: boolean;
  /** When the last reply was confirmed; the list must be read after it. */
  readonly sentAt: number | null;
  readonly attempt: number;
}

const EMPTY: ReplyDraft = {
  value: "",
  sequence: 0,
  delivery: "idle",
  checked: false,
  sentAt: null,
  attempt: 0,
};

const SETTLED: Readonly<Record<ItemReplyOutcome, ReplyDelivery>> = {
  sent: "idle",
  rejected: "error",
  uncertain: "uncertain",
};

/**
 * Page-scoped owner of reply drafts and delivery attempts, keyed by section
 * and stable lineage. Current and its derived Next share one entry, and the
 * entry outlives a closed comments view.
 */
export interface ItemDiscussionStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly read: (key: string) => ReplyDraft;
  readonly edit: (key: string, value: string) => void;
  /**
   * Dispatches the draft once. Resolves to null when nothing was dispatched
   * or the entry was dropped before the answer arrived.
   */
  readonly send: (
    key: string,
    dispatch: (text: string) => Promise<ItemReplyOutcome>,
  ) => Promise<ItemReplyOutcome | null>;
  /** Records the user-directed check that unlocks a duplicate-risk resend. */
  readonly markChecked: (key: string) => void;
  /** Forgets the entry: access to the discussion is lost. */
  readonly drop: (key: string) => void;
}

function isBlocked(draft: ReplyDraft): boolean {
  return (
    draft.delivery === "pending" ||
    (draft.delivery === "uncertain" && !draft.checked)
  );
}

export function createItemDiscussionStore(): ItemDiscussionStore {
  const drafts = new Map<string, ReplyDraft>();
  const listeners = new Set<() => void>();
  let attempts = 0;
  const read = (key: string) => drafts.get(key) ?? EMPTY;
  const write = (key: string, next: Partial<ReplyDraft>) => {
    drafts.set(key, { ...read(key), ...next });
    for (const listener of listeners) listener();
  };
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read,
    edit: (key, value) => {
      const draft = read(key);
      write(key, {
        value,
        sequence: draft.sequence + 1,
        delivery: draft.delivery === "error" ? "idle" : draft.delivery,
      });
    },
    send: async (key, dispatch) => {
      const draft = read(key);
      const text = draft.value.trim();
      if (!text || isBlocked(draft)) return null;
      attempts += 1;
      const attempt = attempts;
      write(key, { delivery: "pending", checked: false, attempt });
      const outcome = await dispatch(text);
      const current = drafts.get(key);
      // A dropped or superseded entry is not settled by a late answer.
      if (current?.attempt !== attempt) return null;
      const sent = outcome === "sent";
      write(key, {
        delivery: SETTLED[outcome],
        ...(sent ? { sentAt: Date.now() } : {}),
        ...(sent && current.sequence === draft.sequence ? { value: "" } : {}),
      });
      return outcome;
    },
    markChecked: (key) => {
      if (read(key).delivery === "uncertain") write(key, { checked: true });
    },
    drop: (key) => {
      if (!drafts.delete(key)) return;
      for (const listener of listeners) listener();
    },
  };
}
