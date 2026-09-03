"use client";

import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackStatus,
  type FeedbackType,
} from "@customreport/shared";
import { useSitepingInbox } from "@siteping/dashboard";
import {
  ExternalLink,
  LoaderCircle,
  MessageSquareText,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { useSession } from "../../../shared/lib/auth/session-provider";

const STATUS_LABELS: Readonly<Record<FeedbackStatus, string>> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

const TYPE_LABELS: Readonly<Record<FeedbackType, string>> = {
  question: "Question",
  change: "Change",
  bug: "Bug",
  other: "Other",
};

function formatSubmitted(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function annotationHref(
  url: string,
  feedbackId: string,
  authorUserId: string | undefined,
  role: string | undefined,
): string {
  const leadReport = /^\/lead\/report(?:\/([^/]+))?$/.exec(url);
  if (leadReport && authorUserId && (role === "head" || role === "admin")) {
    const search = new URLSearchParams({
      authorId: authorUserId,
      siteping: feedbackId,
      sitepingUrl: url,
    });
    const reportId = leadReport[1];
    const reportPath = reportId ? `/${encodeURIComponent(reportId)}` : "";
    return `/head/report${reportPath}?${search.toString()}`;
  }
  const search = new URLSearchParams({ siteping: feedbackId });
  return `${url}?${search.toString()}`;
}

export function ProductFeedbackPage() {
  const { user } = useSession();
  const inbox = useSitepingInbox({
    endpoint: "/api/siteping",
    projects: "weekly-report",
    pageSize: 50,
    onError: () => toast.error("Feedback could not be loaded."),
  });
  const canTriage = user?.role === "head" || user?.role === "admin";
  const canDelete = user?.role === "admin";
  const scopeLabel = useMemo(() => {
    if (user?.role === "admin") return "All Weekly Report feedback";
    if (user?.role === "head") return "Your reporting group and your feedback";
    return "Your feedback";
  }, [user?.role]);

  const changeStatus = async (id: string, status: FeedbackStatus) => {
    try {
      await inbox.changeStatus(id, status);
      toast.success("Feedback status updated.");
    } catch {
      toast.error("Feedback status could not be updated.");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Permanently delete this feedback?")) return;
    try {
      await inbox.deleteFeedback(id);
      toast.success("Feedback deleted.");
    } catch {
      toast.error("Feedback could not be deleted.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl bg-[var(--color-starbucks-accent)]/10 p-3 text-[var(--color-starbucks-accent)]">
          <MessageSquareText aria-hidden="true" className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">
            Feedback
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {scopeLabel}. Draw an area with the feedback button, or right-click
            any element—including top navigation controls—to comment without the
            drawing toolbar.
          </p>
        </div>
      </div>

      <section
        aria-label="Feedback filters"
        className="mb-5 grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 md:grid-cols-3"
      >
        <label className="grid gap-1 text-sm font-medium">
          Search
          <input
            className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 font-normal"
            onChange={(event) => inbox.setSearch(event.target.value)}
            placeholder="Message or author"
            type="search"
            value={inbox.search}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Status
          <select
            className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 font-normal"
            onChange={(event) =>
              inbox.setStatus(event.target.value as FeedbackStatus | "all")
            }
            value={inbox.status}
          >
            <option value="all">All statuses</option>
            {FEEDBACK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Type
          <select
            className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 font-normal"
            onChange={(event) =>
              inbox.setType(event.target.value as FeedbackType | "all")
            }
            value={inbox.type}
          >
            <option value="all">All types</option>
            {FEEDBACK_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
      </section>

      {inbox.view === "loading" && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-ink-muted)]">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Loading feedback…
        </div>
      )}
      {inbox.view === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"
        >
          Feedback is unavailable. Please try again.
          <button
            className="ml-2 underline"
            onClick={() => void inbox.refresh()}
            type="button"
          >
            Retry
          </button>
        </div>
      )}
      {inbox.view === "empty" && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-ink-muted)]">
          No feedback matches these filters.
        </div>
      )}
      {inbox.view === "ready" && (
        <div className="grid gap-3" aria-live="polite">
          {inbox.items.map((feedback) => (
            <article
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5"
              key={feedback.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <a
                  aria-label={`Open annotation on ${feedback.url}`}
                  className="group min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2"
                  href={annotationHref(
                    feedback.url,
                    feedback.id,
                    (
                      feedback as typeof feedback & {
                        authorUserId?: string;
                      }
                    ).authorUserId,
                    user?.role,
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 font-medium">
                      {TYPE_LABELS[feedback.type]}
                    </span>
                    <span>{feedback.url}</span>
                    <ExternalLink
                      aria-hidden="true"
                      className="size-3.5 opacity-60 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-[var(--color-ink)]">
                    {feedback.message}
                  </p>
                  <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
                    {feedback.authorName} ·{" "}
                    {formatSubmitted(feedback.createdAt)}
                  </p>
                </a>
                <div className="flex items-center gap-2">
                  {canTriage ? (
                    <select
                      aria-label={`Status for feedback from ${feedback.authorName}`}
                      className="rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
                      onChange={(event) =>
                        void changeStatus(
                          feedback.id,
                          event.target.value as FeedbackStatus,
                        )
                      }
                      value={feedback.status}
                    >
                      {FEEDBACK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-xs">
                      {STATUS_LABELS[feedback.status]}
                    </span>
                  )}
                  {canDelete && (
                    <button
                      aria-label="Delete feedback"
                      className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
                      onClick={() => void remove(feedback.id)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {inbox.hasMore && (
            <button
              className="mx-auto rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
              disabled={inbox.loadingMore}
              onClick={() => void inbox.loadMore()}
              type="button"
            >
              {inbox.loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
