"use client";

import { useState } from "react";

import type { StatusOverviewItem } from "../model/status-overview";
import { type ItemReplyOutcome, useItemReplyPort } from "./item-reply-context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ComposerState =
  "idle" | "pending" | "error" | "uncertain" | "refresh-failed";

interface Draft {
  readonly key: string;
  readonly value: string;
  readonly state: ComposerState;
}

const UNCERTAIN = "uncertain";
const REFRESH_FAILED = "refresh-failed";

const SETTLED: Readonly<Record<ItemReplyOutcome, ComposerState>> = {
  sent: "idle",
  rejected: "error",
  [UNCERTAIN]: UNCERTAIN,
  [REFRESH_FAILED]: REFRESH_FAILED,
};

// Only a persisted own editable record can take a reply; a local row has no
// proven server identity, so the composer is withheld instead of guessing.
function canReply(item: StatusOverviewItem): item is StatusOverviewItem & {
  readonly recordId: string;
} {
  return (
    item.editTarget !== null &&
    item.recordId !== null &&
    UUID_RE.test(item.recordId)
  );
}

/**
 * The Lead's reply composer for one Overview item. A failed or uncertain send
 * keeps the typed text; nothing is resent automatically.
 */
function useItemReplyComposer(item: StatusOverviewItem) {
  const port = useItemReplyPort();
  const [draft, setDraft] = useState<Draft>({
    key: item.key,
    value: "",
    state: "idle",
  });
  // A different record starts with an empty composer.
  const current: Draft =
    draft.key === item.key
      ? draft
      : { key: item.key, value: "", state: "idle" };
  if (!port || !canReply(item)) return undefined;
  const update = (next: Partial<Draft>) =>
    setDraft((previous) => ({
      ...(previous.key === item.key ? previous : current),
      ...next,
    }));
  const onSend = () => {
    const text = current.value.trim();
    if (!text || current.state === "pending") return;
    update({ state: "pending" });
    void port.send(item, text).then((outcome) =>
      update({
        state: SETTLED[outcome],
        ...(outcome === "sent" || outcome === REFRESH_FAILED
          ? { value: "" }
          : {}),
      }),
    );
  };
  const onRefresh = () => {
    void port.refresh().then((ok) => {
      if (ok) update({ state: "idle" });
    });
  };
  const base = {
    value: current.value,
    onChange: (value: string) =>
      update({
        value,
        ...(current.state === "error" ? { state: "idle" as const } : {}),
      }),
    onSend,
  };
  return current.state === UNCERTAIN || current.state === REFRESH_FAILED
    ? { ...base, state: current.state, onRefresh }
    : { ...base, state: current.state };
}

/** Comments-view props: the composer only where the Lead may reply. */
export function useItemReplyProps(item: StatusOverviewItem) {
  const composer = useItemReplyComposer(item);
  return composer ? { composer } : {};
}
