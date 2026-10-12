"use client";

import {
  type FeedbackResponse,
  feedbackResponseSchema,
  type FeedbackStatus,
  type FeedbackType,
} from "@weeklyreport/shared";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { z } from "zod";

type FilterValue<T extends string> = T | "all";
const FEEDBACK_UPDATE_ERROR = "Feedback update failed";
const SAME_ORIGIN = "same-origin";
const feedbackInboxSchema = z.object({
  feedback: z.array(feedbackResponseSchema),
  total: z.number().int().nonnegative(),
});
interface FeedbackInboxItem {
  readonly id: string;
  readonly type: FeedbackType;
  readonly status: FeedbackStatus;
  readonly url: string;
  readonly message: string;
  readonly authorName: string;
  readonly authorUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly viewport: string;
  readonly annotations: readonly unknown[];
  readonly screenshotUrl: string | null;
  readonly screenshotRegion: {
    readonly xPct: number;
    readonly yPct: number;
    readonly wPct: number;
    readonly hPct: number;
  } | null;
  readonly diagnostics: FeedbackResponse["diagnostics"];
  readonly agentationSessionId?: string;
  readonly agentationAnnotationId?: string;
  readonly source: FeedbackResponse["source"];
  readonly capabilities: FeedbackResponse["capabilities"];
  readonly thread: FeedbackResponse["thread"];
  readonly agentationContext: FeedbackResponse["agentationContext"];
}
function fromResponse(parsed: FeedbackResponse): FeedbackInboxItem {
  const { agentationAnnotationId, agentationSessionId, ...record } = parsed;
  return {
    ...record,
    createdAt: new Date(parsed.createdAt),
    updatedAt: new Date(parsed.updatedAt),
    ...(agentationSessionId ? { agentationSessionId } : {}),
    ...(agentationAnnotationId ? { agentationAnnotationId } : {}),
  };
}

interface InboxSnapshot {
  readonly items: FeedbackInboxItem[];
  readonly total: number;
}

const EMPTY_INBOX: InboxSnapshot = { items: [], total: 0 };

function useFeedbackMutations(
  setInbox: Dispatch<SetStateAction<InboxSnapshot>>,
) {
  // Routes through `mutate` so the server-returned record (incl. updatedAt)
  // replaces the row instead of a local status-only patch.
  const changeStatus = (id: string, nextStatus: FeedbackStatus) =>
    mutate(id, "/status", { status: nextStatus });

  const mutate = async (id: string, path: string, body: unknown) => {
    const response = await fetch(
      `/api/v1/feedback/${encodeURIComponent(id)}${path}`,
      {
        method: path === "/status" ? "PATCH" : path === "" ? "PUT" : "POST",
        credentials: SAME_ORIGIN,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) throw new Error(FEEDBACK_UPDATE_ERROR);
    const parsed = feedbackResponseSchema.parse(await response.json());
    setInbox((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? fromResponse(parsed) : item,
      ),
    }));
  };

  const editOriginal = (id: string, comment: string) =>
    mutate(id, "", { comment });
  const reply = (id: string, content: string) =>
    mutate(id, "/replies", { content });
  const dismiss = (id: string, reason: string) =>
    mutate(id, "/dismiss", { reason });
  const deleteFeedback = async (id: string) => {
    const response = await fetch(`/api/v1/feedback/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: SAME_ORIGIN,
    });
    if (!response.ok) throw new Error("Feedback delete failed");
    // The merged list is bounded server-side, so an acknowledged delete also
    // shrinks the reported scope total by one.
    setInbox((current) => ({
      items: current.items.filter((item) => item.id !== id),
      total: Math.max(0, current.total - 1),
    }));
  };

  return { changeStatus, editOriginal, reply, dismiss, deleteFeedback };
}

export function useProductFeedbackInbox(onError: () => void) {
  const [inbox, setInbox] = useState<InboxSnapshot>(EMPTY_INBOX);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterValue<FeedbackStatus>>("all");
  const [type, setType] = useState<FilterValue<FeedbackType>>("all");

  // Hold the caller's handler in a ref so `refresh` stays stable across renders;
  // an inline `onError` must not re-trigger the mount fetch loop.
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(
        "/api/v1/feedback?limit=100&format=internal",
        {
          cache: "no-store",
          credentials: SAME_ORIGIN,
        },
      );
      if (!response.ok) throw new Error("Feedback request failed");
      const payload = feedbackInboxSchema.parse(await response.json());
      setInbox({
        items: payload.feedback.map(fromResponse),
        total: payload.total,
      });
    } catch {
      setError(true);
      onErrorRef.current();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refresh]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return inbox.items.filter(
      (item) =>
        (status === "all" || item.status === status) &&
        (type === "all" || item.type === type) &&
        (!needle ||
          item.message.toLowerCase().includes(needle) ||
          item.authorName.toLowerCase().includes(needle)),
    );
  }, [inbox.items, search, status, type]);

  const { changeStatus, editOriginal, reply, dismiss, deleteFeedback } =
    useFeedbackMutations(setInbox);

  const view = loading
    ? "loading"
    : error
      ? "error"
      : filteredItems.length === 0
        ? "empty"
        : "ready";

  return {
    items: filteredItems,
    loadedCount: inbox.items.length,
    total: inbox.total,
    // The API merges at most `limit` newest records; `total` is the whole
    // scoped set, so the UI can say filters only reach the loaded slice.
    hasMore: inbox.total > inbox.items.length,
    search,
    setSearch,
    status,
    setStatus,
    type,
    setType,
    view,
    refresh,
    changeStatus,
    editOriginal,
    reply,
    dismiss,
    deleteFeedback,
  } as const;
}
