"use client";

import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackStatus,
  type FeedbackType,
} from "@customreport/shared";
import { LoaderCircle, MessageSquareText } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { useSession } from "../../../shared/lib/auth/session-provider";
import { useProductFeedbackInbox } from "../model/use-product-feedback-inbox";
import {
  FeedbackRecordCard,
  STATUS_LABELS,
  TYPE_LABELS,
} from "./feedback-record-card";

export function ProductFeedbackPage() {
  const { user } = useSession();
  const inbox = useProductFeedbackInbox(() =>
    toast.error("Feedback could not be loaded."),
  );
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

  const runAction = async (
    action: () => Promise<void>,
    success: string,
    failure: string,
  ) => {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(failure);
      throw error;
    }
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl bg-[var(--color-starbucks-accent)]/10 p-3 text-[var(--color-starbucks-accent)]">
          <MessageSquareText aria-hidden="true" className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">
            Feedback
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {scopeLabel}. Use Agentation to mark elements, text, page areas, or
            proposed layout changes and send structured context to an agent.
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
            autoComplete="off"
            className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 font-normal"
            name="feedbackSearch"
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
            name="feedbackStatus"
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
            name="feedbackType"
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
            <FeedbackRecordCard
              item={feedback}
              key={feedback.id}
              onChangeStatus={(id, status) => void changeStatus(id, status)}
              onEdit={(id, comment) =>
                runAction(
                  () => inbox.editOriginal(id, comment),
                  "Feedback updated.",
                  "Feedback could not be updated.",
                )
              }
              onReply={(id, content) =>
                runAction(
                  () => inbox.reply(id, content),
                  "Reply added.",
                  "Reply could not be added.",
                )
              }
              onDismiss={(id, reason) =>
                runAction(
                  () => inbox.dismiss(id, reason),
                  "Feedback dismissed.",
                  "Feedback could not be dismissed.",
                )
              }
              onDelete={(id) =>
                runAction(
                  () => inbox.deleteFeedback(id),
                  "Feedback deleted.",
                  "Feedback could not be deleted.",
                )
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
