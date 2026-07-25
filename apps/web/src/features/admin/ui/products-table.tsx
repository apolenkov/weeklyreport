"use client";

import { STAGE_NAMES } from "@customreport/shared";

import type { MockProduct, MockUser } from "../model/admin-types";
import { ProductGroupChips } from "./product-group-chips";
import { StageAssignmentEditor } from "./stage-assignment-editor";

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

/**
 * Products Table.
 * @param props - The props argument.
 */
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

interface ActiveProductRowProps {
  readonly product: MockProduct;
  readonly owner: MockUser | undefined;
  readonly assignedCount: number;
  readonly isExpanded: boolean;
  readonly leads: readonly MockUser[];
  readonly onToggleExpand: (id: string) => void;
  readonly onEdit: (product: MockProduct) => void;
  readonly onArchive: (product: MockProduct) => void;
  readonly isArchiving: boolean;
}

function ActiveProductRow({
  product,
  owner,
  assignedCount,
  isExpanded,
  leads,
  onToggleExpand,
  onEdit,
  onArchive,
  isArchiving,
}: ActiveProductRowProps) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white transition-shadow hover:shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleExpand(product.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} stage assignments for ${product.name}`}
            aria-expanded={isExpanded}
          >
            <ChevronIcon expanded={isExpanded} />
          </button>
          <div className="flex flex-col gap-1">
            <div>
              <span className="text-sm font-semibold text-[var(--color-foreground)]">
                {product.name}
              </span>
              <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                Owner: {owner?.name ?? "Unknown"}
              </span>
            </div>
            {/* read-only Groups chips showing which
                ReportingGroups own this product via the explicit
                GroupProduct edge. Editing lives in the Groups tab. */}
            <ProductGroupChips productId={product.id} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {assignedCount}/{STAGE_NAMES.length} stages
          </span>
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] bg-white px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[var(--color-border-accent-hover)] hover:bg-[var(--color-success)]"
            aria-label={`Edit ${product.name}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onArchive(product)}
            disabled={isArchiving}
            className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] bg-white px-3 text-xs font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Archive ${product.name}`}
          >
            Archive
          </button>
        </div>
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300"
        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-[var(--color-border)] px-4 pb-4">
            {isExpanded && (
              <StageAssignmentEditor
                projectId={product.id}
                projectName={product.name}
                leads={leads}
              />
            )}
          </div>
        </div>
      </div>
    </div>
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

function ChevronIcon({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 transition-transform duration-200"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
