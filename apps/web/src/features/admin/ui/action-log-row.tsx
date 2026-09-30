"use client";

import type { AdminActionLogEvent } from "@customreport/shared";
import { ChevronDown, Copy } from "lucide-react";
import { Fragment, useId, useState } from "react";

import {
  copyToClipboard,
  formatTimestamp,
  humanizeProcedure,
  statusLabel,
  truncate,
} from "../model/action-log-format";
import { serializeActionLogEvent } from "../model/action-log-model";
import { CorrelationCell } from "./action-log-correlation-cell";

const MAX_USER_ID_LENGTH = 18;
const MAX_TARGET_ID_LENGTH = 26;
const COLUMN_COUNT = 6;

function UserCell({
  row,
  userName,
}: {
  readonly row: AdminActionLogEvent;
  readonly userName?: string | undefined;
}) {
  return (
    <td className="px-4 py-3">
      <div
        className={`break-words text-xs text-[var(--color-foreground)]${userName ? " font-medium" : " font-mono"}`}
        title={row.userId}
      >
        {userName ?? truncate(row.userId, MAX_USER_ID_LENGTH)}
      </div>
      <div className="text-xs text-[var(--color-muted-foreground)]">
        {row.role ?? "-"}
      </div>
    </td>
  );
}

function ProcedureCell({ row }: { readonly row: AdminActionLogEvent }) {
  return (
    <td className="px-4 py-3">
      <div
        className="text-xs font-semibold text-[var(--color-foreground)]"
        title={row.procedure}
      >
        {humanizeProcedure(row.procedure)}
      </div>
      {row.targetId ? (
        <div className="font-mono text-xs text-[var(--color-muted-foreground)]">
          {truncate(row.targetId, MAX_TARGET_ID_LENGTH)}
        </div>
      ) : null}
    </td>
  );
}

function StatusCell({ row }: { readonly row: AdminActionLogEvent }) {
  return (
    <td className="px-4 py-3">
      <span
        className={`inline-flex rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold ${
          row.status === "success"
            ? "bg-[var(--color-success)] text-[var(--color-primary)]"
            : "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)]"
        }`}
      >
        {statusLabel(row.status)}
      </span>
      {row.reason ? (
        <div
          className="mt-1 max-w-[240px] truncate text-xs text-[var(--color-muted-foreground)]"
          title={row.reason}
        >
          {row.reason}
        </div>
      ) : null}
    </td>
  );
}

function DetailField({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-[var(--color-muted-foreground)]">
        {label}
      </dt>
      <dd className="mt-1 break-all font-mono text-xs text-[var(--color-foreground)]">
        {value ?? "-"}
      </dd>
    </div>
  );
}

function ActionLogDetails({ row }: { readonly row: AdminActionLogEvent }) {
  const [copyResult, setCopyResult] = useState<"idle" | "success" | "error">(
    "idle",
  );

  async function copyDetails(): Promise<void> {
    const copied = await copyToClipboard(serializeActionLogEvent(row));
    setCopyResult(copied ? "success" : "error");
  }

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--color-foreground)]">
          Safe event details
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Copy action details"
            onClick={() => void copyDetails()}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] md:min-h-8"
          >
            <Copy aria-hidden="true" className="size-3.5" />
            Copy
          </button>
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="min-w-20 text-xs text-[var(--color-muted-foreground)]"
          >
            {copyResult === "success"
              ? "Copied"
              : copyResult === "error"
                ? "Copy failed"
                : ""}
          </span>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField label="Event ID" value={row.id} />
        <DetailField
          label="Timestamp"
          value={`${formatTimestamp(row.createdAt)} (${row.createdAt})`}
        />
        <DetailField label="User ID" value={row.userId} />
        <DetailField label="Role" value={row.role} />
        <DetailField label="Procedure" value={row.procedure} />
        <DetailField label="Target ID" value={row.targetId} />
        <DetailField label="Status" value={row.status} />
        <DetailField label="Reason" value={row.reason} />
        <DetailField label="IP" value={row.ip} />
        <DetailField label="Correlation ID" value={row.correlationId} />
        <DetailField label="Duration" value={`${String(row.durationMs)} ms`} />
      </dl>
    </div>
  );
}

export function ActionLogRow({
  row,
  userName,
}: {
  readonly row: AdminActionLogEvent;
  readonly userName?: string | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();

  return (
    <Fragment>
      <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
        <td className="hidden whitespace-nowrap px-4 py-3 text-[var(--color-muted-foreground)] sm:table-cell">
          {formatTimestamp(row.createdAt)}
        </td>
        <UserCell row={row} userName={userName} />
        <ProcedureCell row={row} />
        <StatusCell row={row} />
        <td className="hidden px-4 py-3 sm:table-cell">
          <CorrelationCell value={row.correlationId} />
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailId}
            data-reveal-independence="source-bound-row-local"
            aria-label={`${expanded ? "Hide" : "Show"} action details`}
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] md:min-h-8"
          >
            Details
            <ChevronDown
              aria-hidden="true"
              className={`size-3.5 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
          <td colSpan={COLUMN_COUNT} className="px-4 py-3">
            <div
              id={detailId}
              role="region"
              aria-label={`Action details for ${row.id}`}
            >
              <ActionLogDetails row={row} />
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
