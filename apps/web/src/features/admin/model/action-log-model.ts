import type { AdminActionLogEvent } from "@weeklyreport/shared";

import {
  formatTimestamp,
  humanizeProcedure,
  statusLabel,
} from "./action-log-format";

/** Matches one already-loaded event across raw and displayed table values. */
export function matchesActionLogSearch(
  event: AdminActionLogEvent,
  search: string,
): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;

  return (
    [
      event.userId,
      event.role ?? "",
      event.procedure,
      humanizeProcedure(event.procedure),
      event.targetId ?? "",
      event.status,
      statusLabel(event.status),
      event.reason ?? "",
      event.correlationId,
      event.createdAt,
      formatTimestamp(event.createdAt),
    ]
      .join(" ")
      // ICU puts a narrow no-break space before AM/PM; a typed needle has a plain one.
      .replaceAll(/\s/g, " ")
      .toLowerCase()
      .includes(needle)
  );
}

/** Serializes only the public allowlist in a stable, reviewable key order. */
export function serializeActionLogEvent(event: AdminActionLogEvent): string {
  return JSON.stringify(
    {
      id: event.id,
      createdAt: event.createdAt,
      userId: event.userId,
      role: event.role,
      procedure: event.procedure,
      targetId: event.targetId,
      status: event.status,
      reason: event.reason,
      ip: event.ip,
      correlationId: event.correlationId,
      durationMs: event.durationMs,
    },
    null,
    2,
  );
}
