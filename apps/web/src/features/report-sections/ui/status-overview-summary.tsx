import {
  statusDotClassName,
  statusLabel,
  statusToneClassName,
} from "../../../shared/lib/status/status-presentation";
import type { StatusOverviewUnit } from "../model/status-overview";

function StatusBadge({ unit }: { readonly unit: StatusOverviewUnit }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[11px] font-semibold ${statusToneClassName(unit.status)}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${statusDotClassName(unit.status)}`}
      />
      {statusLabel(unit.status, "screen")}
    </span>
  );
}

export function StatusOverviewUnitSummary({
  unit,
}: {
  readonly unit: StatusOverviewUnit;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-muted-foreground)]">
        {unit.kind === "product" ? "Product" : "Activity"}
        {unit.historical ? " · Historical" : ""}
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-semibold text-[var(--color-foreground)]">
          {unit.name}
        </span>
        <StatusBadge unit={unit} />
        {unit.historical ? (
          <span className="sr-only">Historical reporting unit</span>
        ) : null}
      </div>
      {unit.stages.length > 0 ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {unit.stages.length} owned{" "}
          {unit.stages.length === 1 ? "stage" : "stages"}
        </p>
      ) : null}
      {unit.linkedProducts.length > 0 ? (
        <p className="break-words text-xs text-[var(--color-muted-foreground)]">
          Products: {unit.linkedProducts.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
