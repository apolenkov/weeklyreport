"use client";

import type { AdminProductView } from "../model/admin-types";
import { type OwningGroup, useGroupProducts } from "./use-group-products";

const HINT_CLASS = "block text-xs text-[var(--color-muted-foreground)]";

// Product name plus the reason its checkbox is disabled, if any. The hints
// carry the id the checkbox points at through aria-describedby.
function ProductRowLabel({
  name,
  hintId,
  lockedHint,
  ownershipLoading,
  ownershipError,
}: {
  readonly name: string;
  readonly hintId: string;
  readonly lockedHint: string | undefined;
  readonly ownershipLoading: boolean;
  readonly ownershipError: boolean;
}) {
  return (
    <span className="min-w-0">
      <span>{name}</span>
      {lockedHint && (
        <span id={hintId} className={HINT_CLASS}>
          {lockedHint}
        </span>
      )}
      {ownershipLoading && (
        <span id={hintId} className={HINT_CLASS}>
          Checking group assignment…
        </span>
      )}
      {ownershipError && (
        <span
          id={hintId}
          className="block text-xs text-[var(--color-destructive)]"
        >
          Could not load group assignment
        </span>
      )}
    </span>
  );
}

interface ProductToggleRowProps {
  readonly product: AdminProductView;
  readonly groupId: string;
  readonly checked: boolean;
  readonly owningGroup: OwningGroup | undefined;
  readonly mutating: boolean;
  readonly ownershipLoading: boolean;
  readonly ownershipError: boolean;
  readonly onToggle: (productId: string, nextChecked: boolean) => void;
}

// A product has exactly one owning group — other-group products show locked.
function ProductToggleRow({
  product,
  groupId,
  checked,
  owningGroup,
  mutating,
  ownershipLoading,
  ownershipError,
  onToggle,
}: ProductToggleRowProps) {
  const lockedByOtherGroup = Boolean(
    owningGroup && owningGroup.id !== groupId && !checked,
  );
  const lockedHint =
    lockedByOtherGroup && owningGroup
      ? `Already attached to ${owningGroup.name}`
      : undefined;
  const hintId = `group-product-hint-${product.id}`;
  // A failed ownership read must not present products as free-to-attach.
  const disabled =
    mutating || lockedByOtherGroup || ownershipLoading || ownershipError;

  return (
    <li>
      <label
        className={[
          "flex items-start gap-2 rounded-sm px-1 py-0.5 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        ].join(" ")}
        title={lockedHint}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onToggle(product.id, e.target.checked)}
          aria-label={`Toggle ${product.name}`}
          aria-describedby={
            lockedByOtherGroup || ownershipLoading || ownershipError
              ? hintId
              : undefined
          }
          className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-starbucks-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <ProductRowLabel
          name={product.name}
          hintId={hintId}
          lockedHint={lockedHint}
          ownershipLoading={ownershipLoading}
          ownershipError={ownershipError}
        />
      </label>
    </li>
  );
}

function ProductToggleList({
  groupId,
  products,
  attachedIds,
  owningGroupByProductId,
  mutating,
  ownershipLoading,
  ownershipError,
  onToggle,
}: {
  readonly groupId: string;
  readonly products: readonly AdminProductView[];
  readonly attachedIds: ReadonlySet<string>;
  readonly owningGroupByProductId: ReadonlyMap<string, OwningGroup>;
  readonly mutating: boolean;
  readonly ownershipLoading: boolean;
  readonly ownershipError: boolean;
  readonly onToggle: (productId: string, nextChecked: boolean) => void;
}) {
  return (
    <ul
      className="max-h-40 space-y-1 overflow-y-auto pr-1"
      data-testid="group-products-list"
    >
      {products.map((product) => (
        <ProductToggleRow
          key={product.id}
          product={product}
          groupId={groupId}
          checked={attachedIds.has(product.id)}
          owningGroup={owningGroupByProductId.get(product.id)}
          mutating={mutating}
          ownershipLoading={ownershipLoading}
          ownershipError={ownershipError}
          onToggle={onToggle}
        />
      ))}
    </ul>
  );
}

export function GroupProductsEditor({
  groupId,
  products,
}: {
  readonly groupId: string;
  readonly products: readonly AdminProductView[];
}) {
  const state = useGroupProducts({ groupId, products });

  return (
    <fieldset
      className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3"
      data-testid="group-products-editor"
    >
      <legend className="px-1 text-sm font-medium text-[var(--color-foreground)]">
        Products attached
      </legend>
      <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">
        Explicit Group ↔ Product mapping. Toggle to attach or detach free
        products. Products already attached to another group are locked here.
      </p>
      {state.attachedLoading ? (
        <div
          className="py-1 text-xs text-[var(--color-muted-foreground)]"
          data-testid="group-products-loading"
          role="status"
          aria-busy="true"
          aria-label="Loading attached products"
        >
          Loading…
        </div>
      ) : state.activeProducts.length === 0 ? (
        <div className="py-1 text-xs text-[var(--color-muted-foreground)]">
          No active products yet. Create one in the Products tab first.
        </div>
      ) : (
        <ProductToggleList
          groupId={groupId}
          products={state.activeProducts}
          attachedIds={state.attachedIds}
          owningGroupByProductId={state.owningGroupByProductId}
          mutating={state.mutating}
          ownershipLoading={state.ownershipLoading}
          ownershipError={state.ownershipError}
          onToggle={state.toggle}
        />
      )}
    </fieldset>
  );
}
