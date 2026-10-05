"use client";

import type { OwningGroup } from "./use-group-products";

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
      role={kind === "loading" ? "status" : undefined}
      aria-busy={kind === "loading" ? "true" : undefined}
      aria-label={kind === "loading" ? "Loading product groups" : undefined}
    >
      {children}
    </span>
  );
}

// Editing lives in the Groups tab so the GroupProduct edge has one write path;
// this Products-tab surface is intentionally read-only. The table resolves
// ownership for every row in one batched query.
export interface ProductGroupsView {
  readonly group: OwningGroup | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
}

export function ProductGroupChips({
  group,
  isLoading,
  isError,
}: ProductGroupsView) {
  if (isLoading) {
    return (
      <ProductGroupChipsMessage kind="loading">
        Loading groups…
      </ProductGroupChipsMessage>
    );
  }

  if (isError) {
    return (
      <ProductGroupChipsMessage kind="error">
        Groups unavailable
      </ProductGroupChipsMessage>
    );
  }

  if (group === undefined) {
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
      <li className="inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-0.5 text-xs font-medium text-[var(--color-foreground)]">
        {group.name}
      </li>
    </ul>
  );
}
