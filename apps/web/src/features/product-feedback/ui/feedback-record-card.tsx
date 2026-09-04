"use client";

import {
  FEEDBACK_STATUSES,
  type FeedbackStatus,
  type FeedbackType,
  normalizeFeedbackPath,
} from "@customreport/shared";
import { ChevronDown, ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  FeedbackCaptureEvidence,
  type FeedbackCaptureItem,
} from "./feedback-capture-evidence";

export const STATUS_LABELS: Readonly<Record<FeedbackStatus, string>> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

export const TYPE_LABELS: Readonly<Record<FeedbackType, string>> = {
  question: "Question",
  change: "Change",
  bug: "Bug",
  other: "Other",
};

export interface FeedbackCardItem extends FeedbackCaptureItem {
  readonly id: string;
  readonly type: FeedbackType;
  readonly status: FeedbackStatus;
  readonly url: string;
  readonly message: string;
  readonly authorName: string;
  readonly authorUserId?: string;
  readonly createdAt: Date;
  readonly viewport: string;
  readonly annotations: readonly unknown[];
}

function formatSubmitted(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function feedbackHref(
  item: FeedbackCardItem,
  role: string | undefined,
): string {
  const normalizedUrl = normalizeFeedbackPath(item.url);
  if (item.annotations.length === 0) return normalizedUrl;

  const leadReport = /^\/lead\/report(?:\/([^/]+))?$/.exec(normalizedUrl);
  if (
    leadReport &&
    item.authorUserId &&
    (role === "head" || role === "admin")
  ) {
    const search = new URLSearchParams({
      authorId: item.authorUserId,
      siteping: item.id,
      sitepingUrl: normalizedUrl,
    });
    const reportId = leadReport[1];
    const reportPath = reportId ? `/${encodeURIComponent(reportId)}` : "";
    return `/head/report${reportPath}?${search.toString()}`;
  }
  const search = new URLSearchParams({ siteping: item.id });
  return `${normalizedUrl}?${search.toString()}`;
}

export function FeedbackRecordCard({
  item,
  role,
  canTriage,
  canDelete,
  onChangeStatus,
  onDelete,
}: {
  readonly item: FeedbackCardItem;
  readonly role: string | undefined;
  readonly canTriage: boolean;
  readonly canDelete: boolean;
  readonly onChangeStatus: (id: string, status: FeedbackStatus) => void;
  readonly onDelete: (id: string) => void;
}) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const hasAnnotation = item.annotations.length > 0;
  const hasCapture = hasAnnotation && Boolean(item.screenshotUrl);
  const targetLabel = hasAnnotation ? "Annotation" : "Page feedback";
  const liveHref = feedbackHref(item, role);
  const summary = (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-[var(--color-surface)] px-2 py-1 font-medium">
          {TYPE_LABELS[item.type]}
        </span>
        <span className="rounded-full border border-[var(--color-border)] px-2 py-1 font-medium">
          {targetLabel}
        </span>
        <span>{item.url}</span>
        {hasCapture ? (
          <ChevronDown
            aria-hidden="true"
            className={`size-3.5 opacity-60 transition-transform ${captureOpen ? "rotate-180" : ""}`}
          />
        ) : (
          <ExternalLink aria-hidden="true" className="size-3.5 opacity-60" />
        )}
      </div>
      <p className="whitespace-pre-wrap text-left text-sm text-[var(--color-ink)]">
        {item.message}
      </p>
      <p className="mt-3 text-left text-xs text-[var(--color-ink-muted)]">
        {item.authorName} · {formatSubmitted(item.createdAt)}
      </p>
    </>
  );

  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {hasCapture ? (
          <button
            aria-expanded={captureOpen}
            aria-label={`Review captured annotation on ${item.url}`}
            className="group min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2"
            onClick={() => setCaptureOpen((current) => !current)}
            type="button"
          >
            {summary}
          </button>
        ) : (
          <a
            aria-label={`Open ${targetLabel.toLowerCase()} on ${item.url}`}
            className="group min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2"
            href={liveHref}
          >
            {summary}
          </a>
        )}
        <div className="flex items-center gap-2">
          {canTriage ? (
            <select
              aria-label={`Status for feedback from ${item.authorName}`}
              className="rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
              name={`feedbackStatus-${item.id}`}
              onChange={(event) =>
                onChangeStatus(item.id, event.target.value as FeedbackStatus)
              }
              value={item.status}
            >
              {FEEDBACK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          ) : (
            <span className="rounded-full border border-[var(--color-border)] px-2 py-1 text-xs">
              {STATUS_LABELS[item.status]}
            </span>
          )}
          {canDelete ? (
            <button
              aria-label="Delete feedback"
              className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
              onClick={() => onDelete(item.id)}
              type="button"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      {hasCapture && captureOpen ? (
        <FeedbackCaptureEvidence item={item} liveHref={liveHref} />
      ) : null}
    </article>
  );
}
