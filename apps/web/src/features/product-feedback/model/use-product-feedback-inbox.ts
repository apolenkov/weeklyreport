"use client";

import {
  type FeedbackResponse,
  feedbackResponseSchema,
  type FeedbackStatus,
  type FeedbackType,
} from "@customreport/shared";
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

function useFeedbackMutations(
  setItems: Dispatch<SetStateAction<FeedbackInboxItem[]>>,
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
    setItems((current) =>
      current.map((item) => (item.id === id ? fromResponse(parsed) : item)),
    );
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
    setItems((current) => current.filter((item) => item.id !== id));
  };

  return { changeStatus, editOriginal, reply, dismiss, deleteFeedback };
}

export function useProductFeedbackInbox(onError: () => void) {
  const [items, setItems] = useState<FeedbackInboxItem[]>([]);
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
      setItems(payload.feedback.map(fromResponse));
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
    return items.filter(
      (item) =>
        (status === "all" || item.status === status) &&
        (type === "all" || item.type === type) &&
        (!needle ||
          item.message.toLowerCase().includes(needle) ||
          item.authorName.toLowerCase().includes(needle)),
    );
  }, [items, search, status, type]);

  const { changeStatus, editOriginal, reply, dismiss, deleteFeedback } =
    useFeedbackMutations(setItems);

  const view = loading
    ? "loading"
    : error
      ? "error"
      : filteredItems.length === 0
        ? "empty"
        : "ready";

  return {
    items: filteredItems,
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
