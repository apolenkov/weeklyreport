import type { AdminActionLogEvent } from "@weeklyreport/shared";

import { formatDateTime } from "../../../shared/lib/format/format-date";

// The guard stays here: `formatDateTime` renders an unparseable value as
// "Invalid Date", while the log table shows a hyphen for a missing timestamp.
export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return formatDateTime(date);
}

const SHORT_ID_TAIL = 8;
const SHORT_ID_MAX = 16;

/** Keeps the distinctive tail of a long id; the full value belongs in a title or copy action. */
export function shortId(value: string): string {
  return value.length <= SHORT_ID_MAX
    ? value
    : `…${value.slice(-SHORT_ID_TAIL)}`;
}

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

// `max` stays a UTF-16 code-unit budget for display width; whole graphemes are
// accumulated until the next one would cross `max - 1`, so an emoji or a
// combining sequence is never halved into a lone surrogate.
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const graphemes = [...graphemeSegmenter.segment(value)];
  const firstOver = graphemes.find(
    ({ segment, index }) => index + segment.length > max - 1,
  );
  return `${value.slice(0, firstOver?.index ?? 0).trimEnd()}…`;
}

function humanizeProcedureSegment(segment: string): string {
  return segment
    .replaceAll(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase())
    .trim()
    .replaceAll(/\bAi\b/g, "AI")
    .replaceAll(/\bId\b/g, "ID");
}

// Friendlier "Namespace · Context: Action" label with every segment retained.
export function humanizeProcedure(procedure: string): string {
  const segments = procedure.split(".");
  if (segments.length < 2 || segments.some((segment) => segment.length === 0)) {
    return procedure;
  }
  const action = segments.at(-1);
  if (action === undefined) return procedure;
  const context = segments.slice(0, -1).map(humanizeProcedureSegment);
  return `${context.join(" · ")}: ${humanizeProcedureSegment(action)}`;
}

const STATUS_LABEL: Readonly<Record<AdminActionLogEvent["status"], string>> = {
  success: "OK",
  fail: "Error",
};

export function statusLabel(value: AdminActionLogEvent["status"]): string {
  return STATUS_LABEL[value];
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const clipboard =
      typeof navigator === "undefined"
        ? undefined
        : (navigator as Navigator & { clipboard?: Clipboard }).clipboard;
    if (clipboard) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallthrough */
  }
  return false;
}
