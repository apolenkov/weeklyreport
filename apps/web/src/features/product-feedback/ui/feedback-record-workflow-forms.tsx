"use client";

import {
  MAX_FEEDBACK_DISMISS_REASON_LENGTH,
  MAX_FEEDBACK_MESSAGE_LENGTH,
} from "@weeklyreport/shared";
import { useEffect, useRef, useState } from "react";

import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";
import type { FeedbackCardItem } from "./feedback-record-card";

function FormActions({
  pending,
  disabled,
  submitLabel,
  pendingLabel,
  onCancel,
}: {
  readonly pending: boolean;
  readonly disabled: boolean;
  readonly submitLabel: string;
  readonly pendingLabel: string;
  readonly onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
      <button
        className="min-h-11 rounded-lg bg-[var(--color-starbucks-accent)] px-3 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || pending}
        type="submit"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}

export function FeedbackEditForm({
  item,
  onEdit,
  onCancel,
}: {
  readonly item: FeedbackCardItem;
  readonly onEdit: (id: string, value: string) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const [value, setValue] = useState(item.message);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Ref guard: two submits in the same tick share one render closure, so a
  // state flag alone cannot stop the second call. Reset only on failure;
  // success unmounts via onCancel.
  const busyRef = useRef(false);
  return (
    <form
      id={`feedback-edit-${item.id}`}
      className="mt-4 grid w-full gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void (async () => {
          if (busyRef.current || !value.trim()) return;
          busyRef.current = true;
          setPending(true);
          setError("");
          try {
            await onEdit(item.id, value.trim());
            onCancel();
          } catch {
            setError("Could not update feedback. Try again.");
            busyRef.current = false;
            setPending(false);
          }
        })();
      }}
    >
      <label className="grid gap-1 text-sm font-medium">
        Original feedback
        <textarea
          className="min-h-24 rounded-lg border border-[var(--color-border)] bg-transparent p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          maxLength={MAX_FEEDBACK_MESSAGE_LENGTH}
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <FormActions
        pending={pending}
        disabled={!value.trim()}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        onCancel={onCancel}
      />
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function FeedbackReplyForm({
  item,
  onReply,
  onCancel,
}: {
  readonly item: FeedbackCardItem;
  readonly onReply: (id: string, value: string) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Same-tick double-submit guard; see FeedbackEditForm.
  const busyRef = useRef(false);
  return (
    <form
      id={`feedback-reply-${item.id}`}
      className="mt-4 grid w-full gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void (async () => {
          if (busyRef.current || !value.trim()) return;
          busyRef.current = true;
          setPending(true);
          setError("");
          try {
            await onReply(item.id, value.trim());
            onCancel();
          } catch {
            setError("Could not send reply. Try again.");
            busyRef.current = false;
            setPending(false);
          }
        })();
      }}
    >
      <label className="grid gap-1 text-sm font-medium">
        Reply
        <textarea
          className="min-h-20 rounded-lg border border-[var(--color-border)] bg-transparent p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          maxLength={MAX_FEEDBACK_MESSAGE_LENGTH}
          placeholder="Add context for the author…"
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <FormActions
        pending={pending}
        disabled={!value.trim()}
        submitLabel="Send reply"
        pendingLabel="Sending…"
        onCancel={onCancel}
      />
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function FeedbackDismissForm({
  item,
  onDismiss,
  onCancel,
}: {
  readonly item: FeedbackCardItem;
  readonly onDismiss: (id: string, reason: string) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Same-tick double-submit guard; see FeedbackEditForm.
  const busyRef = useRef(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    reasonRef.current?.focus();
  }, []);
  return (
    <section
      id={`feedback-dismiss-${item.id}`}
      aria-label="Confirm dismissal"
      className="mt-4 w-full rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <p className="text-sm font-medium text-red-900">Dismiss this feedback?</p>
      <label className="mt-2 grid gap-1 text-sm text-red-900">
        Reason (required)
        <textarea
          ref={reasonRef}
          className="min-h-20 rounded-lg border border-red-300 bg-white p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
          maxLength={MAX_FEEDBACK_DISMISS_REASON_LENGTH}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="min-h-11 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!reason.trim() || pending}
          onClick={() => {
            void (async () => {
              if (busyRef.current || !reason.trim()) return;
              busyRef.current = true;
              setPending(true);
              setError("");
              try {
                await onDismiss(item.id, reason.trim());
                onCancel();
              } catch {
                setError("Could not dismiss feedback. Try again.");
                busyRef.current = false;
                setPending(false);
              }
            })();
          }}
          type="button"
        >
          {pending ? "Dismissing…" : "Confirm dismiss"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function FeedbackDeleteForm({
  item,
  onDelete,
  onCancel,
}: {
  readonly item: FeedbackCardItem;
  readonly onDelete: (id: string) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Same-tick double-submit guard; see FeedbackEditForm.
  const busyRef = useRef(false);
  return (
    <ConfirmationDialog
      open={true}
      onClose={onCancel}
      onConfirm={() => {
        void (async () => {
          if (busyRef.current) return;
          busyRef.current = true;
          setPending(true);
          setError("");
          try {
            await onDelete(item.id);
            onCancel();
          } catch {
            setError("Could not delete feedback. Try again.");
            busyRef.current = false;
            setPending(false);
          }
        })();
      }}
      title="Delete this feedback permanently?"
      description="This removes the feedback, conversation, and captured evidence for everyone. This cannot be undone."
      confirmLabel={pending ? "Deleting…" : "Delete permanently"}
      cancelLabel="Cancel"
      variant="destructive"
      isPending={pending}
    >
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </ConfirmationDialog>
  );
}
