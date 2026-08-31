"use client";

import type { RecordCommentView } from "@customreport/shared";
import type { ReactNode } from "react";

// Shared read-only comment stack. `renderAction` injects a per-comment control
// (e.g. Delete) without this component owning mutations — lead surface passes nothing.
export function ReviewCommentList({
  comments,
  className,
  renderAction,
}: {
  readonly comments: readonly RecordCommentView[];
  readonly className?: string;
  readonly renderAction?: (comment: RecordCommentView) => ReactNode;
}) {
  if (comments.length === 0) return null;
  return (
    <ul
      className={`flex flex-col gap-1.5 ${className ?? ""}`}
      aria-label="Reviewer comments"
    >
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1.5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 break-words text-[11px] font-semibold text-[var(--color-foreground)] [overflow-wrap:anywhere]">
              {comment.reviewerName ?? "Reviewer"}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-[10px] tabular-nums text-[var(--color-muted-foreground)]">
                {formatCommentDate(comment.createdAt)}
              </span>
              {renderAction?.(comment)}
            </span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px] leading-snug text-[var(--color-foreground)] [overflow-wrap:anywhere]">
            {comment.text}
          </p>
        </li>
      ))}
    </ul>
  );
}

function formatCommentDate(createdAt: Date): string {
  return createdAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
