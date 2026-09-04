import {
  statusDotClassName,
  statusLabel,
  statusToneClassName,
} from "../../../shared/lib/status/status-presentation";
import type { StatusOverviewUnit } from "../model/status-overview";

function StatusBadge({ unit }: { readonly unit: StatusOverviewUnit }) {
  if (unit.status !== "blocked" && unit.status !== "at-risk") return null;
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
    <div className="min-w-0 space-y-2">
      <p className="break-words font-semibold leading-5 text-[var(--color-foreground)]">
        {unit.name}
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        <StatusBadge unit={unit} />
        {unit.historical ? (
          <span className="text-[11px] font-semibold text-[var(--color-muted-foreground)]">
            Historical
          </span>
        ) : null}
        {unit.stages.length > 0 ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {unit.stages.length} owned{" "}
            {unit.stages.length === 1 ? "stage" : "stages"}
          </span>
        ) : null}
      </div>
      {unit.linkedProducts.length > 0 ? (
        <p className="break-words text-xs text-[var(--color-muted-foreground)]">
          Products: {unit.linkedProducts.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
