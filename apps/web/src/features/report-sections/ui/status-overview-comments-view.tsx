"use client";

import type { CommentsViewProps } from "../model/contextual-entry-contract";

type Composer = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
} & (
  | { readonly state: "idle" | "pending" | "error" }
  | { readonly state: "refresh-failed"; readonly onRefresh: () => void }
  | {
      readonly state: "uncertain";
      readonly onRefresh: () => void;
      /** Present once the Lead checked the discussion after the attempt. */
      readonly onResend?: () => void;
    }
);

interface LiveProps {
  readonly composer?: Composer;
  /** "unavailable": access is lost; "stale": the last read failed. */
  readonly notice?: "unavailable" | "stale";
  readonly onRefresh?: () => void;
}

const LINK_BUTTON_CLASS = "min-h-11 self-start px-2 text-sm underline";

export function StatusOverviewCommentsView({
  id,
  itemLabel,
  comments,
  onClose,
  composer,
  notice,
  onRefresh,
}: CommentsViewProps & LiveProps) {
  return (
    <section
      id={id}
      aria-label={`Comments for ${itemLabel}`}
      className="flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.09em] text-[var(--color-muted-foreground)]">
          Comments
        </span>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-2 text-xs text-[var(--color-foreground)]"
        >
          Close comments
        </button>
      </div>
      {notice === "unavailable" ? (
        <p role="status" className="text-xs">
          This discussion is no longer available.
        </p>
      ) : (
        <Messages comments={comments} />
      )}
      {notice === "stale" && (
        <StaleNotice
          {...(composer && "onRefresh" in composer ? {} : { onRefresh })}
        />
      )}
      {composer && (
        <ReplyComposer id={id} itemLabel={itemLabel} composer={composer} />
      )}
    </section>
  );
}

function Messages({
  comments,
}: {
  readonly comments: CommentsViewProps["comments"];
}) {
  return comments.length === 0 ? (
    <p className="text-xs text-[var(--color-muted-foreground)]">
      No comments yet.
    </p>
  ) : (
    <ul aria-label="Discussion messages" className="flex flex-col gap-1.5">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1.5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
              {comment.reviewerName ?? "Unknown author"}
            </span>
            <time dateTime={comment.createdAt.toISOString()}>
              {comment.createdAt.toLocaleString()}
            </time>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-xs [overflow-wrap:anywhere]">
            {comment.text}
          </p>
        </li>
      ))}
    </ul>
  );
}

function StaleNotice({ onRefresh }: { readonly onRefresh?: () => void }) {
  return (
    <>
      <p role="alert" className="text-xs">
        Could not refresh the discussion. These messages may be out of date.
      </p>
      {onRefresh && (
        <button type="button" className={LINK_BUTTON_CLASS} onClick={onRefresh}>
          Refresh discussion
        </button>
      )}
    </>
  );
}

// An uncertain attempt blocks Send: only the explicit duplicate-risk action
// may dispatch again, and only after the Lead checked the discussion.
function canSend(composer: Composer): boolean {
  return (
    composer.state !== "pending" &&
    composer.state !== "uncertain" &&
    composer.value.trim() !== ""
  );
}

function ReplyComposer({
  id,
  itemLabel,
  composer,
}: {
  readonly id: string;
  readonly itemLabel: string;
  readonly composer: Composer;
}) {
  return (
    <form
      className="flex min-w-0 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend(composer)) composer.onSend();
      }}
    >
      <label className="text-xs font-semibold" htmlFor={`${id}-reply`}>
        Reply to {itemLabel}
      </label>
      <textarea
        id={`${id}-reply`}
        className="min-h-11 w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] p-2 text-sm"
        value={composer.value}
        onChange={(event) => composer.onChange(event.target.value)}
      />
      {composer.state === "error" && (
        <p role="alert">Could not send. Check your reply and try again.</p>
      )}
      {composer.state === "uncertain" && (
        <p role="alert">
          The result is uncertain. Refresh and check the discussion before
          resending; resending may duplicate the message.
        </p>
      )}
      {composer.state === "refresh-failed" && (
        <p role="alert">
          Sent, but refresh failed. Refresh the discussion to see the latest
          messages.
        </p>
      )}
      {"onRefresh" in composer && (
        <button
          type="button"
          className={LINK_BUTTON_CLASS}
          onClick={composer.onRefresh}
        >
          Refresh discussion
        </button>
      )}
      {composer.state === "uncertain" && composer.onResend && (
        <button
          type="button"
          disabled={!composer.value.trim()}
          className={LINK_BUTTON_CLASS}
          onClick={composer.onResend}
        >
          Send again (may duplicate)
        </button>
      )}
      <button
        type="submit"
        disabled={!canSend(composer)}
        className="min-h-11 min-w-11 self-start rounded bg-[var(--color-foreground)] px-4 text-sm text-[var(--color-background)] disabled:opacity-50"
      >
        {composer.state === "pending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
