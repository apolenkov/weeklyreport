"use client";

import { useQuery } from "@tanstack/react-query";
import type { RecordCommentView } from "@weeklyreport/shared";
import { useState } from "react";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import type { StatusOverviewItem } from "../model/status-overview";
import {
  type ItemReplyOutcome,
  type ItemReplyPort,
  useItemReplyPort,
} from "./item-reply-context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNCERTAIN = "uncertain";
const REFRESH_FAILED = "refresh-failed";

type ComposerState =
  "idle" | "pending" | "error" | typeof UNCERTAIN | typeof REFRESH_FAILED;

interface Draft {
  readonly key: string;
  readonly value: string;
  readonly state: ComposerState;
}

const SETTLED: Readonly<Record<ItemReplyOutcome, ComposerState>> = {
  sent: "idle",
  rejected: "error",
  [UNCERTAIN]: UNCERTAIN,
};

interface DiscussionTarget {
  readonly port: ItemReplyPort;
  readonly reportSectionId: string;
  readonly stableId: string;
}

// Only a persisted own editable record of the live section has a discussion
// the Lead can read and answer; a local row has no proven server identity.
function discussionTarget(
  port: ItemReplyPort | null,
  item: StatusOverviewItem,
): DiscussionTarget | null {
  if (
    !port?.reportSectionId ||
    item.editTarget === null ||
    item.recordId === null ||
    item.stableId === null ||
    !UUID_RE.test(item.recordId) ||
    !UUID_RE.test(item.stableId)
  )
    return null;
  return {
    port,
    reportSectionId: port.reportSectionId,
    stableId: item.stableId,
  };
}

/**
 * The live discussion of one open Overview item: an uncached read and the
 * Lead's reply composer. A failed or uncertain send keeps the typed text;
 * nothing is resent automatically, and discussion activity never reloads the
 * editor.
 */
export function useItemDiscussion(item: StatusOverviewItem) {
  const trpc = useTRPC();
  const target = discussionTarget(useItemReplyPort(), item);
  const query = useQuery({
    ...trpc.review.leadItemDiscussion.queryOptions({
      reportSectionId: target?.reportSectionId ?? "",
      stableId: target?.stableId ?? "",
    }),
    enabled: target !== null,
    staleTime: 0,
    gcTime: 0,
  });
  const [draft, setDraft] = useState<Draft>({
    key: item.key,
    value: "",
    state: "idle",
  });
  const current: Draft =
    draft.key === item.key
      ? draft
      : { key: item.key, value: "", state: "idle" };
  const live = query.data?.status === "available" ? query.data : null;
  const comments: readonly RecordCommentView[] =
    live?.comments ?? item.comments;
  if (!target || query.data?.status === "unavailable")
    return { comments, reply: {} };
  const update = (next: Partial<Draft>) =>
    setDraft((previous) => ({
      ...(previous.key === item.key ? previous : current),
      ...next,
    }));
  const reread = async () => (await query.refetch()).isSuccess;
  const onSend = () => {
    const text = current.value.trim();
    if (!text || current.state === "pending") return;
    update({ state: "pending" });
    void target.port.send(item, text).then(async (outcome) => {
      if (outcome !== "sent") {
        update({ state: SETTLED[outcome] });
        return;
      }
      update({
        value: "",
        state: (await reread()) ? "idle" : REFRESH_FAILED,
      });
    });
  };
  const onRefresh = () => {
    void reread().then((ok) => {
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
  const composer =
    current.state === UNCERTAIN || current.state === REFRESH_FAILED
      ? { ...base, state: current.state, onRefresh }
      : { ...base, state: current.state };
  return { comments, reply: { composer } };
}
