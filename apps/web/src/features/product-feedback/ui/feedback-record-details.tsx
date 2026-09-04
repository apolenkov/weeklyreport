"use client";

import { FeedbackCaptureEvidence } from "./feedback-capture-evidence";
import type { FeedbackCardItem } from "./feedback-record-card";

const CONTEXT_FIELDS = [
  ["element", "Element"],
  ["elementPath", "Element path"],
  ["selectedText", "Selected text"],
  ["nearbyText", "Nearby text"],
  ["sourceFile", "Source file"],
  ["reactComponents", "React components"],
  ["accessibility", "Accessibility"],
] as const;

export function FeedbackRecordDetails({
  item,
  hasCapture,
}: {
  readonly item: FeedbackCardItem;
  readonly hasCapture: boolean;
}) {
  const renderedContext =
    item.agentationContext !== null &&
    Object.values(item.agentationContext).some(Boolean)
      ? item.agentationContext
      : null;
  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
      <FeedbackRecordIdentity item={item} />
      {hasCapture ? <FeedbackCaptureEvidence item={item} /> : null}
      {renderedContext ? <ContextBlock context={renderedContext} /> : null}
      <section aria-label="Feedback thread" className="mt-4 space-y-3">
        <h2 className="text-sm font-semibold">Conversation</h2>
        <div className="rounded-lg bg-[var(--color-surface)] p-3 text-sm">
          <p className="font-medium">Original · {item.authorName}</p>
          <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
        </div>
        {item.thread.map((message) => (
          <p
            className="rounded-lg border border-[var(--color-border)] p-3 text-sm"
            key={message.id}
          >
            <span className="font-medium">{threadActor(item, message)}</span>
            <span className="ml-2 text-xs text-[var(--color-ink-muted)]">
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(message.timestamp))}
            </span>
            <br />
            {message.content}
          </p>
        ))}
        {item.thread.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            No replies yet.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function FeedbackRecordIdentity({ item }: { readonly item: FeedbackCardItem }) {
  const fields = [
    ["Page", item.url],
    ...(item.source === "agentation"
      ? ([
          ["Session", item.agentationSessionId ?? "Not recorded"],
          ["Annotation", item.agentationAnnotationId ?? "Not recorded"],
        ] as const)
      : []),
  ] as const;
  const agentation = item.source === "agentation";
  return (
    <section
      aria-label={agentation ? "Agentation record" : "Feedback record"}
      className="grid gap-2 rounded-lg border border-[var(--color-border)] p-3 text-sm sm:grid-cols-3"
    >
      <h2 className="font-semibold sm:col-span-3">
        {agentation ? "Agentation record" : "Recorded page"}
      </h2>
      {fields.map(([label, value]) => (
        <p className="min-w-0" key={label}>
          <span className="font-medium">{label}</span>
          <br />
          <code className="break-all text-xs text-[var(--color-ink-muted)]">
            {value}
          </code>
        </p>
      ))}
    </section>
  );
}

function threadActor(
  item: FeedbackCardItem,
  message: FeedbackCardItem["thread"][number],
): string {
  if (message.role === "agent") return "Agent";
  if (message.authorUserId === item.authorUserId) return item.authorName;
  return message.authorUserId ? `User · ${message.authorUserId}` : "User";
}
function ContextBlock({
  context,
}: {
  readonly context: NonNullable<FeedbackCardItem["agentationContext"]>;
}) {
  return (
    <section
      aria-label="Agentation target"
      className="mt-4 grid gap-2 rounded-lg border border-[var(--color-border)] p-3 text-sm sm:grid-cols-2"
    >
      <h2 className="sm:col-span-2 font-semibold">Captured target context</h2>
      {CONTEXT_FIELDS.map(([field, label]) =>
        context[field] ? (
          <p className="min-w-0" key={field}>
            <span className="font-medium">{label}</span>
            <br />
            <span className="break-words text-[var(--color-ink-muted)]">
              {context[field]}
            </span>
          </p>
        ) : null,
      )}
    </section>
  );
}
