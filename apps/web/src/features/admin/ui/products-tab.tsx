"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";
import { ConfirmDeleteDialog } from "../../../shared/ui/confirm-delete-dialog";
import { PlusIcon } from "../../../shared/ui/icons";
import { SearchInput } from "../../../shared/ui/search-input";
import { TabHeader, TabSearch } from "../../../shared/ui/tab-header";
import { toAdminProjectInput } from "../model/admin";
import type { MockProduct, MockUser } from "../model/admin-types";
import {
  EMPTY_PRODUCT_FORM,
  formFromProduct,
  type ProductFormData,
} from "../model/product-form";
import { ProductEditDialog } from "./product-edit-dialog";
import { ProductFilterBanner } from "./product-filter-banner";
import { ProductsTable } from "./products-table";
import { useProductDeepLinkExpand } from "./use-product-deep-link-expand";

interface ProductsTabProps {
  readonly products: MockProduct[];
  readonly users: MockUser[];
  readonly productFilter?: string | null;
}

export function ProductsTab({
  products,
  users,
  productFilter,
}: ProductsTabProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { markUserToggle } = useProductDeepLinkExpand({
    productFilter,
    products,
    setExpandedId,
  });
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MockProduct | null>(
    null,
  );
  const [form, setForm] = useState<ProductFormData>(EMPTY_PRODUCT_FORM);
  const [pendingArchive, setPendingArchive] = useState<MockProduct | null>(
    null,
  );
  // local name filter (distinct from the global SearchInput deep-link)
  const [localSearch, setLocalSearch] = useState("");

  // exclude deactivated users from picker; existing assignments to
  // deactivated leads remain visible via getUserById (full users list).
  const leads = useMemo(
    () => users.filter((u) => u.role === "lead" && u.isActive),
    [users],
  );
  const getUserById = (id: string): MockUser | undefined =>
    users.find((u) => u.id === id);

  // product.stages is always 7 nulls — assignment data ships via
  // listStageAssignments; count with a light groupBy instead.
  const stageCountsQuery = useQuery(
    trpc.admin.listStageAssignmentCounts.queryOptions(),
  );
  const stageCountByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of stageCountsQuery.data ?? []) m.set(r.projectId, r.count);
    return m;
  }, [stageCountsQuery.data]);

  const saveProjectMut = useMutation(
    trpc.admin.saveProject.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Product saved");
        setShowDialog(false);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  const deleteProjectMut = useMutation(
    trpc.admin.deleteProject.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Product archived");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    }),
  );

  function openAdd() {
    setEditingProduct(null);
    setForm({ ...EMPTY_PRODUCT_FORM, leadId: leads[0]?.id ?? "" });
    setShowDialog(true);
  }

  function openEdit(product: MockProduct) {
    setEditingProduct(product);
    setForm(formFromProduct(product));
    setShowDialog(true);
  }

  function handleSave() {
    const lead = getUserById(form.leadId);
    saveProjectMut.mutate(
      toAdminProjectInput(
        {
          name: form.name,
          leadOwnerId: form.leadId,
          leadName: lead?.name,
          archived: editingProduct?.status === "archived",
        },
        editingProduct?.id,
      ),
    );
  }

  function handleRestore(product: MockProduct) {
    const lead = getUserById(product.leadOwnerId);
    saveProjectMut.mutate(
      toAdminProjectInput(
        {
          name: product.name,
          leadOwnerId: product.leadOwnerId,
          leadName: lead?.name,
          archived: false,
        },
        product.id,
      ),
    );
  }

  function confirmArchive() {
    if (!pendingArchive) return;
    deleteProjectMut.mutate({ projectId: pendingArchive.id });
    setPendingArchive(null);
  }

  const filteredProducts = useMemo(() => {
    const productFiltered = productFilter
      ? products.filter((p) => p.id === productFilter)
      : products;
    const needle = localSearch.trim().toLowerCase();
    return needle
      ? productFiltered.filter((p) => p.name.toLowerCase().includes(needle))
      : productFiltered;
  }, [products, productFilter, localSearch]);
  const filterMatched = !!productFilter && filteredProducts.length > 0;
  const activeProducts = filteredProducts.filter((p) => p.status === "active");
  const archivedProducts = filteredProducts.filter(
    (p) => p.status === "archived",
  );

  // Advisory count of active products owned by the lead picked in the dialog.
  // Computed from the FULL `products` prop (active only) — NOT filteredProducts
  // — so a name filter / search never undercounts.
  const leadProductCount = useMemo(
    () =>
      products.filter(
        (p) => p.leadOwnerId === form.leadId && p.status === "active",
      ).length,
    [products, form.leadId],
  );

  const isSaving = saveProjectMut.isPending;
  const isArchiving = deleteProjectMut.isPending;

  return (
    <>
      <div className="space-y-4">
        <TabHeader
          title="Products"
          description="Active products + archived. Use the global search to deep-link into reports."
          count={`${activeProducts.length} active · ${archivedProducts.length} archived`}
          search={
            <>
              <TabSearch
                value={localSearch}
                onChange={setLocalSearch}
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
              onClick={openAdd}
              className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
              aria-label="Add new product"
            >
              <PlusIcon />
              Add Product
            </button>
          }
        />
        {productFilter && <ProductFilterBanner filterMatched={filterMatched} />}

        <ProductsTable
          activeProducts={activeProducts}
          archivedProducts={archivedProducts}
          getUserById={getUserById}
          stageCountByProject={stageCountByProject}
          leads={leads}
          expandedId={expandedId}
          onToggleExpand={(id) => {
            markUserToggle(id);
            setExpandedId((current) => (current === id ? null : id));
          }}
          onEdit={openEdit}
          onArchive={setPendingArchive}
          onRestore={handleRestore}
          isArchiving={isArchiving}
          isSaving={isSaving}
        />
      </div>

      {showDialog && (
        <ProductEditDialog
          editingProduct={editingProduct}
          form={form}
          onFormChange={setForm}
          leads={leads}
          leadProductCount={leadProductCount}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => setShowDialog(false)}
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
