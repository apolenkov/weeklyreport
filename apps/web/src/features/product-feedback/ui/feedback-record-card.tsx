"use client";

import {
  type AgentationContext,
  FEEDBACK_STATUSES,
  type FeedbackCapabilities,
  type FeedbackStatus,
  type FeedbackThreadItem,
  type FeedbackType,
} from "@weeklyreport/shared";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { FeedbackCaptureItem } from "./feedback-capture-evidence";
import { FeedbackRecordDetails } from "./feedback-record-details";
import { FeedbackRecordWorkflows } from "./feedback-record-workflows";

export const STATUS_LABELS: Readonly<Record<FeedbackStatus, string>> = {
  open: "New",
  in_progress: "Acknowledged",
  resolved: "Resolved",
  wont_fix: "Dismissed / won't fix",
};
export const TYPE_LABELS: Readonly<Record<FeedbackType, string>> = {
  question: "Question",
  change: "Change",
  bug: "Bug",
  other: "Other",
};
export interface FeedbackCardItem {
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
  readonly screenshotUrl?: string | null;
  readonly screenshotRegion?: {
    readonly xPct: number;
    readonly yPct: number;
    readonly wPct: number;
    readonly hPct: number;
  } | null;
  readonly diagnostics?: FeedbackCaptureItem["diagnostics"];
  readonly agentationSessionId?: string;
  readonly agentationAnnotationId?: string;
  readonly source: "agentation" | "legacy";
  readonly capabilities: FeedbackCapabilities;
  readonly thread: readonly FeedbackThreadItem[];
  readonly agentationContext: AgentationContext | null;
}
type FeedbackCapability = FeedbackCapabilities;
function formatSubmitted(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
export function FeedbackRecordCard({
  item,
  onChangeStatus,
  onEdit,
  onReply,
  onDismiss,
  onDelete,
}: {
  readonly item: FeedbackCardItem;
  readonly onChangeStatus: (id: string, status: FeedbackStatus) => void;
  readonly onEdit?:
    ((id: string, comment: string) => Promise<void>) | undefined;
  readonly onReply?:
    ((id: string, content: string) => Promise<void>) | undefined;
  readonly onDismiss?:
    ((id: string, reason: string) => Promise<void>) | undefined;
  readonly onDelete?: ((id: string) => Promise<void>) | undefined;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasAnnotation = item.annotations.length > 0;
  const hasCapture = hasAnnotation && Boolean(item.screenshotUrl);
  const sourceLabel =
    item.source === "agentation" ? "Agentation" : "Legacy feedback";
  const capabilities = item.capabilities;
  return (
    <article className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 font-medium">
              {TYPE_LABELS[item.type]}
            </span>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1 font-medium">
              {sourceLabel}
            </span>
            <span className="truncate">{item.url}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-[var(--color-foreground)]">
            {item.message}
          </p>
          <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
            {item.authorName} · Submitted {formatSubmitted(item.createdAt)}
            {item.updatedAt.getTime() === item.createdAt.getTime()
              ? null
              : ` · Updated ${formatSubmitted(item.updatedAt)}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <StatusField item={item} onChangeStatus={onChangeStatus} />
        </div>
      </div>
      <CardActionBar
        item={item}
        hasCapture={hasCapture}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        capabilities={capabilities}
        onEdit={onEdit}
        onReply={onReply}
        onDismiss={onDismiss}
        onDelete={onDelete}
      />
      <div id={`feedback-details-${item.id}`} hidden={!detailsOpen}>
        {detailsOpen ? (
          <FeedbackRecordDetails item={item} hasCapture={hasCapture} />
        ) : null}
      </div>
    </article>
  );
}

function CardActionBar({
  item,
  hasCapture,
  detailsOpen,
  setDetailsOpen,
  capabilities,
  onEdit,
  onReply,
  onDismiss,
  onDelete,
}: {
  readonly item: FeedbackCardItem;
  readonly hasCapture: boolean;
  readonly detailsOpen: boolean;
  readonly setDetailsOpen: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  readonly capabilities: FeedbackCapability;
  readonly onEdit?:
    ((id: string, comment: string) => Promise<void>) | undefined;
  readonly onReply?:
    ((id: string, content: string) => Promise<void>) | undefined;
  readonly onDismiss?:
    ((id: string, reason: string) => Promise<void>) | undefined;
  readonly onDelete?: ((id: string) => Promise<void>) | undefined;
}) {
  const showDismiss = capabilities.dismiss && item.status !== "wont_fix";
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
      <button
        aria-controls={`feedback-details-${item.id}`}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        onClick={() => setDetailsOpen((current) => !current)}
        type="button"
        aria-expanded={detailsOpen}
      >
        {hasCapture ? (
          <ChevronDown
            aria-hidden="true"
            className={`size-4 ${detailsOpen ? "rotate-180" : ""}`}
          />
        ) : null}
        {detailsOpen ? "Hide details" : "Details"}
      </button>
      <FeedbackRecordWorkflows
        item={item}
        onEdit={capabilities.editOriginal ? onEdit : undefined}
        onReply={capabilities.reply ? onReply : undefined}
        onDismiss={showDismiss ? onDismiss : undefined}
        onDelete={capabilities.delete ? onDelete : undefined}
      />
    </div>
  );
}

function StatusField({
  item,
  onChangeStatus,
}: {
  readonly item: FeedbackCardItem;
  readonly onChangeStatus: (id: string, status: FeedbackStatus) => void;
}) {
  const labelFor = (status: FeedbackStatus): string =>
    status === "wont_fix"
      ? item.source === "agentation"
        ? "Dismissed"
        : "Won't fix"
      : STATUS_LABELS[status];
  const statuses = FEEDBACK_STATUSES.filter(
    (status) => !(item.source === "agentation" && status === "wont_fix"),
  );
  if (item.source === "agentation" && item.status === "wont_fix") {
    return (
      <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-xs">
        Dismissed
      </span>
    );
  }
  if (!item.capabilities.triage) {
    return (
      <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-xs">
        {labelFor(item.status)}
      </span>
    );
  }
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
      Status
      <select
        aria-label={`Status for feedback from ${item.authorName}`}
        className="rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        onChange={(event) =>
          onChangeStatus(item.id, event.target.value as FeedbackStatus)
        }
        value={item.status}
      >
        {statuses.map((status) => (
          <option key={status} value={status}>
            {labelFor(status)}
          </option>
        ))}
      </select>
    </label>
  );
}
