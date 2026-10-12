"use client";

import { type MouseEvent, type ReactNode, useRef, useState } from "react";

import type { FeedbackCardItem } from "./feedback-record-card";
import {
  FeedbackDeleteForm,
  FeedbackDismissForm,
  FeedbackEditForm,
  FeedbackReplyForm,
} from "./feedback-record-workflow-forms";

type WorkflowKind = "edit" | "reply" | "dismiss" | "delete";

const TRIGGER_BUTTON_BASE =
  "min-h-11 rounded-lg border px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2";
const NEUTRAL_BUTTON = `${TRIGGER_BUTTON_BASE} border-[var(--color-border)] focus-visible:ring-[var(--color-ring)]`;
const DANGER_BUTTON = `${TRIGGER_BUTTON_BASE} border-red-200 text-red-700 focus-visible:ring-red-700`;

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
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  return (
    <>
      {onEdit ? (
        <WorkflowToggleButton
          active={active === "edit"}
          controlsId={`feedback-edit-${item.id}`}
          onOpen={(event) => open("edit", true, event)}
        >
          Edit
        </WorkflowToggleButton>
      ) : null}
      {onReply ? (
        <WorkflowToggleButton
          active={active === "reply"}
          controlsId={`feedback-reply-${item.id}`}
          onOpen={(event) => open("reply", true, event)}
        >
          Reply
        </WorkflowToggleButton>
      ) : null}
      {onDismiss ? (
        <WorkflowToggleButton
          active={active === "dismiss"}
          controlsId={`feedback-dismiss-${item.id}`}
          danger
          onOpen={(event) => open("dismiss", false, event)}
        >
          Dismiss
        </WorkflowToggleButton>
      ) : null}
      <DeleteWorkflow
        active={active === "delete"}
        item={item}
        onDelete={onDelete}
        onOpen={(event) => open("delete", false, event)}
        onCancel={close}
      />
      {active === "edit" && onEdit ? (
        <FeedbackEditForm
          key={item.id}
          item={item}
          onEdit={onEdit}
          onCancel={close}
        />
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

function WorkflowToggleButton({
  active,
  controlsId,
  danger = false,
  onOpen,
  children,
}: {
  readonly active: boolean;
  readonly controlsId: string;
  readonly danger?: boolean | undefined;
  readonly onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      className={danger ? DANGER_BUTTON : NEUTRAL_BUTTON}
      onClick={onOpen}
      type="button"
      aria-expanded={active}
      aria-controls={controlsId}
    >
      {children}
    </button>
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
        className={DANGER_BUTTON}
        onClick={onOpen}
        type="button"
        aria-expanded={active}
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
