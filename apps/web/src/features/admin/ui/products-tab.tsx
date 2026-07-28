"use client";

import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import { PlusIcon } from "../../../shared/ui/icons";
import { SearchInput } from "../../../shared/ui/search-input";
import { TabHeader, TabSearch } from "../../../shared/ui/tab-header";
import type { AdminProductView, AdminUserView } from "../model/admin-types";
import type { ProductFormData } from "../model/product-form";
import { ProductEditDialog } from "./product-edit-dialog";
import { ProductFilterBanner } from "./product-filter-banner";
import { ProductsTable } from "./products-table";
import { useProductsTabState } from "./use-products-tab-state";

interface ProductsTabProps {
  readonly products: AdminProductView[];
  readonly users: AdminUserView[];
  readonly productFilter?: string | null | undefined;
}

export function ProductsTab({
  products,
  users,
  productFilter,
}: ProductsTabProps) {
  const state = useProductsTabState({ products, users, productFilter });

  return (
    <>
      <div className="space-y-4">
        <ProductsTabHeader
          activeCount={state.activeProducts.length}
          archivedCount={state.archivedProducts.length}
          localSearch={state.localSearch}
          onLocalSearchChange={state.setLocalSearch}
          onAdd={state.openAdd}
        />
        {productFilter && (
          <ProductFilterBanner filterMatched={state.filterMatched} />
        )}

        <ProductsTable
          activeProducts={state.activeProducts}
          archivedProducts={state.archivedProducts}
          getUserById={state.getUserById}
          stageCountByProject={state.stageCountByProject}
          leads={state.leads}
          expandedId={state.expandedId}
          onToggleExpand={state.toggleExpand}
          onEdit={state.openEdit}
          onArchive={state.setPendingArchive}
          onRestore={state.handleRestore}
          isArchiving={state.isArchiving}
          isSaving={state.isSaving}
        />
      </div>

      <ProductsTabDialogs {...state} />
    </>
  );
}

interface ProductsTabDialogsProps {
  readonly showDialog: boolean;
  readonly editingProduct: AdminProductView | null;
  readonly form: ProductFormData;
  readonly setForm: (form: ProductFormData) => void;
  readonly leads: readonly AdminUserView[];
  readonly leadProductCount: number;
  readonly isSaving: boolean;
  readonly handleSave: () => void;
  readonly closeDialog: () => void;
  readonly pendingArchive: AdminProductView | null;
  readonly setPendingArchive: (product: AdminProductView | null) => void;
  readonly confirmArchive: () => void;
}

function ProductsTabDialogs({
  showDialog,
  editingProduct,
  form,
  setForm,
  leads,
  leadProductCount,
  isSaving,
  handleSave,
  closeDialog,
  pendingArchive,
  setPendingArchive,
  confirmArchive,
}: ProductsTabDialogsProps) {
  return (
    <>
      {showDialog && (
        <ProductEditDialog
          editingProduct={editingProduct}
          form={form}
          onFormChange={setForm}
          leads={leads}
          leadProductCount={leadProductCount}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={closeDialog}
        />
      )}

      <ConfirmDeleteDialog
        open={pendingArchive !== null}
        title="Archive product?"
        preview={pendingArchive?.name ?? ""}
        subtitle="Lead assignments and stage data are preserved."
        consequence="The product will disappear from active forms and dashboards until restored."
        confirmLabel="Archive"
        reversible
        onConfirm={confirmArchive}
        onCancel={() => setPendingArchive(null)}
      />
    </>
  );
}

interface ProductsTabHeaderProps {
  readonly activeCount: number;
  readonly archivedCount: number;
  readonly localSearch: string;
  readonly onLocalSearchChange: (next: string) => void;
  readonly onAdd: () => void;
}

function ProductsTabHeader({
  activeCount,
  archivedCount,
  localSearch,
  onLocalSearchChange,
  onAdd,
}: ProductsTabHeaderProps) {
  return (
    <TabHeader
      title="Products"
      description="Active products + archived. Use the global search to deep-link into reports."
      count={`${activeCount} active · ${archivedCount} archived`}
      search={
        <>
          <TabSearch
            value={localSearch}
            onChange={onLocalSearchChange}
            placeholder="Filter products…"
            testId="products-local-search"
            ariaLabel="Filter products by name"
          />
          <div className="w-72">
            <SearchInput
              scope="all"
              placeholder="Search all products and reports…"
            />
          </div>
        </>
      }
      actions={
        <button
          type="button"
          onClick={onAdd}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
          aria-label="Add new product"
        >
          <PlusIcon />
          Add Product
        </button>
      }
    />
  );
}
