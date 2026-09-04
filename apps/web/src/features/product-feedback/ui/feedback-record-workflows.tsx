"use client";

import { type MouseEvent, useRef, useState } from "react";

import type { FeedbackCardItem } from "./feedback-record-card";
import {
  FeedbackDeleteForm,
  FeedbackDismissForm,
  FeedbackEditForm,
  FeedbackReplyForm,
} from "./feedback-record-workflow-forms";

interface WorkflowProps {
  readonly item: FeedbackCardItem;
  readonly onEdit?:
    ((id: string, comment: string) => Promise<void>) | undefined;
  readonly onReply?:
    ((id: string, content: string) => Promise<void>) | undefined;
  readonly onDismiss?:
    ((id: string, reason: string) => Promise<void>) | undefined;
  readonly onDelete?: ((id: string) => Promise<void>) | undefined;
}

export function FeedbackRecordWorkflows({
  item,
  onEdit,
  onReply,
  onDismiss,
  onDelete,
}: WorkflowProps) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restore = () =>
    requestAnimationFrame(() => triggerRef.current?.focus());
  return (
    <>
      {onEdit ? (
        <button
          className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            setEditing((v) => !v);
            setReplying(false);
            setDismissing(false);
            setDeleting(false);
          }}
          type="button"
        >
          Edit
        </button>
      ) : null}
      {onReply ? (
        <button
          className="min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            setReplying((v) => !v);
            setEditing(false);
            setDismissing(false);
            setDeleting(false);
          }}
          type="button"
        >
          Reply
        </button>
      ) : null}
      {onDismiss ? (
        <button
          className="min-h-11 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            setDismissing(true);
            setEditing(false);
            setReplying(false);
            setDeleting(false);
          }}
          type="button"
        >
          Dismiss
        </button>
      ) : null}
      <DeleteWorkflow
        active={deleting}
        item={item}
        onDelete={onDelete}
        onOpen={(event) => {
          triggerRef.current = event.currentTarget;
          setDeleting(true);
          setEditing(false);
          setReplying(false);
          setDismissing(false);
        }}
        onCancel={() => {
          setDeleting(false);
          restore();
        }}
      />
      {editing && onEdit ? (
        <FeedbackEditForm
          item={item}
          onEdit={onEdit}
          onCancel={() => {
            setEditing(false);
            restore();
          }}
        />
      ) : null}
      {replying && onReply ? (
        <FeedbackReplyForm
          item={item}
          onReply={onReply}
          onCancel={() => {
            setReplying(false);
            restore();
          }}
        />
      ) : null}
      {dismissing && onDismiss ? (
        <FeedbackDismissForm
          item={item}
          onDismiss={onDismiss}
          onCancel={() => {
            setDismissing(false);
            restore();
          }}
        />
      ) : null}
    </>
  );
}

function DeleteWorkflow({
  active,
  item,
  onDelete,
  onOpen,
  onCancel,
}: {
  readonly active: boolean;
  readonly item: FeedbackCardItem;
  readonly onDelete?: ((id: string) => Promise<void>) | undefined;
  readonly onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly onCancel: () => void;
}) {
  if (!onDelete) return null;
  return (
    <>
      <button
        className="min-h-11 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
        onClick={onOpen}
        type="button"
      >
        Delete
      </button>
      {active ? (
        <FeedbackDeleteForm
          item={item}
          onDelete={onDelete}
          onCancel={onCancel}
        />
      ) : null}
    </>
  );
}
