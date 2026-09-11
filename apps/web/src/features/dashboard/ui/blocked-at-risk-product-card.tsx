import { statusLabel } from "../../../shared/lib/status/status-presentation";
import { Rail } from "../../../shared/ui/report-shell/rail";
import type {
  BlockedAtRiskItem,
  ProductGroup,
} from "../model/dashboard-escalations";

type Severity = BlockedAtRiskItem["severity"];

const CSS_DESTRUCTIVE = "var(--color-destructive)";

// Mirror the ProductAccordion idiom (product-accordion.tsx): blocked is the only
// alarm hue; at-risk is carried by the row's left rail + badge, not a flooded
// fill. Tokens are shared so the dashboard and the report read identically.
const SEVERITY_TONE = {
  blocked: CSS_DESTRUCTIVE,
  "at-risk": "var(--color-status-at-risk-border)",
} as const satisfies Record<Severity, string>;

const AVATAR_CONFIG = {
  blocked: {
    bg: "var(--color-status-blocked-bg)",
    fg: CSS_DESTRUCTIVE,
  },
  "at-risk": { bg: "var(--color-muted)", fg: "var(--color-foreground)" },
} as const satisfies Record<Severity, { bg: string; fg: string }>;

// bg/fg only — the label folds into the canonical status map (statusLabel,
// print variant). The bg/fg pair does not fit the map's single-token tone
// shape, so it stays here, like SEVERITY_TONE and AVATAR_CONFIG.
const SEVERITY_BADGE = {
  blocked: { bg: "var(--color-status-blocked-bg)", fg: CSS_DESTRUCTIVE },
  "at-risk": {
    bg: "var(--color-surface-muted)",
    fg: "var(--color-status-at-risk-fg)",
  },
} as const satisfies Record<Severity, { bg: string; fg: string }>;

// One column grid shared by every issue row so all stage labels share a left
// edge and all descriptions share another, matching the report accordion.
// Columns: status rail | gutter (stage + assignee) | description | badge.
const ROW_GRID =
  "grid grid-cols-[3px_minmax(0,116px)_minmax(0,1fr)_auto] items-start gap-x-3.5";

// A product's worst severity drives its avatar + header dot: blocked if any of
// its issues is blocked, otherwise at-risk.
function groupSeverity(group: ProductGroup): Severity {
  return group.items.some((item) => item.severity === "blocked")
    ? "blocked"
    : "at-risk";
}

// Up to two leading initials from the product name (e.g. "Marketing Portal" →
// "MP"), the same avatar treatment the report cards use for leads.
function productInitials(product: string): string {
  return product
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

// Distinct assignees in first-appearance order for the header sub-line.
function assigneeLine(group: ProductGroup): string {
  return [...new Set(group.items.map((item) => item.assignee))].join(" · ");
}

function IssueRow({ item }: { readonly item: BlockedAtRiskItem }) {
  const badge = SEVERITY_BADGE[item.severity];
  return (
    <div className={ROW_GRID} data-blocked-row={item.severity}>
      <Rail tone={SEVERITY_TONE[item.severity]} />
      <span className="flex min-w-0 flex-col gap-0.5 pt-px">
        <span className="truncate text-[12.5px] font-semibold text-[var(--color-foreground)]">
          {item.stage}
        </span>
        <span className="truncate text-[11px] font-medium text-[var(--color-muted-foreground)]">
          {item.assignee}
        </span>
      </span>
      <span className="pt-px text-[14px] leading-snug text-[var(--color-foreground)]">
        {item.description}
      </span>
      <span className="flex justify-end pt-px">
        <span
          className="whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: badge.bg, color: badge.fg }}
        >
          {statusLabel(item.severity, "print")}
        </span>
      </span>
    </div>
  );
}

export function ProductCard({ group }: { readonly group: ProductGroup }) {
  const severity = groupSeverity(group);
  const tone = SEVERITY_TONE[severity];
  const avatar = AVATAR_CONFIG[severity];
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)]">
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ background: avatar.bg, color: avatar.fg }}
          aria-hidden="true"
        >
          {productInitials(group.product)}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <h3 className="truncate font-[family-name:var(--font-sans)] text-[15px] font-semibold tracking-[-0.015em] text-[var(--color-foreground)]">
              {group.product}
            </h3>
            <span
              className="inline-flex flex-shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em]"
              style={{ color: tone }}
            >
              <span
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: tone }}
                aria-hidden="true"
              />
              {statusLabel(severity, "print")}
            </span>
          </div>
          <span className="truncate text-[12.5px] text-[var(--color-muted-foreground)]">
            {assigneeLine(group)}
          </span>
        </div>
      </div>
      <div className="space-y-1 border-t border-[var(--color-border-subtle)] px-4 py-3">
        {group.items.map((item) => (
          <IssueRow
            key={`${item.productId}|${item.authorId}|${item.stage}|${item.severity}|${item.description}`}
            item={item}
          />
        ))}
      </div>
    </div>
  );
}
