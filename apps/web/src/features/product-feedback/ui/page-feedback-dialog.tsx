"use client";

import {
  FEEDBACK_TYPES,
  type FeedbackType,
  MAX_FEEDBACK_MESSAGE_LENGTH,
} from "@customreport/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@customreport/ui/components/ui/dialog";
import { MessageSquarePlus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { submitPageFeedback } from "../model/page-feedback-client";

const TYPE_LABELS: Readonly<Record<FeedbackType, string>> = {
  question: "Question",
  change: "Change",
  bug: "Bug",
  other: "Other",
};

export function PageFeedbackDialog() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("other");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const valid = message.trim().length > 0;

  const close = () => {
    if (!submitting) setOpen(false);
  };

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitPageFeedback({ type, message });
      setMessage("");
      setType("other");
      setOpen(false);
      toast.success("Page feedback sent.");
    } catch {
      setError("Page feedback could not be sent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        className="fixed bottom-4 left-4 z-[var(--layer-popover)] inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] shadow-lg transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        type="button"
      >
        <MessageSquarePlus aria-hidden="true" className="size-4" />
        Comment on page
      </button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
        }}
      >
        <DialogContent
          className="z-[var(--layer-dialog)] w-full max-w-[calc(100%-2rem)] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl sm:max-w-md"
          initialFocusRef={messageRef}
          onEscapeKeyDown={(event) => {
            if (submitting) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (submitting) event.preventDefault();
          }}
          overlayClassName="z-[var(--layer-overlay)] bg-[var(--color-overlay)]"
          restoreFocusRef={triggerRef}
          showCloseButton={!submitting}
        >
          <DialogTitle>Comment on page</DialogTitle>
          <DialogDescription>
            Share feedback about this page without attaching it to an element.
          </DialogDescription>

          <label className="grid gap-1.5 text-sm font-medium text-[var(--color-ink)]">
            Type
            <select
              autoComplete="off"
              className="rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 font-normal"
              disabled={submitting}
              name="feedbackType"
              onChange={(event) => setType(event.target.value as FeedbackType)}
              value={type}
            >
              {FEEDBACK_TYPES.map((value) => (
                <option key={value} value={value}>
                  {TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-[var(--color-ink)]">
            Comment
            <textarea
              ref={messageRef}
              autoComplete="off"
              className="min-h-28 resize-y rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 font-normal"
              disabled={submitting}
              maxLength={MAX_FEEDBACK_MESSAGE_LENGTH}
              name="feedbackComment"
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What should we know about this page?"
              required
              value={message}
            />
          </label>

          {error && (
            <p className="text-sm text-[var(--color-destructive)]" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold"
              disabled={submitting}
              onClick={close}
              type="button"
            >
              Cancel
            </button>
            <button
              aria-busy={submitting}
              className="rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!valid || submitting}
              onClick={() => void submit()}
              type="button"
            >
              {submitting ? "Sending…" : "Send feedback"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
