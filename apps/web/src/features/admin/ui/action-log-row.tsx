import {
  formatTimestamp,
  humanizeProcedure,
  statusLabel,
  truncate,
} from "../model/action-log-format";
import { CorrelationCell } from "./action-log-correlation-cell";

const MAX_USER_ID_LENGTH = 18;
const MAX_TARGET_ID_LENGTH = 26;

export interface ActionLogRowData {
  id: string;
  createdAt: string;
  userId: string;
  role: string | null;
  procedure: string;
  targetId: string | null;
  status: string;
  reason: string | null;
  correlationId: string;
}

export function ActionLogRow({ row }: { readonly row: ActionLogRowData }) {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]">
      <td className="whitespace-nowrap px-4 py-3 text-[var(--color-muted-foreground)]">
        {formatTimestamp(row.createdAt)}
      </td>
      <td className="px-4 py-3">
        <div className="font-mono text-xs text-[var(--color-foreground)]">
          {truncate(row.userId, MAX_USER_ID_LENGTH)}
        </div>
        <div className="text-xs text-[var(--color-muted-foreground)]">
          {row.role ?? "-"}
        </div>
      </td>
      <td className="px-4 py-3">
        <div
          className="text-xs font-semibold text-[var(--color-foreground)]"
          title={row.procedure}
        >
          {humanizeProcedure(row.procedure)}
        </div>
        {row.targetId ? (
          <div className="font-mono text-[11px] text-[var(--color-muted-foreground)]">
            {truncate(row.targetId, MAX_TARGET_ID_LENGTH)}
          </div>
        ) : null}
      </td>
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
      <td className="px-4 py-3">
        <CorrelationCell value={row.correlationId} />
      </td>
    </tr>
  );
}
