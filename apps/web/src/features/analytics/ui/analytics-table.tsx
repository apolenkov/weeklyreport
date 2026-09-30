import type { ReactNode } from "react";

const STICKY =
  "sticky left-0 bg-[var(--color-background)] shadow-[1px_0_0_var(--color-border)] px-3 py-2";

export function AnalyticsTable({
  headingId,
  caption,
  children,
}: {
  readonly headingId: string;
  readonly caption: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      className="max-w-full overflow-x-auto rounded-md bg-[var(--color-background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
      tabIndex={0}
      role="region"
      aria-labelledby={headingId}
    >
      <table className="min-w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
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
