"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useTRPC } from "../../../lib/trpc-context";
import { toAdminProjectInput } from "../model/admin";
import type { AdminProductView, AdminUserView } from "../model/admin-types";
import {
  EMPTY_PRODUCT_FORM,
  formFromProduct,
  type ProductFormData,
} from "../model/product-form";
import { useProductMutations } from "../model/products-tab-mutations";
import { useProductDeepLinkExpand } from "./use-product-deep-link-expand";

interface UseProductsTabStateArgs {
  readonly products: AdminProductView[];
  readonly users: AdminUserView[];
  readonly productFilter?: string | null | undefined;
}

// The picker offers active leads only, while getUserById reads the full user
// list so assignments to an already-deactivated lead still resolve to a name.
function useProductLeads(users: AdminUserView[]) {
  const leads = useMemo(
    () => users.filter((u) => u.role === "lead" && u.isActive),
    [users],
  );
  return {
    leads,
    getUserById: (id: string): AdminUserView | undefined =>
      users.find((u) => u.id === id),
  };
}

function useProductExpansion(
  products: AdminProductView[],
  productFilter: string | null | undefined,
) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { markUserToggle } = useProductDeepLinkExpand({
    productFilter,
    products,
    setExpandedId,
  });
  return {
    expandedId,
    toggleExpand: (id: string) => {
      markUserToggle(id);
      setExpandedId((current) => (current === id ? null : id));
    },
  };
}

function useProductEditDialog() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProductView | null>(
    null,
  );
  const [form, setForm] = useState<ProductFormData>(EMPTY_PRODUCT_FORM);

  return {
    showDialog,
    editingProduct,
    form,
    setForm,
    closeDialog: () => setShowDialog(false),
    openAdd: () => {
      setEditingProduct(null);
      // No silent owner preselection: the admin chooses the lead explicitly,
      // and the save gate blocks an unselected owner from submitting.
      setForm({ ...EMPTY_PRODUCT_FORM });
      setShowDialog(true);
    },
    openEdit: (product: AdminProductView) => {
      setEditingProduct(product);
      setForm(formFromProduct(product));
      setShowDialog(true);
    },
  };
}

function useProductFilters(
  products: AdminProductView[],
  productFilter: string | null | undefined,
) {
  // Local name filter, distinct from the global SearchInput deep-link.
  const [localSearch, setLocalSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const productFiltered = productFilter
      ? products.filter((p) => p.id === productFilter)
      : products;
    const needle = localSearch.trim().toLowerCase();
    return needle
      ? productFiltered.filter((p) => p.name.toLowerCase().includes(needle))
      : productFiltered;
  }, [products, productFilter, localSearch]);

  return {
    localSearch,
    setLocalSearch,
    filterMatched: !!productFilter && filteredProducts.length > 0,
    activeProducts: filteredProducts.filter((p) => p.status === "active"),
    archivedProducts: filteredProducts.filter((p) => p.status === "archived"),
  };
}

// product.stages is always 7 nulls — assignment data ships via
// listStageAssignments; count with a light groupBy instead.
function useStageCountByProject(): {
  readonly counts: ReadonlyMap<string, number>;
  readonly countsError: boolean;
} {
  const trpc = useTRPC();
  const stageCountsQuery = useQuery(
    trpc.admin.listStageAssignmentCounts.queryOptions(),
  );
  return {
    counts: useMemo(
      () =>
        new Map<string, number>(
          (stageCountsQuery.data ?? []).map((r) => [r.projectId, r.count]),
        ),
      [stageCountsQuery.data],
    ),
    countsError: stageCountsQuery.isError,
  };
}

function useProductArchive(archiveProduct: (projectId: string) => void) {
  const [pendingArchive, setPendingArchive] = useState<AdminProductView | null>(
    null,
  );
  return {
    pendingArchive,
    setPendingArchive,
    confirmArchive: () => {
      if (!pendingArchive) return;
      archiveProduct(pendingArchive.id);
      setPendingArchive(null);
    },
  };
}

// Save and restore write the same admin project payload; restore differs only
// by forcing `archived: false` on an existing row.
function productSaveActions({
  form,
  editingProduct,
  getUserById,
  saveProject,
}: {
  readonly form: ProductFormData;
  readonly editingProduct: AdminProductView | null;
  readonly getUserById: (id: string) => AdminUserView | undefined;
  readonly saveProject: (input: ReturnType<typeof toAdminProjectInput>) => void;
}) {
  const write = (
    fields: { name: string; leadOwnerId: string; archived: boolean },
    existingId: string | undefined,
  ) =>
    saveProject(
      toAdminProjectInput(
        { ...fields, leadName: getUserById(fields.leadOwnerId)?.name },
        existingId,
      ),
    );

  return {
    handleSave: () =>
      write(
        {
          name: form.name,
          leadOwnerId: form.leadId,
          archived: editingProduct?.status === "archived",
        },
        editingProduct?.id,
      ),
    handleRestore: (product: AdminProductView) =>
      write(
        {
          name: product.name,
          leadOwnerId: product.leadOwnerId,
          archived: false,
        },
        product.id,
      ),
  };
}

export function useProductsTabState({
  products,
  users,
  productFilter,
}: UseProductsTabStateArgs) {
  const { leads, getUserById } = useProductLeads(users);
  const expansion = useProductExpansion(products, productFilter);
  const dialog = useProductEditDialog();
  const filters = useProductFilters(products, productFilter);
  const { counts: stageCountByProject, countsError } = useStageCountByProject();
  const { saveProjectMut, deleteProjectMut } = useProductMutations(
    dialog.closeDialog,
  );
  const archive = useProductArchive((projectId) =>
    deleteProjectMut.mutate({ projectId }),
  );

  // Advisory count of active products owned by the lead picked in the dialog.
  // Counted from the FULL `products` prop — never the filtered list — so a name
  // filter or deep-link search cannot undercount.
  const leadProductCount = useMemo(
    () =>
      products.filter(
        (p) => p.leadOwnerId === dialog.form.leadId && p.status === "active",
      ).length,
    [products, dialog.form.leadId],
  );

  return {
    ...dialog,
    ...filters,
    ...expansion,
    ...archive,
    ...productSaveActions({
      form: dialog.form,
      editingProduct: dialog.editingProduct,
      getUserById,
      saveProject: saveProjectMut.mutate,
    }),
    leads,
    getUserById,
    stageCountByProject,
    countsError,
    leadProductCount,
    // leadOwnerId is a required uuid on the wire — an unselected owner must
    // not submit.
    canSave: dialog.form.name.trim().length > 0 && dialog.form.leadId !== "",
    isSaving: saveProjectMut.isPending,
    isArchiving: deleteProjectMut.isPending,
  };
}
