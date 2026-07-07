"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import type { Product, RiskEntry } from "../../report-sections/model/mock-data";
import { resolveRecordParent } from "../../report-sections/model/record-parent";
import {
  canonicalStageIds,
  canonicalStageName,
} from "../../report-sections/model/stage-tags";
import {
  type ParentActivityOption,
  ParentPicker,
  type RecordParent,
} from "../../report-sections/ui/product-picker";
import { StageMultiSelect } from "../../report-sections/ui/stage-multi-select";

interface RiskEditDialogProps {
  readonly open: boolean;
  /** null = create mode, RiskEntry = edit mode. */
  readonly risk: RiskEntry | null;
  readonly products: readonly Product[];
  /**
   * activity-first-class: the section author's attached activities. When
   * non-empty the parent picker offers them; choosing an activity hides the
   * stage step and parents the risk to the activity instead of a product.
   */
  readonly activities?: readonly ParentActivityOption[];
  readonly onSave: (
    next: RiskEntry & { impact: string; mitigation: string },
  ) => void;
  readonly onCancel: () => void;
  readonly defaultProductId?: string;
  /**
   * In create mode, preselect this activity as the parent — an activity
   * pill's unbacked raise. Wins over the seed product (XOR parent).
   */
  readonly defaultActivityId?: string;
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
   * unify-risk-stage-status: create-mode prefill from a chip-raise
   * interception — the clicked stage arrives pre-checked and the clicked
   * severity pre-selected. Ignored in edit mode (the risk's own values win).
   */
  readonly initialStageIds?: string[];
  readonly initialSeverity?: "at-risk" | "blocked";
  /**
   * Callback returning the SDLC stages the current lead owns on a given
   * project (= options for the "SDLC Stage" select). Returning `[]` disables
   * the Save button and surfaces an inline "no stages assigned — contact admin"
   * message.
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
const TEXTAREA_BORDER_ERROR =
  "border-[var(--color-destructive)] focus:border-[var(--color-destructive)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]";
const TEXTAREA_BORDER_DEFAULT =
  "border-[rgba(0,0,0,0.2)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)]";

const SEVERITY_CHOICES: readonly SeverityChoice[] = [
  {
    value: "at-risk",
    label: "! At Risk",
    bg: "var(--color-status-at-risk-bg)",
    color: "var(--color-status-at-risk-fg)",
    // border reuses the at-risk dot token (named for this #d4a017 gold accent);
    // the at-risk-border token is a different shade, an unsigned pixel shift.
    border: "var(--color-status-dot-at-risk)",
  },
  {
    value: "blocked",
    label: "✕ Blocked",
    bg: "var(--color-status-blocked-bg)",
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

interface RiskFieldErrors {
  text?: string;
  impact?: string;
  mitigation?: string;
  stageIds?: string;
}

/**
 * The context strip's pre-flagged owned stages for a product parent: the
 * product's at-risk/blocked stages the current lead owns. Empty for an activity
 * parent (no seed product), which is why the strip self-suppresses there.
 */
function computePreCheckedStages(
  seedProduct: Product | undefined,
  ownedStages: readonly string[],
): { name: string; severity: "at-risk" | "blocked" }[] {
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
}

/**
 * Per-field validation for the risk save. A stage is required only for a
 * product parent; an activity owns no stage, so it is never demanded there.
 */
function collectRiskErrors(args: {
  readonly text: string;
  readonly impact: string;
  readonly mitigation: string;
  readonly isActivityParent: boolean;
  readonly effectiveStageIds: readonly string[];
}): RiskFieldErrors {
  const errors: RiskFieldErrors = {};
  if (args.text.length === 0) errors.text = "Risk description is required";
  if (args.impact.length === 0) errors.impact = "Impact is required";
  if (args.mitigation.length === 0)
    errors.mitigation = "Mitigation is required";
  if (!args.isActivityParent && args.effectiveStageIds.length === 0)
    errors.stageIds = "Select at least one stage.";
  return errors;
}

/** The parent's display name for the header — the activity or the product. */
function resolveRiskParentName(args: {
  readonly isActivityParent: boolean;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly products: readonly Product[];
  readonly parentId: string;
  readonly risk: RiskEntry | null;
}): string {
  if (args.isActivityParent) return args.selectedActivity?.name ?? "";
  const product = args.products.find((p) => p.id === args.parentId);
  if (product) return product.name;
  return args.risk?.productId === args.parentId ? args.risk.productName : "";
}

/**
 * Resolve the product a product-parented save writes to. A cross-stage row may
 * reference a project outside the lead's stage-owned `products`, so keep the
 * original assignment instead of silently reassigning to the first product.
 */
function resolveRiskSaveProduct(
  products: readonly Product[],
  risk: RiskEntry | null,
  parentId: string,
): { id: string; name: string } | undefined {
  return (
    products.find((p) => p.id === parentId) ??
    (risk?.productId === parentId
      ? { id: risk.productId, name: risk.productName }
      : products.at(0))
  );
}

/**
 * The product-only stage step: the multi-select (with severity preview) plus
 * the zero-owned-stage "contact admin" notice. Rendered only for a product
 * parent; an activity owns no stage.
 */
function RiskStageStep({
  stageIds,
  availableStages,
  severity,
  isDeadEnd,
  error,
  onChange,
}: {
  readonly stageIds: string[];
  readonly availableStages: readonly string[];
  readonly severity: "at-risk" | "blocked";
  readonly isDeadEnd: boolean;
  readonly error: string | undefined;
  readonly onChange: (next: string[]) => void;
}) {
  return (
    <>
      <StageMultiSelect
        id="risk-stage"
        value={stageIds}
        stages={availableStages}
        onChange={onChange}
        previewSeverity={severity}
        // Suppress the stale required-stage error in the dead-end branch so it
        // never co-renders with the contact-admin notice below.
        error={isDeadEnd ? undefined : error}
        required
      />
      {isDeadEnd && (
        <p role="status" className="text-xs text-[var(--color-destructive)]">
          No stages assigned — contact admin.
        </p>
      )}
    </>
  );
}

/**
 * Mount/unmount shell (react-compiler-safe): the outer component returns null
 * when closed and mounts the inner content otherwise. Mount = fresh useState
 * from props; close = unmount. No useEffect reset is needed — the remount is the
 * structural reset, and the parent's openSeq dialogKey forces a fresh mount on
 * every open. This makes the invariant (stagesForProduct never read in any deps
 * array) structural.
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
  defaultActivityId,
  initialImpact,
  initialMitigation,
  initialStageIds,
  initialSeverity,
  stagesForProduct,
  activities = [],
}: RiskEditDialogProps) {
  const isCreate = risk === null;
  const seedProduct = isCreate
    ? (products.find((p) => p.id === defaultProductId) ?? products[0])
    : products.find((p) => p.id === risk.productId);

  const [text, setText] = useState(risk?.text ?? "");

  // Severity derived ONCE from pipeline on create; user choice is sticky thereafter.
  // Severity is NOT re-derived when the user toggles stage checkboxes.
  // A chip-raise prefill (initialSeverity) wins over the derived default.
  const [severity, setSeverity] = useState<"at-risk" | "blocked">(() => {
    if (risk?.severity) return risk.severity;
    if (initialSeverity) return initialSeverity;
    const ownedStages = stagesForProduct?.(seedProduct?.id ?? "") ?? [];
    return deriveFromPreChecked(seedProduct, ownedStages);
  });

  // activity-first-class: the record's parent — a product OR an attached
  // activity (XOR). Seeded from the bound risk on edit, else the create-mode
  // seed — a pill raise's activity beats the default product (shared seed
  // rule; falls back to the first activity for an activity-only lead).
  const [parent, setParent] = useState<RecordParent>(() =>
    resolveRecordParent(
      risk ?? {},
      {
        productId: seedProduct?.id,
        activityId: isCreate ? defaultActivityId : undefined,
      },
      activities,
    ),
  );
  const isActivityParent = parent.kind === "activity";
  const [impact, setImpact] = useState(initialImpact ?? "");
  const [mitigation, setMitigation] = useState(initialMitigation ?? "");

  // Stage checkboxes start empty on create. The user marks stages explicitly.
  // preCheckedStages still renders an info strip (context only), but does not
  // influence initial selection. A chip-raise prefill (initialStageIds)
  // pre-checks the clicked stage.
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

  // a11y (validation-focus): refs for the three local textareas so a failed
  // save can move focus to the first invalid field instead of stranding it
  // on Save.
  const textRef = useRef<HTMLTextAreaElement>(null);
  const impactRef = useRef<HTMLTextAreaElement>(null);
  const mitigationRef = useRef<HTMLTextAreaElement>(null);

  // Context strip: pipeline stages already flagged that are owned by this lead.
  const preCheckedStages = useMemo(
    () =>
      computePreCheckedStages(
        seedProduct,
        stagesForProduct?.(seedProduct?.id ?? "") ?? [],
      ),
    [seedProduct, stagesForProduct],
  );

  const selectedActivity = activities.find((a) => a.id === parent.id);
  const parentName = resolveRiskParentName({
    isActivityParent,
    selectedActivity,
    products,
    parentId: parent.id,
    risk,
  });
  const headerVerb = isCreate ? "Add Risk" : "Edit Risk";

  function handleStageChange(nextStageIds: string[]) {
    setStageIds(nextStageIds);
    // Clear stageIds error as soon as the user selects something.
    if (nextStageIds.length > 0) {
      setErrors((prev) => ({ ...prev, stageIds: undefined }));
    }
    // Severity is NOT updated here — user's explicit severity choice is sticky.
  }

  function setParentAndStages(nextParent: RecordParent) {
    setParent(nextParent);
    // fix-report-surface-integrity: clear the stage selection on any parent
    // switch. NEVER default to all owned stages — that "covers all" default is
    // the root cause of the inflated-completeness ("6/7") defect. Switching to
    // an activity hides the stage step; the lead marks product stages
    // explicitly; the single-owned-stage convenience lives in handleSave.
    setStageIds([]);
  }

  // activity-first-class: the stage step is product-only. An activity owns no
  // SDLC stage (Decision 5), so no stages are available and no dead-end applies.
  const availableStages = isActivityParent
    ? []
    : (stagesForProduct?.(parent.id) ?? []);
  const effectiveStageIds = computeEffectiveStageIds(stageIds, availableStages);
  const isZeroOwnedStageDeadEnd =
    !isActivityParent && isDeadEndProduct(availableStages, effectiveStageIds);

  /**
   * a11y (validation-focus): moves focus to the first invalid field after a
   * failed save, in the same order the fields are validated, so a keyboard
   * or screen-reader user lands on what needs fixing instead of being left
   * on Save. The stage checkbox group has no local ref of its own — the
   * dialog surface's only `<fieldset>` is StageMultiSelect's, so its first
   * checkbox is reached via a scoped query instead of a wrapper ref.
   */
  function focusFirstInvalidField(fieldErrors: typeof errors) {
    if (fieldErrors.text) {
      textRef.current?.focus();
      return;
    }
    if (fieldErrors.impact) {
      impactRef.current?.focus();
      return;
    }
    if (fieldErrors.mitigation) {
      mitigationRef.current?.focus();
      return;
    }
    if (fieldErrors.stageIds) {
      dialogSurfaceRef.current
        ?.querySelector<HTMLInputElement>("fieldset input")
        ?.focus();
    }
  }

  function handleSave() {
    // Early-return no-op so onSave is never called with an empty stageIds array
    // and the unsatisfiable "Select at least one stage." error is never reached.
    // The Ctrl/Cmd+Enter shortcut routes through here, so it inherits the guard.
    if (isZeroOwnedStageDeadEnd) return;
    const t = text.trim();
    const im = impact.trim();
    const m = mitigation.trim();
    const next = collectRiskErrors({
      text: t,
      impact: im,
      mitigation: m,
      isActivityParent,
      effectiveStageIds,
    });
    if (Object.keys(next).length > 0) {
      setErrors(next);
      focusFirstInvalidField(next);
      return;
    }
    // activity-first-class: an activity parent yields an activity-parented risk
    // (empty productId, no stage); a product parent keeps today's output.
    if (isActivityParent) {
      onSave({
        id: risk?.id ?? crypto.randomUUID(),
        productId: "",
        productName: selectedActivity?.name ?? "",
        activityId: parent.id,
        activityName: selectedActivity?.name,
        stageIds: [],
        severity,
        text: t,
        impact: im,
        mitigation: m,
      });
      return;
    }
    const product = resolveRiskSaveProduct(products, risk, parent.id);
    if (!product) {
      const noProductError = { text: "No product available" };
      setErrors(noProductError);
      focusFirstInvalidField(noProductError);
      return;
    }
    onSave({
      id: risk?.id ?? crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      activityId: null,
      stageIds: canonicalStageIds(effectiveStageIds),
      severity,
      text: t,
      impact: im,
      mitigation: m,
    });
  }

  // Escape + focus trap via the shared primitive; the surface autofocuses its
  // first field, and the primitive restores focus to the opener on close.
  const dialogSurfaceRef = useRef<HTMLDivElement>(null);
  useDialogFocus({
    open: true,
    onClose: onCancel,
    containerRef: dialogSurfaceRef,
  });

  function handleKeyDown(e: React.KeyboardEvent) {
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
        ref={dialogSurfaceRef}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[var(--radius)] bg-white p-4 md:p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${headerVerb} dialog`}
      >
        <h2 className="mb-4 font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {headerVerb}{" "}
          {parentName ? (
            <span className="text-[var(--color-muted-foreground)]">
              — {parentName}
            </span>
          ) : null}
        </h2>

        {/* Context strip: flagged owned SDLC stages — product parents only. An
            activity owns no stage, so suppress it there (preCheckedStages derives
            from the mount-time seed product and does not clear on a parent switch). */}
        {!isActivityParent && preCheckedStages.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
            <div className="font-medium text-amber-900">
              {parentName} →{" "}
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

        {/* Balanced two-column layout: a moderate max-w-3xl grid that collapses
            to one column on a narrow modal (md: breakpoint). Left holds the
            prose fields, right holds the Classification panel. The prose
            textareas use flex-1 to absorb height up to the taller (bordered)
            panel, so the two columns finish at a comparable height with no stray
            space. */}
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
                ref={textRef}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional initial focus for this modal dialog
                autoFocus
                aria-invalid={errors.text ? "true" : "false"}
                aria-describedby={errors.text ? "risk-text-error" : undefined}
                className={`w-full flex-1 resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
                  errors.text ? TEXTAREA_BORDER_ERROR : TEXTAREA_BORDER_DEFAULT
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
                  role="alert"
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
                ref={impactRef}
                aria-invalid={errors.impact ? "true" : "false"}
                aria-describedby={
                  errors.impact ? "risk-impact-error" : undefined
                }
                className={`w-full flex-1 resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
                  errors.impact
                    ? TEXTAREA_BORDER_ERROR
                    : TEXTAREA_BORDER_DEFAULT
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
                  role="alert"
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
                ref={mitigationRef}
                aria-invalid={errors.mitigation ? "true" : "false"}
                aria-describedby={
                  errors.mitigation ? "risk-mitigation-error" : undefined
                }
                className={`w-full flex-1 resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
                  errors.mitigation
                    ? TEXTAREA_BORDER_ERROR
                    : TEXTAREA_BORDER_DEFAULT
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
                  role="alert"
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

            {/* Parent picker kept FIRST so the classification panel orders
                Parent → Stages → Severity, the same order as the item dialog.
                Offers products and the author's attached activities; choosing an
                activity hides the stage step below. */}
            <ParentPicker
              id="risk-product"
              value={parent}
              products={products}
              activities={activities}
              onChange={setParentAndStages}
            />

            {/* activity-first-class: the stage step is product-only. */}
            {!isActivityParent && (
              <RiskStageStep
                stageIds={stageIds}
                availableStages={availableStages}
                severity={severity}
                isDeadEnd={isZeroOwnedStageDeadEnd}
                error={errors.stageIds}
                onChange={handleStageChange}
              />
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
                      className="inline-flex min-h-[var(--touch-target-min)] md:min-h-[34px] items-center gap-1 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-semibold transition-[background-color,border-color,color,opacity]"
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
            className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isZeroOwnedStageDeadEnd}
            className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Risk
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
