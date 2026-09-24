"use client";

import type { AdminProductView, AdminUserView } from "../model/admin-types";
import { ActiveProductRow } from "./active-product-row";

interface ProductsTableProps {
  readonly activeProducts: readonly AdminProductView[];
  readonly hasData: boolean;
  readonly archivedProducts: readonly AdminProductView[];
  readonly getUserById: (id: string) => AdminUserView | undefined;
  readonly stageCountByProject: ReadonlyMap<string, number>;
  readonly countsError: boolean;
  readonly leads: readonly AdminUserView[];
  readonly expandedId: string | null;
  readonly onToggleExpand: (id: string) => void;
  readonly onEdit: (product: AdminProductView) => void;
  readonly onArchive: (product: AdminProductView) => void;
  readonly onRestore: (product: AdminProductView) => void;
  readonly isArchiving: boolean;
  readonly isSaving: boolean;
}

export function ProductsTable({
  activeProducts,
  hasData,
  archivedProducts,
  getUserById,
  stageCountByProject,
  countsError,
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
        {countsError && (
          <p className="text-xs text-[var(--color-destructive)]" role="alert">
            Could not load stage assignment counts
          </p>
        )}
        {activeProducts.map((product) => (
          <ActiveProductRow
            key={product.id}
            product={product}
            owner={getUserById(product.leadOwnerId)}
            assignedCount={stageCountByProject.get(product.id) ?? 0}
            countsError={countsError}
            isExpanded={expandedId === product.id}
            leads={leads}
            onToggleExpand={onToggleExpand}
            onEdit={onEdit}
            onArchive={onArchive}
            isArchiving={isArchiving}
          />
        ))}
        {activeProducts.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
            {hasData
              ? "No products match the search."
              : "No active products yet."}
          </div>
        )}
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
  readonly archivedProducts: readonly AdminProductView[];
  readonly onRestore: (product: AdminProductView) => void;
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
            className="btn-press inline-flex min-h-[34px] max-md:min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] bg-[var(--color-card)] px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[var(--color-border-accent-hover)] hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Restore ${product.name}`}
          >
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}
