"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/cache-keys";
import { toAdminProjectInput } from "../../lib/mappers";
import { useTRPC } from "../../lib/trpc-context";
import { ConfirmDeleteDialog } from "../lead/confirm-delete-dialog";
import { SearchInput } from "../search/search-input";
import type { MockProduct, MockUser } from "./mock-data";
import { ProductGroupChips } from "./product-group-chips";
import { StageAssignmentEditor } from "./stage-assignment-editor";
import { TabHeader, TabSearch } from "./tab-header";

type ProductsTabProps = {
  readonly products: MockProduct[];
  readonly users: MockUser[];
  readonly productFilter?: string | null;
};

export function ProductsTab({
  products,
  users,
  productFilter,
}: ProductsTabProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MockProduct | null>(
    null,
  );
  const [formName, setFormName] = useState("");
  const [formLeadId, setFormLeadId] = useState("");
  const [pendingArchive, setPendingArchive] = useState<MockProduct | null>(
    null,
  );
  // B5: local name filter (distinct from the global SearchInput deep-link)
  const [localSearch, setLocalSearch] = useState("");

  // Escape closes the Add/Edit dialog (mirrors users-tab — the inline
  // dialog has no Radix wrapper so we attach the listener manually).
  useEffect(() => {
    if (!showDialog) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowDialog(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showDialog]);

  useEffect(() => {
    if (!productFilter) return;
    if (products.some((product) => product.id === productFilter)) {
      setExpandedId(productFilter);
    }
  }, [productFilter, products]);

  // B9: exclude deactivated users from picker; existing assignments to
  // deactivated leads remain visible via getUserById (full users list).
  const leads = useMemo(
    () => users.filter((u) => u.role === "lead" && u.isActive),
    [users],
  );
  const getUserById = (id: string): MockUser | undefined =>
    users.find((u) => u.id === id);

  // 35-01: per-project assignment counts from the live DB. The mock-data
  // mapper hands every product a stages array of 7 nulls (assignment data
  // ships separately via listStageAssignments), so reading `product.stages`
  // for a count would always show 0/7. Light groupBy query instead.
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
        toast.error(err.message ?? "Failed to save product");
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
        toast.error(err.message ?? "Failed to archive product");
      },
    }),
  );

  function openAdd() {
    setEditingProduct(null);
    setFormName("");
    setFormLeadId(leads[0]?.id ?? "");
    setShowDialog(true);
  }

  function openEdit(product: MockProduct) {
    setEditingProduct(product);
    setFormName(product.name);
    setFormLeadId(product.leadOwnerId);
    setShowDialog(true);
  }

  function handleSave() {
    const lead = getUserById(formLeadId);
    saveProjectMut.mutate(
      toAdminProjectInput(
        {
          name: formName,
          leadOwnerId: formLeadId,
          leadName: lead?.name,
          archived: editingProduct?.status === "archived",
        },
        editingProduct?.id,
      ),
    );
  }

  function handleArchive(productId: string) {
    deleteProjectMut.mutate({ projectId: productId });
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

  function requestArchive(product: MockProduct) {
    setPendingArchive(product);
  }

  function confirmArchive() {
    if (!pendingArchive) return;
    handleArchive(pendingArchive.id);
    setPendingArchive(null);
  }

  const filteredProducts = useMemo(() => {
    let list = productFilter
      ? products.filter((p) => p.id === productFilter)
      : products;
    const needle = localSearch.trim().toLowerCase();
    if (needle) {
      list = list.filter((p) => p.name.toLowerCase().includes(needle));
    }
    return list;
  }, [products, productFilter, localSearch]);
  const filterMatched = !!productFilter && filteredProducts.length > 0;
  const activeProducts = filteredProducts.filter((p) => p.status === "active");
  const archivedProducts = filteredProducts.filter(
    (p) => p.status === "archived",
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
        {productFilter && (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
            <span className="text-sm text-[var(--color-muted-foreground)]">
              {filterMatched
                ? "Showing product from search"
                : "Product from search not found"}
            </span>
            <a
              href="/admin?tab=products"
              className="text-sm font-semibold text-[var(--color-starbucks-accent)] hover:text-[var(--color-primary)]"
            >
              Reset
            </a>
          </div>
        )}

        {/* Products list (table-like structure) */}
        <div className="space-y-3" data-testid="products-table">
          {activeProducts.map((product) => {
            const owner = getUserById(product.leadOwnerId);
            const assignedCount = stageCountByProject.get(product.id) ?? 0;
            const isExpanded = expandedId === product.id;

            return (
              <div
                key={product.id}
                className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : product.id)
                      }
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
                      {/* UFB-054 / Phase 56-C: read-only Groups chips
                          showing which ReportingGroups own this product
                          via the explicit GroupProduct edge. Editing
                          lives in the Groups tab. */}
                      <ProductGroupChips productId={product.id} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {assignedCount}/7 stages
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                      className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[rgba(0,117,74,0.3)] hover:bg-[var(--color-success)]"
                      aria-label={`Edit ${product.name}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => requestArchive(product)}
                      disabled={isArchiving}
                      className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[rgba(0,0,0,0.2)] hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Archive ${product.name}`}
                    >
                      Archive
                    </button>
                  </div>
                </div>

                {/* Stage assignments (expandable) */}
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
          })}
        </div>

        {/* Archived products */}
        {archivedProducts.length > 0 && (
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
                  onClick={() => handleRestore(product)}
                  disabled={isSaving}
                  className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[rgba(0,117,74,0.3)] hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Restore ${product.name}`}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      {showDialog && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop is a mouse convenience; dialog is keyboard-closable via Escape + Cancel button
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={() => setShowDialog(false)}
          role="presentation"
        >
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick only stops backdrop close-propagation; no keyboard equivalent needed (dialog closes via Escape + Cancel button) */}
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={editingProduct ? "Edit product" : "Add product"}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              {editingProduct ? "Edit Product" : "Add Product"}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="product-name"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Product Name
                </label>
                <input
                  id="product-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div>
                <label
                  htmlFor="product-lead"
                  className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
                >
                  Lead Owner
                </label>
                <select
                  id="product-lead"
                  value={formLeadId}
                  onChange={(e) => setFormLeadId(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                >
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                disabled={isSaving}
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving
                  ? "Saving…"
                  : editingProduct
                    ? "Save Changes"
                    : "Add Product"}
              </button>
            </div>
          </div>
        </div>
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

// ---- Helper icons ----

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
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
