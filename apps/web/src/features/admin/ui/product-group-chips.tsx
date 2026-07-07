"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../../lib/trpc-context";

/**
 * Read-only «Groups» chip set for the Products tab.
 * Fetches `admin.listProductGroups({ productId })` and renders one
 * pill per attached ReportingGroup. Editing is intentionally not wired
 * here — chip removal lives in the Groups tab edit dialog (the
 * `GroupProductsEditor` companion component). This keeps the Products
 * tab a read surface for the M:M edge and avoids two competing edit
 * paths for the same edge.
 */
export function ProductGroupChips({
  productId,
}: {
  readonly productId: string;
}) {
  const trpc = useTRPC();
  const groupsQuery = useQuery(
    trpc.admin.listProductGroups.queryOptions({ productId }),
  );

  if (groupsQuery.isLoading) {
    return (
      <span
        className="text-xs text-[var(--color-muted-foreground)]"
        data-testid="product-group-chips-loading"
      >
        Loading groups…
      </span>
    );
  }

  const groups = groupsQuery.data ?? [];
  if (groups.length === 0) {
    return (
      <span
        className="text-xs italic text-[var(--color-muted-foreground)]"
        data-testid="product-group-chips-empty"
      >
        No groups
      </span>
    );
  }

  return (
    <ul
      className="flex flex-wrap gap-1"
      data-testid="product-group-chips"
      aria-label="Groups owning this product"
    >
      {groups.map((group) => (
        <li
          key={group.id}
          className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-0.5 text-xs font-medium text-[var(--color-foreground)]"
        >
          {group.name}
        </li>
      ))}
    </ul>
  );
}
