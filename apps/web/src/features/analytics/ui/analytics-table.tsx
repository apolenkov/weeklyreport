import type { ReactNode } from "react";

// Every Trends table shares one fixed grid: a sticky name column and equal
// data columns. Below `sm` the table keeps its minimum width and scrolls.
const TABLE_CLASS = [
  "w-full table-fixed border-collapse text-sm tabular-nums",
  "[--analytics-first-col:11rem] sm:[--analytics-first-col:16rem]",
  "[--analytics-data-col:7.5rem] lg:[--analytics-data-col:9.5rem]",
  "[&_tr]:border-b [&_tr]:border-[var(--color-border)]",
  "[&_tbody_tr:last-child]:border-b-0",
].join(" ");
const STICKY =
  "sticky left-0 whitespace-normal break-words bg-[var(--color-background)] px-2 py-2 text-left sm:px-3 shadow-[1px_0_0_var(--color-border)]";

// The trends window spans a year, so the table can outgrow the card at any
// width: hide the hint only where this many columns still fit.
const MAX_COLUMNS_FITTING_AT_MD = 3;
const MAX_COLUMNS_FITTING_AT_XL = 6;

function scrollHintVisibility(dataColumns: number): string {
  if (dataColumns <= MAX_COLUMNS_FITTING_AT_MD) return "md:hidden";
  return dataColumns <= MAX_COLUMNS_FITTING_AT_XL ? "xl:hidden" : "";
}

export function AnalyticsTable({
  headingId,
  caption,
  dataColumns,
  children,
  showScrollHint,
}: {
  readonly headingId: string;
  readonly caption: string;
  readonly dataColumns: number;
  readonly children: ReactNode;
  readonly showScrollHint: boolean;
}) {
  return (
    <>
      <div
        className="max-w-full overflow-x-auto rounded-md bg-[var(--color-background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
        tabIndex={0}
        role="region"
        aria-labelledby={headingId}
        aria-describedby={
          showScrollHint ? `${headingId}-scroll-hint` : undefined
        }
      >
        <table
          className={TABLE_CLASS}
          style={{
            minWidth: `calc(var(--analytics-first-col) + ${String(dataColumns)} * var(--analytics-data-col))`,
          }}
        >
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            <col className="w-[var(--analytics-first-col)]" />
            {Array.from({ length: dataColumns }, (_, index) => (
              <col key={index} />
            ))}
          </colgroup>
          {children}
        </table>
      </div>
      {showScrollHint ? (
        <p
          id={`${headingId}-scroll-hint`}
          className={`mt-2 flex items-center gap-1 text-xs text-muted-foreground ${scrollHintVisibility(dataColumns)}`}
        >
          <span aria-hidden="true">↔</span> Scroll horizontally to see all
          columns.
        </p>
      ) : null}
    </>
  );
}

export function StickyColumnHeader({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <th scope="col" className={`${STICKY} z-20 font-semibold`}>
      {children}
    </th>
  );
}

// A hyphenated word stays on one line while it fits; the inline-block only
// wraps inside itself when the cell is narrower than the whole word.
function keepHyphenatedWordsTogether(name: string): ReactNode[] {
  return [...name.matchAll(/\S+|\s+/g)].map(({ 0: token, index }) =>
    token.includes("-") ? (
      <span key={index} className="inline-block max-w-full break-words">
        {token}
      </span>
    ) : (
      token
    ),
  );
}

export function StickyRowHeader({ children }: { readonly children: string }) {
  return (
    <th scope="row" className={`${STICKY} z-10 font-medium`}>
      {keepHyphenatedWordsTogether(children)}
    </th>
  );
}

export function ColumnHeader({
  children,
  className = "",
  numeric = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-semibold lg:whitespace-nowrap ${numeric ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </th>
  );
}

export function DataCell({
  children,
  className = "",
  numeric = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly numeric?: boolean;
}) {
  return (
    <td className={`px-3 py-2 ${numeric ? "text-right" : ""} ${className}`}>
      {children}
    </td>
  );
}
