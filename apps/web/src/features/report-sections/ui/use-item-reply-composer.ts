"use client";

import { useQuery } from "@tanstack/react-query";
import type { RecordCommentView } from "@weeklyreport/shared";
import { useEffect, useSyncExternalStore } from "react";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import type { StatusOverviewItem } from "../model/status-overview";
import { canDiscussItem } from "../model/status-overview-discussion";
import type { ReplyDraft } from "./item-discussion-store";
import { useItemReplyScope } from "./item-reply-context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED_CODES: ReadonlySet<string> = new Set([
  "FORBIDDEN",
  "UNAUTHORIZED",
]);
const NO_COMMENTS: readonly RecordCommentView[] = [];

type ReplyScope = NonNullable<ReturnType<typeof useItemReplyScope>>;

interface DiscussionTarget {
  readonly scope: ReplyScope;
  readonly reportSectionId: string;
  readonly stableId: string;
  /** One entry per section and lineage: Current and derived Next share it. */
  readonly key: string;
}

// Only a persisted own record of the live section has a discussion the Lead
// can read and answer; a local row has no proven server identity.
function discussionTarget(
  scope: ReplyScope | null,
  item: StatusOverviewItem,
): DiscussionTarget | null {
  const reportSectionId = scope?.port.reportSectionId;
  if (
    !scope ||
    !reportSectionId ||
    !canDiscussItem(item) ||
    item.recordId === null ||
    item.stableId === null ||
    !UUID_RE.test(item.recordId) ||
    !UUID_RE.test(item.stableId)
  )
    return null;
  return {
    scope,
    reportSectionId,
    stableId: item.stableId,
    key: `${reportSectionId}:${item.stableId}`,
  };
}

// The server or middleware said the Lead may no longer see this discussion.
function isAccessDenied(error: unknown): boolean {
  const code = (error as { data?: { code?: unknown } } | null)?.data?.code;
  return typeof code === "string" && DENIED_CODES.has(code);
}

interface ReadState {
  readonly isError: boolean;
  readonly dataUpdatedAt: number;
}

// A confirmed reply whose follow-up read failed is "sent, refresh failed":
// delivery is known, only the visible list is behind.
function composerState(draft: ReplyDraft, read: ReadState) {
  if (draft.delivery !== "idle") return draft.delivery;
  return draft.sentAt !== null &&
    read.isError &&
    read.dataUpdatedAt < draft.sentAt
    ? "refresh-failed"
    : "idle";
}

const noSubscription = () => () => undefined;

/**
 * The live discussion of one open Overview item: an uncached read and the
 * Lead's reply composer. Draft text and the one delivery attempt live in the
 * page's discussion store, so they survive a closed card and are shared by
 * Current and its derived Next. Nothing is resent automatically, a read never
 * resolves an uncertain delivery, and discussion activity never reloads the
 * editor.
 */
export function useItemDiscussion(item: StatusOverviewItem) {
  const trpc = useTRPC();
  const target = discussionTarget(useItemReplyScope(), item);
  const store = target?.scope.store;
  const key = target?.key ?? "";
  const draft = useSyncExternalStore(
    store?.subscribe ?? noSubscription,
    () => store?.read(key) ?? null,
    () => null,
  );
  const query = useQuery({
    ...trpc.review.leadItemDiscussion.queryOptions({
      reportSectionId: target?.reportSectionId ?? "",
      stableId: target?.stableId ?? "",
    }),
    enabled: target !== null,
    staleTime: 0,
    gcTime: 0,
  });
  const denied =
    query.data?.status === "unavailable" || isAccessDenied(query.error);
  useEffect(() => {
    if (denied) store?.drop(key);
  }, [denied, store, key]);
  if (!target || !draft) return { comments: item.comments, reply: {} };
  // Known access loss hides the messages and the draft at once.
  if (denied)
    return { comments: NO_COMMENTS, reply: { notice: "unavailable" as const } };
  const comments =
    query.data?.status === "available" ? query.data.comments : item.comments;
  const send = () =>
    void target.scope.store
      .send(key, (text) => target.scope.port.send(item, text))
      .then((outcome) => (outcome === "sent" ? query.refetch() : null));
  const onRefresh = () =>
    void query.refetch().then((result) => {
      if (result.isSuccess) target.scope.store.markChecked(key);
    });
  const state = composerState(draft, query);
  const base = {
    value: draft.value,
    onChange: (value: string) => target.scope.store.edit(key, value),
    onSend: send,
  };
  const stale = query.isError && state !== "refresh-failed";
  return {
    comments,
    reply: {
      ...(stale ? { notice: "stale" as const, onRefresh } : {}),
      composer:
        state === "uncertain"
          ? {
              ...base,
              state,
              onRefresh,
              ...(draft.checked ? { onResend: send } : {}),
            }
          : state === "refresh-failed"
            ? { ...base, state, onRefresh }
            : { ...base, state },
    },
  };
}
