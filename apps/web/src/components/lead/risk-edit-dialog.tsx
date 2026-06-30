"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { Product, RiskEntry } from "./mock-data";
import { ProductPicker } from "./product-picker";
import { StageMultiSelect } from "./stage-multi-select";
import { canonicalStageIds, canonicalStageName } from "./stage-tags";

interface RiskEditDialogProps {
  readonly open: boolean;
  /** null = create mode, RiskEntry = edit mode. */
  readonly risk: RiskEntry | null;
  readonly products: readonly Product[];
  readonly onSave: (
    next: RiskEntry & { impact: string; mitigation: string },
  ) => void;
  readonly onCancel: () => void;
  readonly defaultProductId?: string;
  /**
   * The mockup-aligned dialog also exposes raw `impact` and `mitigation`
   * fields. The presentation `RiskEntry` doesn't carry them, but the
   * caller (lead-form) needs to write them onto the raw section.risks
   * row, so we let the dialog produce a richer object than the read
   * model.
   */
  readonly initialImpact?: string;
  readonly initialMitigation?: string;
  /**
   * unify-risk-stage-status (D2): create-mode prefill from a chip-raise
   * interception — the clicked stage arrives pre-checked and the clicked
   * severity pre-selected. Ignored in edit mode (the risk's own values win).
   */
  readonly initialStageIds?: string[];
  readonly initialSeverity?: "at-risk" | "blocked";
  /**
   * 35-04 (FEAT-144): callback returning the SDLC stages the current lead
   * owns on a given project (= options for the "SDLC Stage" select).
   * Returning `[]` disables the Save button and surfaces an inline
   * "no stages assigned — contact admin" message.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
}

interface SeverityChoice {
  value: "at-risk" | "blocked";
  label: string;
  bg: string;
  color: string;
  border: string;
}
const SEVERITY_CHOICES: readonly SeverityChoice[] = [
  {
    value: "at-risk",
    label: "! At Risk",
    bg: "#fef3c7",
    color: "#8a6d1b",
    border: "#d4a017",
  },
  {
    value: "blocked",
    label: "✕ Blocked",
    bg: "#fee2e2",
    color: "var(--color-destructive)",
    border: "var(--color-destructive)",
  },
];

/**
 * Derives initial severity from pipeline-flagged stages.
 * Called ONCE in useState initializer; never re-run on stage checkbox toggles
 * so the user's explicit severity choice is sticky.
 */
function deriveFromPreChecked(
  product: Product | undefined,
  ownedStages: readonly string[],
): "at-risk" | "blocked" {
  const flagged = (product?.stages ?? []).filter((s) =>
    ownedStages.some(
      (n) => canonicalStageName(n) === canonicalStageName(s.stageName),
    ),
  );
  if (flagged.some((s) => s.status === "blocked")) return "blocked";
  if (flagged.some((s) => s.status === "at-risk")) return "at-risk";
  return "at-risk";
}

/** Computes which stage IDs to pre-select on dialog open. */
function computeInitialStageIds(
  risk: RiskEntry | null,
  initialStageIds: string[] | undefined,
): string[] {
  if (risk?.stageIds) return [...risk.stageIds];
  return initialStageIds ? [...initialStageIds] : [];
}

/**
 * Resolves the stage IDs the save will use. When exactly one stage is owned and
 * nothing is explicitly checked, that single stage is applied automatically so
 * the single-stage UX stays frictionless; otherwise the explicit selection wins.
 * @param stageIds - the explicitly selected stage names
 * @param availableStages - the stages the lead owns on the chosen product
 * @returns the stage names the save should persist
 */
function computeEffectiveStageIds(
  stageIds: readonly string[],
  availableStages: readonly string[],
): readonly string[] {
  return stageIds.length === 0 && availableStages.length === 1
    ? [...availableStages]
    : stageIds;
}

/**
 * Detects the dead-end case: the lead owns zero stages on the chosen product
 * AND the row carries no stage of its own, so there is nothing to pick and the
 * dialog must not submit. A cross-stage row that already carries stageIds (its
 * product sits outside the stage-owned list) is NOT a dead end and stays
 * saveable.
 * @param availableStages - the stages the lead owns on the chosen product
 * @param effectiveStageIds - the stage IDs the save would persist
 * @returns true when the dialog must disable Save and show contact-admin
 */
function isDeadEndProduct(
  availableStages: readonly string[],
  effectiveStageIds: readonly string[],
): boolean {
  return availableStages.length === 0 && effectiveStageIds.length === 0;
}

/**
 * D12 mount/unmount shell (react-compiler-safe): the outer component returns
 * null when closed and mounts the inner content otherwise. Mount = fresh
 * useState from props; close = unmount. No useEffect reset is needed — the
 * remount is the structural reset, and the parent's openSeq dialogKey forces
 * a fresh mount on every open. This makes the A13/A15 invariant
 * (stagesForProduct never read in any deps array) structural.
 */
export function RiskEditDialog(props: RiskEditDialogProps) {
  if (!props.open) return null;
  return <RiskEditDialogContent {...props} />;
}

function RiskEditDialogContent({
  risk,
  products,
  onSave,
  onCancel,
  defaultProductId,
  initialImpact,
  initialMitigation,
  initialStageIds,
  initialSeverity,
  stagesForProduct,
}: RiskEditDialogProps) {
  const isCreate = risk === null;
  const seedProduct = isCreate
    ? (products.find((p) => p.id === defaultProductId) ?? products[0])
    : products.find((p) => p.id === risk.productId);

  const [text, setText] = useState(risk?.text ?? "");

  // Severity derived ONCE from pipeline on create; user choice is sticky thereafter.
  // Severity is NOT re-derived when the user toggles stage checkboxes (Phase 3.5 §5).
  // A chip-raise prefill (initialSeverity, D2) wins over the derived default.
  const [severity, setSeverity] = useState<"at-risk" | "blocked">(() => {
    if (risk?.severity) return risk.severity;
    if (initialSeverity) return initialSeverity;
    const ownedStages = stagesForProduct?.(seedProduct?.id ?? "") ?? [];
    return deriveFromPreChecked(seedProduct, ownedStages);
  });

  const [productId, setProductId] = useState(
    risk?.productId ?? seedProduct?.id ?? "",
  );
  const [impact, setImpact] = useState(initialImpact ?? "");
  const [mitigation, setMitigation] = useState(initialMitigation ?? "");

  // Phase 3.8: stage checkboxes start empty on create. The user marks
  // stages explicitly. preCheckedStages still renders an info strip
  // (context only), but does not influence initial selection. A chip-raise
  // prefill (initialStageIds, D2) pre-checks the clicked stage.
  const [stageIds, setStageIds] = useState<string[]>(() => {
    return computeInitialStageIds(risk, initialStageIds);
  });

  // Per-field error map.
  const [errors, setErrors] = useState<{
    text?: string;
    impact?: string;
    mitigation?: string;
    stageIds?: string;
  }>({});

  // Context strip: pipeline stages already flagged that are owned by this lead.
  const preCheckedStages = useMemo(() => {
    const ownedStages = stagesForProduct?.(seedProduct?.id ?? "") ?? [];
    return (seedProduct?.stages ?? [])
      .filter((s) => s.status === "at-risk" || s.status === "blocked")
      .filter((s) =>
        ownedStages.some(
          (n) => canonicalStageName(n) === canonicalStageName(s.stageName),
        ),
      )
      .map((s) => ({
        name: canonicalStageName(s.stageName),
        severity: s.status as "at-risk" | "blocked",
      }));
  }, [seedProduct, stagesForProduct]);

  const headerProductName =
    products.find((p) => p.id === productId)?.name ??
    (risk?.productId === productId ? risk.productName : "");
  const headerVerb = isCreate ? "Add Risk" : "Edit Risk";

  function handleStageChange(nextStageIds: string[]) {
    setStageIds(nextStageIds);
    // Clear stageIds error as soon as the user selects something.
    if (nextStageIds.length > 0) {
      setErrors((prev) => ({ ...prev, stageIds: undefined }));
    }
    // Severity is NOT updated here — user's explicit severity choice is sticky.
  }

  function setProductAndStages(nextProductId: string) {
    setProductId(nextProductId);
    // W11 (fix-report-surface-integrity 3.10): clear the stage selection on a
    // product switch. NEVER default to all owned stages — that "covers all"
    // default is the root cause of the inflated-completeness ("6/7") defect.
    // The lead marks stages explicitly; the single-owned-stage convenience is
    // still handled at save time (effectiveStageIds in handleSave).
    setStageIds([]);
  }

  const availableStages = stagesForProduct?.(productId) ?? [];
  const effectiveStageIds = computeEffectiveStageIds(stageIds, availableStages);
  const isZeroOwnedStageDeadEnd = isDeadEndProduct(
    availableStages,
    effectiveStageIds,
  );

  function handleSave() {
    // Early-return no-op so onSave is never called with an empty stageIds array
    // and the unsatisfiable "Select at least one stage." error is never reached.
    // The Ctrl/Cmd+Enter shortcut routes through here, so it inherits the guard.
    if (isZeroOwnedStageDeadEnd) return;
    const t = text.trim();
    const im = impact.trim();
    const m = mitigation.trim();
    const next: typeof errors = {};
    if (t.length === 0) next.text = "Risk description is required";
    if (im.length === 0) next.impact = "Impact is required";
    if (m.length === 0) next.mitigation = "Mitigation is required";
    if (effectiveStageIds.length === 0)
      next.stageIds = "Select at least one stage.";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    // Cross-stage rows (fix-lead-surface-name-resolution): an edited risk may
    // reference a project outside the lead's stage-owned `products`. Keep the
    // original assignment instead of silently reassigning to the first product.
    const product =
      products.find((p) => p.id === productId) ??
      (risk?.productId === productId
        ? { id: risk.productId, name: risk.productName }
        : products.at(0));
    if (!product) {
      setErrors({ text: "No product available" });
      return;
    }
    onSave({
      id: risk?.id ?? crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      stageIds: canonicalStageIds(effectiveStageIds),
      severity,
      text: t,
      impact: im,
      mitigation: m,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops backdrop click-through; not an interactive action, so no keyboard equivalent applies */}
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[var(--radius)] bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${headerVerb} dialog`}
      >
        <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {headerVerb}{" "}
          {headerProductName ? (
            <span className="text-[var(--color-muted-foreground)]">
              — {headerProductName}
            </span>
          ) : null}
        </h2>

        {/* Context strip: shown only when pipeline already has flagged owned stages */}
        {preCheckedStages.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
            <div className="font-medium text-amber-900">
              {headerProductName} →{" "}
              {preCheckedStages
                .map(
                  (s) =>
                    `${s.name} (${s.severity === "blocked" ? "Blocked" : "At Risk"})`,
                )
                .join(" · ")}
            </div>
            <div className="mt-0.5 text-[11px] text-amber-700">
              Already flagged in SDLC pipeline.
            </div>
          </div>
        )}

        {/* lead-live-walk-2026-06-14 1.x: balanced two-column layout.
            The former single column ran the full 92vh (Product picker clipped
            off-screen); the older max-w-4xl two-column read as overloaded. This
            is the middle ground: a moderate max-w-3xl grid that collapses to
            one column on a narrow modal (md: breakpoint). Left holds the prose
            fields, right holds the Classification panel. The prose textareas
            use flex-1 to absorb height up to the taller (bordered) panel, so
            the two columns finish at a comparable height with no stray space. */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch">
          {/* Left column: Risk / Impact / Mitigation prose fields. flex-col so
              the textareas can flex-1 and fill the column to the panel height. */}
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-1 flex-col">
              <label
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
                htmlFor="risk-text"
              >
                Risk *
              </label>
              <textarea
                id="risk-text"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional initial focus for this modal dialog
                autoFocus
                aria-invalid={errors.text ? "true" : "false"}
                aria-describedby={errors.text ? "risk-text-error" : undefined}
                className={`w-full flex-1 resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
                  errors.text
                    ? "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]"
                    : "border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]"
                }`}
                style={{ minHeight: "60px" }}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setErrors((prev) => ({ ...prev, text: undefined }));
                }}
                placeholder="e.g. Vendor API regression delays OAuth2 integration"
              />
              {errors.text && (
                <p
                  id="risk-text-error"
                  className="mt-1 text-xs text-[var(--color-destructive)]"
                >
                  {errors.text}
                </p>
              )}
            </div>

            <div className="flex flex-1 flex-col">
              <label
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
                htmlFor="risk-impact"
              >
                Impact *
              </label>
              <textarea
                id="risk-impact"
                aria-invalid={errors.impact ? "true" : "false"}
                aria-describedby={
                  errors.impact ? "risk-impact-error" : undefined
                }
                className={`w-full flex-1 resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
                  errors.impact
                    ? "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]"
                    : "border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]"
                }`}
                style={{ minHeight: "50px" }}
                value={impact}
                onChange={(e) => {
                  setImpact(e.target.value);
                  setErrors((prev) => ({ ...prev, impact: undefined }));
                }}
                placeholder="e.g. Delays Q3 launch by 2 weeks; 4 downstream teams idle"
              />
              {errors.impact && (
                <p
                  id="risk-impact-error"
                  className="mt-1 text-xs text-[var(--color-destructive)]"
                >
                  {errors.impact}
                </p>
              )}
            </div>

            <div className="flex flex-1 flex-col">
              <label
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
                htmlFor="risk-mitigation"
              >
                Mitigation *
              </label>
              <textarea
                id="risk-mitigation"
                aria-invalid={errors.mitigation ? "true" : "false"}
                aria-describedby={
                  errors.mitigation ? "risk-mitigation-error" : undefined
                }
                className={`w-full flex-1 resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
                  errors.mitigation
                    ? "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]"
                    : "border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]"
                }`}
                style={{ minHeight: "50px" }}
                value={mitigation}
                onChange={(e) => {
                  setMitigation(e.target.value);
                  setErrors((prev) => ({ ...prev, mitigation: undefined }));
                }}
                placeholder="e.g. Vendor escalation in progress; ETA 48h"
              />
              {errors.mitigation && (
                <p
                  id="risk-mitigation-error"
                  className="mt-1 text-xs text-[var(--color-destructive)]"
                >
                  {errors.mitigation}
                </p>
              )}
            </div>
          </div>

          {/* Classification: the right column — one light bordered panel
              grouping the stage / severity / product meta so it reads as a
              distinct block beside the prose fields. */}
          <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <span className="block text-xs font-semibold tracking-wide text-[var(--color-muted-foreground)] uppercase">
              Classification
            </span>

            {/* unify-record-dialogs: Product picker is kept FIRST so the
                classification panel orders Product → Stages → Severity, the same
                order as the item and decision dialogs. */}
            <ProductPicker
              id="risk-product"
              value={productId}
              products={products}
              onChange={setProductAndStages}
            />

            <StageMultiSelect
              id="risk-stage"
              value={stageIds}
              stages={stagesForProduct?.(productId) ?? []}
              onChange={handleStageChange}
              previewSeverity={severity}
              // Suppress the stale required-stage error in the dead-end branch:
              // a prior "Select at least one stage." set before switching to a
              // zero-owned product must not co-render with the contact-admin
              // message below.
              error={isZeroOwnedStageDeadEnd ? undefined : errors.stageIds}
              required
            />

            {isZeroOwnedStageDeadEnd && (
              <p
                role="status"
                className="text-xs text-[var(--color-destructive)]"
              >
                No stages assigned — contact admin.
              </p>
            )}

            {/* Severity chips */}
            <div>
              <span className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">
                Severity
              </span>
              <p className="mb-1 text-[11px] text-[var(--color-muted-foreground)]">
                <strong>At Risk</strong> = needs attention;{" "}
                <strong>Blocked</strong> = work stopped.
              </p>
              <div className="flex flex-wrap gap-2">
                {SEVERITY_CHOICES.map((c) => {
                  const selected = severity === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setSeverity(c.value)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold transition-[background-color,border-color,color,opacity]"
                      style={{
                        background: selected ? c.bg : "transparent",
                        color: selected ? c.color : "var(--color-foreground)",
                        border: `1.5px solid ${selected ? c.border : "rgba(0,0,0,0.15)"}`,
                      }}
                      aria-pressed={selected}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky footer — always visible at bottom of dialog */}
        <div className="sticky bottom-0 mt-5 flex justify-end gap-3 border-t bg-white pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isZeroOwnedStageDeadEnd}
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Risk
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
