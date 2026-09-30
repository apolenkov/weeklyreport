import type { ReactNode } from "react";

const STICKY =
  "sticky left-0 w-36 min-w-36 max-w-36 whitespace-normal break-words bg-[var(--color-background)] shadow-[1px_0_0_var(--color-border)] px-3 py-2 sm:w-auto sm:min-w-0 sm:max-w-none";

export function AnalyticsTable({
  headingId,
  caption,
  children,
  showScrollHint,
}: {
  readonly headingId: string;
  readonly caption: string;
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
        <table className="min-w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
      {showScrollHint ? (
        <p
          id={`${headingId}-scroll-hint`}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground sm:hidden"
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
    <th scope="col" className={`${STICKY} z-20`}>
      {children}
    </th>
  );
}

export function StickyRowHeader({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <th scope="row" className={`${STICKY} z-10 text-left font-medium`}>
      {children}
    </th>
  );
}
