"use client";

import { MAX_PRODUCTS_PER_LEAD } from "@customreport/shared";
import { useRef } from "react";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";
import type { AdminProductView, AdminUserView } from "../model/admin-types";
import type { ProductFormData } from "../model/product-form";

const FIELD_LABEL_CLASS =
  "mb-1 block text-sm font-medium text-[var(--color-foreground)]";
const FIELD_CONTROL_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";

interface ProductEditDialogProps {
  readonly editingProduct: AdminProductView | null;
  readonly form: ProductFormData;
  readonly onFormChange: (form: ProductFormData) => void;
  readonly leads: readonly AdminUserView[];
  readonly leadProductCount: number;
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

function ProductNameField({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor="product-name" className={FIELD_LABEL_CLASS}>
        Product Name
      </label>
      <input
        id="product-name"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_CONTROL_CLASS}
      />
    </div>
  );
}

function LeadOwnerField({
  value,
  onChange,
  leads,
  leadProductCount,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly leads: readonly AdminUserView[];
  readonly leadProductCount: number;
}) {
  return (
    <div>
      <label htmlFor="product-lead" className={FIELD_LABEL_CLASS}>
        Lead Owner
      </label>
      <select
        id="product-lead"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_CONTROL_CLASS}
      >
        {value === "" && (
          <option value="" disabled>
            Select lead…
          </option>
        )}
        {leads.map((lead) => (
          <option key={lead.id} value={lead.id}>
            {lead.name}
          </option>
        ))}
      </select>
      <p
        className="mt-1.5 text-xs text-[var(--color-muted-foreground)]"
        data-testid="lead-product-count"
      >
        {leadProductCount} of {MAX_PRODUCTS_PER_LEAD} products
      </p>
      {leadProductCount >= MAX_PRODUCTS_PER_LEAD ? (
        <p
          role="note"
          data-testid="lead-product-overcap"
          className="mt-1 text-xs font-medium text-[var(--color-status-at-risk-fg)]"
        >
          At or above the recommended {MAX_PRODUCTS_PER_LEAD}-product limit —
          you can still save.
        </p>
      ) : null}
    </div>
  );
}

function ProductFormFields({
  form,
  onFormChange,
  leads,
  leadProductCount,
}: {
  readonly form: ProductFormData;
  readonly onFormChange: (form: ProductFormData) => void;
  readonly leads: readonly AdminUserView[];
  readonly leadProductCount: number;
}) {
  return (
    <div className="mt-4 space-y-4">
      <ProductNameField
        value={form.name}
        onChange={(name) => onFormChange({ ...form, name })}
      />
      <LeadOwnerField
        value={form.leadId}
        onChange={(leadId) => onFormChange({ ...form, leadId })}
        leads={leads}
        leadProductCount={leadProductCount}
      />
    </div>
  );
}

function ProductDialogFooter({
  isEditing,
  isSaving,
  canSave,
  onSave,
  onClose,
}: {
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  readonly canSave: boolean;
  readonly onSave: () => void;
  readonly onClose: () => void;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={isSaving}
        className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || !canSave}
        className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving…" : isEditing ? "Save Changes" : "Add Product"}
      </button>
    </div>
  );
}

export function ProductEditDialog({
  editingProduct,
  form,
  onFormChange,
  leads,
  leadProductCount,
  canSave,
  isSaving,
  onSave,
  onClose,
}: ProductEditDialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape-to-close + restore-to-trigger via the shared primitive.
  // The dialog mounts on open, so the hook self-captures the opener at first
  // render and restores focus to it on close.
  useDialogFocus({ open: true, onClose, containerRef: surfaceRef });

  return (
    <DialogSurface
      surfaceRef={surfaceRef}
      onDismiss={onClose}
      surfaceClassName="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl"
      ariaLabel={editingProduct ? "Edit product" : "Add product"}
    >
      <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
        {editingProduct ? "Edit Product" : "Add Product"}
      </h3>
      <ProductFormFields
        form={form}
        onFormChange={onFormChange}
        leads={leads}
        leadProductCount={leadProductCount}
      />
      <ProductDialogFooter
        isEditing={editingProduct !== null}
        isSaving={isSaving}
        canSave={canSave}
        onSave={onSave}
        onClose={onClose}
      />
    </DialogSurface>
  );
}
