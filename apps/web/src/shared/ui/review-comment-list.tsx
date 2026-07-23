"use client";

import type { RecordCommentView } from "@customreport/shared";
import type { ReactNode } from "react";

/**
 * Display-only inline render of a record's reviewer comments (reviewer name +
 * text + short date). It NEVER re-renders the anchor record's own text. Shared
 * by the head/viewer accordion rows and the lead form cards. Comments stack
 * under the anchor (no side rail) so the layout stays usable on narrow viewports.
 *
 * `renderAction` lets a reviewer-facing wrapper inject a per-comment control
 * (e.g. Delete) without this component owning any mutation — the lead surface
 * passes nothing and stays strictly read-only.
 */
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
            <span className="text-[11px] font-semibold text-[var(--color-foreground)]">
              {comment.reviewerName ?? "Reviewer"}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[10px] tabular-nums text-[var(--color-muted-foreground)]">
                {formatCommentDate(comment.createdAt)}
              </span>
              {renderAction?.(comment)}
            </span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-snug text-[var(--color-foreground)]">
            {comment.text}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Short, locale-stable comment timestamp ("Jul 1"). */
function formatCommentDate(createdAt: Date): string {
  return createdAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
