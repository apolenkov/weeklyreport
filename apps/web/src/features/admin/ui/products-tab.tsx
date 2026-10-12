"use client";

import { Search } from "lucide-react";

import { ConfirmDeleteDialog } from "../../../shared/ui/dialogs/confirm-delete-dialog";
import { PlusIcon } from "../../../shared/ui/icons/action-icons";
import { SearchInput } from "../../../shared/ui/search/search-input";
import {
  FieldCaption,
  TabHeader,
  TabSearch,
} from "../../../shared/ui/tabs/tab-header";
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
          isFiltering={state.isFiltering}
          archivedProducts={state.archivedProducts}
          getUserById={state.getUserById}
          stageCountByProject={state.stageCountByProject}
          countsError={state.countsError}
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
  readonly retainedOwner: AdminUserView | undefined;
  readonly leadProductCount: number;
  readonly canSave: boolean;
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
  retainedOwner,
  leadProductCount,
  canSave,
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
          retainedOwner={retainedOwner}
          leadProductCount={leadProductCount}
          canSave={canSave}
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
      description="Active and archived products. Filter narrows this list; Search reports opens any product or report."
      count={`${activeCount} active · ${archivedCount} archived`}
      search={
        <>
          <TabSearch
            value={localSearch}
            onChange={onLocalSearchChange}
            label="Filter this list"
            placeholder="Product name…"
            testId="products-local-search"
          />
          <div className="flex flex-col gap-1 sm:w-72">
            <FieldCaption>Search reports</FieldCaption>
            <div className="relative">
              <SearchInput
                scope="all"
                placeholder="Any product or report…"
                className="[&_input]:pl-9"
              />
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute z-10 left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
              />
            </div>
          </div>
        </>
      }
      actions={
        <button
          type="button"
          onClick={onAdd}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)]"
          aria-label="Add new product"
        >
          <PlusIcon />
          Add product
        </button>
      }
    />
  );
}
