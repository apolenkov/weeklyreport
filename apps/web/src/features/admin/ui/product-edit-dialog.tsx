"use client";

import { MAX_PRODUCTS_PER_LEAD } from "@customreport/shared";
import { useRef } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";
import type { AdminProductView, AdminUserView } from "../model/admin-types";
import type { ProductFormData } from "../model/product-form";
import { AdminEntityDialogActions } from "./admin-entity-dialog-actions";

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
        name="productName"
        autoComplete="off"
        required
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
        name="leadId"
        autoComplete="off"
        required
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
    <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
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
      surfaceClassName="animate-scale-in mx-4 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl"
      ariaLabel={editingProduct ? "Edit product" : "Add product"}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isSaving && canSave) onSave();
        }}
      >
        <h3 className="shrink-0 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {editingProduct ? "Edit Product" : "Add Product"}
        </h3>
        <ProductFormFields
          form={form}
          onFormChange={onFormChange}
          leads={leads}
          leadProductCount={leadProductCount}
        />
        <AdminEntityDialogActions
          saveLabel={editingProduct !== null ? "Save Changes" : "Add Product"}
          isSaving={isSaving}
          canSave={canSave}
          onClose={onClose}
          saveDisabled={isSaving || !canSave}
        />
      </form>
    </DialogSurface>
  );
}
