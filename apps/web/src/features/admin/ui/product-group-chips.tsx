"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../../lib/trpc-context";

function ProductGroupChipsMessage({
  kind,
  children,
}: {
  readonly kind: "loading" | "error" | "empty";
  readonly children: React.ReactNode;
}) {
  const tone =
    kind === "error"
      ? "text-[var(--color-destructive)]"
      : "text-[var(--color-muted-foreground)]";
  return (
    <span
      className={`text-xs ${kind === "empty" ? "italic " : ""}${tone}`}
      data-testid={`product-group-chips-${kind}`}
    >
      {children}
    </span>
  );
}

// Editing lives in the Groups tab so the GroupProduct edge has one write path;
// this Products-tab surface is intentionally read-only.
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
      <ProductGroupChipsMessage kind="loading">
        Loading groups…
      </ProductGroupChipsMessage>
    );
  }

  if (groupsQuery.isError) {
    return (
      <ProductGroupChipsMessage kind="error">
        Groups unavailable
      </ProductGroupChipsMessage>
    );
  }

  const groups = groupsQuery.data ?? [];
  if (groups.length === 0) {
    return (
      <ProductGroupChipsMessage kind="empty">
        No groups
      </ProductGroupChipsMessage>
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
