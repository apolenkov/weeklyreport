import Link from "next/link";

import { ADMIN_ROUTE } from "../../../shared/ui/navigation/nav-links";

export function ProductFilterBanner({
  filterMatched,
}: {
  readonly filterMatched: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
      <span className="text-sm text-[var(--color-muted-foreground)]">
        {filterMatched
          ? "Showing product from search"
          : "Product from search not found"}
      </span>
      <Link
        href={`${ADMIN_ROUTE}?tab=products`}
        className="text-sm font-semibold text-[var(--color-starbucks-accent)] hover:text-[var(--color-primary)]"
      >
        Reset
      </Link>
    </div>
  );
}
