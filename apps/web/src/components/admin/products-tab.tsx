'use client';

import { useEffect, useMemo, useState } from 'react';

import type { MockProduct, MockUser, StageName } from './mock-data';
import { StageAssignmentEditor } from './stage-assignment-editor';

type ProductsTabProps = {
  readonly initialProducts: MockProduct[];
  readonly initialUsers: MockUser[];
};

export function ProductsTab({ initialProducts, initialUsers }: ProductsTabProps) {
  const [products, setProducts] = useState<MockProduct[]>(initialProducts);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MockProduct | null>(null);
  const [formName, setFormName] = useState('');
  const [formLeadId, setFormLeadId] = useState('');

  // Reset local CRUD state when the source query revalidates.
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const leads = useMemo(
    () => initialUsers.filter((u) => u.role === 'lead'),
    [initialUsers],
  );

  const getUserById = (id: string): MockUser | undefined =>
    initialUsers.find((u) => u.id === id);

  function openAdd() {
    setEditingProduct(null);
    setFormName('');
    setFormLeadId(leads[0]?.id ?? '');
    setShowDialog(true);
  }

  function openEdit(product: MockProduct) {
    setEditingProduct(product);
    setFormName(product.name);
    setFormLeadId(product.leadOwnerId);
    setShowDialog(true);
  }

  function handleSave() {
    if (editingProduct) {
      // TODO(Phase 22): replace local setState with admin.saveProject mutation + invalidateAdmin(qc, trpc) onSuccess.
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id ? { ...p, name: formName, leadOwnerId: formLeadId } : p,
        ),
      );
    } else {
      const newProduct: MockProduct = {
        id: `p${Date.now()}`,
        name: formName,
        leadOwnerId: formLeadId,
        status: 'active',
        stages: [
          { stage: 'Planning', assigneeId: null },
          { stage: 'Analysis', assigneeId: null },
          { stage: 'Design', assigneeId: null },
          { stage: 'Development', assigneeId: null },
          { stage: 'Testing', assigneeId: null },
          { stage: 'DevOps', assigneeId: null },
          { stage: 'Support', assigneeId: null },
        ],
      };
      // TODO(Phase 22): replace local setState with admin.saveProject mutation + invalidateAdmin(qc, trpc) onSuccess.
      setProducts((prev) => [...prev, newProduct]);
    }
    setShowDialog(false);
  }

  function handleArchive(productId: string) {
    // TODO(Phase 22): replace local setState with admin.deleteProject (archive) mutation + invalidateAdmin onSuccess.
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, status: p.status === 'archived' ? 'active' : 'archived' }
          : p,
      ),
    );
  }

  function handleStageAssign(productId: string, stage: StageName, userId: string | null) {
    // TODO(Phase 22): replace local setState with admin.saveStageAssignment / deleteStageAssignment + invalidateAdmin onSuccess.
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              stages: p.stages.map((s) =>
                s.stage === stage ? { ...s, assigneeId: userId } : s,
              ),
            }
          : p,
      ),
    );
  }

  const activeProducts = products.filter((p) => p.status === 'active');
  const archivedProducts = products.filter((p) => p.status === 'archived');

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {activeProducts.length} active products, {archivedProducts.length} archived
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="btn-press inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            aria-label="Add new product"
          >
            <PlusIcon />
            Add Product
          </button>
        </div>

        {/* Products list */}
        <div className="space-y-3">
          {activeProducts.map((product) => {
            const owner = getUserById(product.leadOwnerId);
            const assignedCount = product.stages.filter((s) => s.assigneeId).length;
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
                      onClick={() => setExpandedId(isExpanded ? null : product.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} stage assignments for ${product.name}`}
                      aria-expanded={isExpanded}
                    >
                      <ChevronIcon expanded={isExpanded} />
                    </button>
                    <div>
                      <span className="text-sm font-semibold text-[var(--color-foreground)]">
                        {product.name}
                      </span>
                      <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                        Owner: {owner?.name ?? 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {assignedCount}/7 stages
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                      className="btn-press rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
                      aria-label={`Edit ${product.name}`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleArchive(product.id)}
                      className="btn-press rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
                      aria-label={`Archive ${product.name}`}
                    >
                      Archive
                    </button>
                  </div>
                </div>

                {/* Stage assignments (expandable) */}
                <div
                  className="grid transition-[grid-template-rows] duration-300"
                  style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="border-t border-[var(--color-border)] px-4 pb-4">
                      <StageAssignmentEditor
                        product={product}
                        leads={leads}
                        onAssign={handleStageAssign}
                      />
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
                <span className="text-sm text-[var(--color-muted-foreground)]">{product.name}</span>
                <button
                  type="button"
                  onClick={() => handleArchive(product.id)}
                  className="btn-press rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={editingProduct ? 'Edit product' : 'Add product'}
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="product-name" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
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
                <label htmlFor="product-lead" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
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
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
              >
                {editingProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- Helper icons ----

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 transition-transform duration-200"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
