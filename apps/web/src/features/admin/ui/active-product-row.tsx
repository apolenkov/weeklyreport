"use client";

import { STAGE_NAMES } from "@customreport/shared";

import { RotatingChevron } from "../../../shared/ui/report-shell/rotating-chevron";
import type { AdminProductView, AdminUserView } from "../model/admin-types";
import { ProductGroupChips } from "./product-group-chips";
import { StageAssignmentEditor } from "./stage-assignments/stage-assignment-editor";

const PRODUCT_ROW_TOUCH_TARGET_CLASS =
  "max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)]";

interface ActiveProductRowProps {
  readonly product: AdminProductView;
  readonly owner: AdminUserView | undefined;
  readonly assignedCount: number;
  readonly countsError: boolean;
  readonly isExpanded: boolean;
  readonly leads: readonly AdminUserView[];
  readonly onToggleExpand: (id: string) => void;
  readonly onEdit: (product: AdminProductView) => void;
  readonly onArchive: (product: AdminProductView) => void;
  readonly isArchiving: boolean;
}

export function ActiveProductRow({
  product,
  owner,
  assignedCount,
  countsError,
  isExpanded,
  leads,
  onToggleExpand,
  onEdit,
  onArchive,
  isArchiving,
}: ActiveProductRowProps) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] transition-shadow hover:shadow-sm">
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <ProductSummary
          product={product}
          owner={owner}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
        />
        <ProductRowActions
          product={product}
          assignedCount={assignedCount}
          countsError={countsError}
          onEdit={onEdit}
          onArchive={onArchive}
          isArchiving={isArchiving}
        />
      </div>

      <StageAssignmentDrawer
        product={product}
        leads={leads}
        isExpanded={isExpanded}
      />
    </div>
  );
}

function ProductSummary({
  product,
  owner,
  isExpanded,
  onToggleExpand,
}: {
  readonly product: AdminProductView;
  readonly owner: AdminUserView | undefined;
  readonly isExpanded: boolean;
  readonly onToggleExpand: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={() => onToggleExpand(product.id)}
        className={`flex h-7 w-7 ${PRODUCT_ROW_TOUCH_TARGET_CLASS} items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]`}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} stage assignments for ${product.name}`}
        aria-expanded={isExpanded}
      >
        <RotatingChevron expanded={isExpanded} />
      </button>
      <div className="min-w-0 flex-1 flex-col gap-1">
        <div>
          <span className="break-words text-sm font-semibold text-[var(--color-foreground)]">
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
  );
}

function ProductRowActions({
  product,
  assignedCount,
  countsError,
  onEdit,
  onArchive,
  isArchiving,
}: {
  readonly product: AdminProductView;
  readonly assignedCount: number;
  readonly countsError: boolean;
  readonly onEdit: (product: AdminProductView) => void;
  readonly onArchive: (product: AdminProductView) => void;
  readonly isArchiving: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
      <span className="text-xs text-[var(--color-muted-foreground)]">
        {countsError
          ? "Stages unavailable"
          : `${assignedCount}/${STAGE_NAMES.length} stages`}
      </span>
      <button
        type="button"
        onClick={() => onEdit(product)}
        className={`btn-press inline-flex min-h-[34px] ${PRODUCT_ROW_TOUCH_TARGET_CLASS} items-center rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] bg-[var(--color-card)] px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[var(--color-border-accent-hover)] hover:bg-[var(--color-success)]`}
        aria-label={`Edit ${product.name}`}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => onArchive(product)}
        disabled={isArchiving}
        className={`btn-press inline-flex min-h-[34px] ${PRODUCT_ROW_TOUCH_TARGET_CLASS} items-center rounded-[var(--radius-pill)] border border-[var(--card-surface-border)] bg-[var(--color-card)] px-3 text-xs font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-50`}
        aria-label={`Archive ${product.name}`}
      >
        Archive
      </button>
    </div>
  );
}

function StageAssignmentDrawer({
  product,
  leads,
  isExpanded,
}: {
  readonly product: AdminProductView;
  readonly leads: readonly AdminUserView[];
  readonly isExpanded: boolean;
}) {
  return (
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
  );
}
