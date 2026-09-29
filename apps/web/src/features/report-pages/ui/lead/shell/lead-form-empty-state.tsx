import Link from "next/link";
import type { ReactNode } from "react";

export function LeadFormEmptyState({
  titleId,
  title,
  children,
}: {
  readonly titleId: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={titleId} className="card-surface space-y-3 p-6">
      <h1
        id={titleId}
        className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]"
      >
        {title}
      </h1>
      {children}
      <Link
        href="/reports"
        className="inline-flex min-h-[var(--touch-target-min)] items-center text-sm font-medium text-[var(--color-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        View report history &rarr;
      </Link>
    </section>
  );
}
