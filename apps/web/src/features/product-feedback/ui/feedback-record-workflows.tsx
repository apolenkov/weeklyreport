"use client";

import { type MouseEvent, useRef, useState } from "react";

import type { FeedbackCardItem } from "./feedback-record-card";
import {
  FeedbackDeleteForm,
  FeedbackDismissForm,
  FeedbackEditForm,
  FeedbackReplyForm,
} from "./feedback-record-workflow-forms";

type WorkflowKind = "edit" | "reply" | "dismiss" | "delete";

const NEUTRAL_BUTTON =
  "min-h-11 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";
const DANGER_BUTTON =
  "min-h-11 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700";

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
  const [active, setActive] = useState<WorkflowKind | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restore = () =>
    requestAnimationFrame(() => triggerRef.current?.focus());
  const open = (
    kind: WorkflowKind,
    toggle: boolean,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    triggerRef.current = event.currentTarget;
    setActive((current) => (toggle && current === kind ? null : kind));
  };
  const close = () => {
    setActive(null);
    restore();
  };
  return (
    <>
      {onEdit ? (
        <button
          className={NEUTRAL_BUTTON}
          onClick={(event) => open("edit", true, event)}
          type="button"
        >
          Edit
        </button>
      ) : null}
      {onReply ? (
        <button
          className={NEUTRAL_BUTTON}
          onClick={(event) => open("reply", true, event)}
          type="button"
        >
          Reply
        </button>
      ) : null}
      {onDismiss ? (
        <button
          className={DANGER_BUTTON}
          onClick={(event) => open("dismiss", false, event)}
          type="button"
        >
          Dismiss
        </button>
      ) : null}
      <DeleteWorkflow
        active={active === "delete"}
        item={item}
        onDelete={onDelete}
        onOpen={(event) => open("delete", false, event)}
        onCancel={close}
      />
      {active === "edit" && onEdit ? (
        <FeedbackEditForm item={item} onEdit={onEdit} onCancel={close} />
      ) : null}
      {active === "reply" && onReply ? (
        <FeedbackReplyForm item={item} onReply={onReply} onCancel={close} />
      ) : null}
      {active === "dismiss" && onDismiss ? (
        <FeedbackDismissForm
          item={item}
          onDismiss={onDismiss}
          onCancel={close}
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
      <button className={DANGER_BUTTON} onClick={onOpen} type="button">
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
