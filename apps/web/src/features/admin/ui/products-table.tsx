"use client";

import type { MockProduct, MockUser } from "../model/admin-types";
import { ActiveProductRow } from "./active-product-row";

interface ProductsTableProps {
  readonly activeProducts: readonly MockProduct[];
  readonly archivedProducts: readonly MockProduct[];
  readonly getUserById: (id: string) => MockUser | undefined;
  readonly stageCountByProject: ReadonlyMap<string, number>;
  readonly leads: readonly MockUser[];
  readonly expandedId: string | null;
  readonly onToggleExpand: (id: string) => void;
  readonly onEdit: (product: MockProduct) => void;
  readonly onArchive: (product: MockProduct) => void;
  readonly onRestore: (product: MockProduct) => void;
  readonly isArchiving: boolean;
  readonly isSaving: boolean;
}

export function ProductsTable({
  activeProducts,
  archivedProducts,
  getUserById,
  stageCountByProject,
  leads,
  expandedId,
  onToggleExpand,
  onEdit,
  onArchive,
  onRestore,
  isArchiving,
  isSaving,
}: ProductsTableProps) {
  return (
    <>
      <div className="space-y-3" data-testid="products-table">
        {activeProducts.map((product) => (
          <ActiveProductRow
            key={product.id}
            product={product}
            owner={getUserById(product.leadOwnerId)}
            assignedCount={stageCountByProject.get(product.id) ?? 0}
            isExpanded={expandedId === product.id}
            leads={leads}
            onToggleExpand={onToggleExpand}
            onEdit={onEdit}
            onArchive={onArchive}
            isArchiving={isArchiving}
          />
        ))}
      </div>

      <ArchivedProductList
        archivedProducts={archivedProducts}
        onRestore={onRestore}
        isSaving={isSaving}
      />
    </>
  );
}

function ArchivedProductList({
  archivedProducts,
  onRestore,
  isSaving,
}: {
  readonly archivedProducts: readonly MockProduct[];
  readonly onRestore: (product: MockProduct) => void;
  readonly isSaving: boolean;
}) {
  if (archivedProducts.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
        Archived ({archivedProducts.length})
      </h3>
      {archivedProducts.map((product) => (
        <div
          key={product.id}
          className="flex items-center justify-between rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3"
        >
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {product.name}
          </span>
          <button
            type="button"
            onClick={() => onRestore(product)}
            disabled={isSaving}
            className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] bg-white px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[var(--color-border-accent-hover)] hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Restore ${product.name}`}
          >
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}
