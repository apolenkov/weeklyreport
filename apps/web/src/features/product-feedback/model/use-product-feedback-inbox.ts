"use client";

import {
  feedbackResponseSchema,
  type FeedbackStatus,
  type FeedbackType,
} from "@customreport/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

type FilterValue<T extends string> = T | "all";
interface FeedbackInboxItem {
  readonly id: string;
  readonly type: FeedbackType;
  readonly status: FeedbackStatus;
  readonly url: string;
  readonly message: string;
  readonly authorName: string;
  readonly authorUserId: string;
  readonly createdAt: Date;
  readonly viewport: string;
  readonly annotations: readonly unknown[];
  readonly screenshotUrl: string | null;
  readonly screenshotRegion: {
    readonly xPct: number;
    readonly yPct: number;
    readonly wPct: number;
    readonly hPct: number;
  } | null;
  readonly agentationSessionId?: string;
  readonly agentationAnnotationId?: string;
  readonly diagnostics: {
    readonly console: readonly {
      readonly level: string;
      readonly message: string;
      readonly timestamp: string;
    }[];
    readonly network: readonly {
      readonly method: string;
      readonly status: number;
      readonly url: string;
      readonly timestamp: string;
    }[];
  } | null;
}

export function useProductFeedbackInbox(onError: () => void) {
  const [items, setItems] = useState<FeedbackInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterValue<FeedbackStatus>>("all");
  const [type, setType] = useState<FilterValue<FeedbackType>>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(
        "/api/v1/feedback?limit=100&format=internal",
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );
      if (!response.ok) throw new Error("Feedback request failed");
      const payload = (await response.json()) as { feedback: unknown[] };
      setItems(
        payload.feedback.map((value) => {
          const parsed = feedbackResponseSchema.parse(value);
          return {
            id: parsed.id,
            type: parsed.type,
            status: parsed.status,
            url: parsed.url,
            message: parsed.message,
            authorName: parsed.authorName,
            authorUserId: parsed.authorUserId,
            createdAt: new Date(parsed.createdAt),
            viewport: parsed.viewport,
            annotations: parsed.annotations,
            screenshotUrl: parsed.screenshotUrl,
            screenshotRegion: parsed.screenshotRegion,
            diagnostics: parsed.diagnostics,
            ...(parsed.agentationSessionId
              ? { agentationSessionId: parsed.agentationSessionId }
              : {}),
            ...(parsed.agentationAnnotationId
              ? { agentationAnnotationId: parsed.agentationAnnotationId }
              : {}),
          };
        }),
      );
    } catch {
      setError(true);
      onError();
    } finally {
      setLoading(false);
    }
  }, [onError]);

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

  const changeStatus = async (id: string, nextStatus: FeedbackStatus) => {
    const response = await fetch(
      `/api/v1/feedback/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      },
    );
    if (!response.ok) throw new Error("Feedback status update failed");
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: nextStatus } : item,
      ),
    );
  };

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
  } as const;
}
