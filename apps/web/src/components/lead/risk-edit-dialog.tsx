"use client";

import { useEffect, useState } from "react";
import type { Product, RiskEntry } from "./mock-data";
import { StageMultiSelect } from "./stage-multi-select";

type RiskEditDialogProps = {
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
   * 35-04 (FEAT-144): callback returning the SDLC stages the current lead
   * owns on a given project (= options for the "SDLC Stage" select).
   * Returning `[]` disables the Save button and surfaces an inline
   * "no stages assigned — contact admin" message.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
};

type SeverityChoice = {
  value: "at-risk" | "blocked";
  label: string;
  bg: string;
  color: string;
  border: string;
};
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

export function RiskEditDialog({
  open,
  risk,
  products,
  onSave,
  onCancel,
  defaultProductId,
  initialImpact,
  initialMitigation,
  stagesForProduct,
}: RiskEditDialogProps) {
  "use no memo";
  const isCreate = risk === null;
  const seedProduct = isCreate
    ? (products.find((p) => p.id === defaultProductId) ?? products[0])
    : products.find((p) => p.id === risk.productId);

  const [text, setText] = useState(risk?.text ?? "");
  const [severity, setSeverity] = useState<"at-risk" | "blocked">(
    risk?.severity ?? "at-risk",
  );
  const [productId, setProductId] = useState(
    risk?.productId ?? seedProduct?.id ?? "",
  );
  const [impact, setImpact] = useState(initialImpact ?? "");
  const [mitigation, setMitigation] = useState(initialMitigation ?? "");
  // UFB-073 (R1): pre-select all owned stages on create; restore existing on edit.
  const [stageIds, setStageIds] = useState<string[]>(
    risk?.stageIds
      ? [...risk.stageIds]
      : isCreate
        ? [...(stagesForProduct?.(seedProduct?.id ?? "") ?? [])]
        : [],
  );
  // Per-field error map: each required field's empty validation reads
  // its own message and toggles its border red. Replaces the old single
  // `error` string that only highlighted the first failure and
  // visually pinned the message under one (potentially wrong) field.
  const [errors, setErrors] = useState<{
    text?: string;
    impact?: string;
    mitigation?: string;
  }>({});

  // A13/A15 fix: stagesForProduct excluded from deps — unstable parent ref (new arrow fn
  // each render) causes form-race on autosave → React Query invalidate cycle, resetting
  // both text (A13) and severity (A15). Dialog is key-reset by parent on open-transition.
  useEffect(() => {
    if (open) {
      setText(risk?.text ?? "");
      setSeverity(risk?.severity ?? "at-risk");
      setProductId(risk?.productId ?? seedProduct?.id ?? "");
      setImpact(initialImpact ?? "");
      setMitigation(initialMitigation ?? "");
      setStageIds(
        risk?.stageIds
          ? [...risk.stageIds]
          : isCreate
            ? [...(stagesForProduct?.(seedProduct?.id ?? "") ?? [])]
            : [],
      );
      setErrors({});
    }
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    risk?.id,
    risk?.text,
    risk?.severity,
    risk?.productId,
    risk?.stageIds,
    seedProduct?.id,
    initialImpact,
    initialMitigation,
    defaultProductId,
    isCreate,
  ]);

  if (!open) return null;

  const headerProductName =
    products.find((p) => p.id === productId)?.name ?? "";
  const headerVerb = isCreate ? "Add Risk" : "Edit Risk";

  function handleSave() {
    const t = text.trim();
    const im = impact.trim();
    const m = mitigation.trim();
    const next: typeof errors = {};
    if (t.length === 0) next.text = "Risk description is required";
    if (im.length === 0) next.impact = "Impact is required";
    if (m.length === 0) next.mitigation = "Mitigation is required";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    const product = products.find((p) => p.id === productId) ?? products[0];
    if (!product) {
      setErrors({ text: "No product available" });
      return;
    }
    onSave({
      id: risk?.id ?? crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      stageIds: stageIds.length > 0 ? stageIds : undefined,
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[var(--radius)] bg-white p-6 shadow-2xl"
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

        <div className="space-y-4">
          {/* Risk description */}
          <div>
            <label
              className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
              htmlFor="risk-text"
            >
              Risk *
            </label>
            <p className="mb-1 text-[11px] text-[var(--color-muted-foreground)]">
              One sentence: what specifically might go wrong (the situation, not
              its consequence).
            </p>
            <textarea
              id="risk-text"
              autoFocus
              aria-invalid={errors.text ? "true" : "false"}
              aria-describedby={errors.text ? "risk-text-error" : undefined}
              className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
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

          {/* Impact */}
          <div>
            <label
              className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
              htmlFor="risk-impact"
            >
              Impact *
            </label>
            <p className="mb-1 text-[11px] text-[var(--color-muted-foreground)]">
              The consequence in real terms — what gets blocked, delayed, or
              costs more. Different from <em>Severity</em>: severity is the
              categorical level (At Risk / Blocked); impact is the narrative.
            </p>
            <textarea
              id="risk-impact"
              aria-invalid={errors.impact ? "true" : "false"}
              aria-describedby={errors.impact ? "risk-impact-error" : undefined}
              className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
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

          {/* Mitigation */}
          <div>
            <label
              className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
              htmlFor="risk-mitigation"
            >
              Mitigation *
            </label>
            <p className="mb-1 text-[11px] text-[var(--color-muted-foreground)]">
              What you (or someone) is doing to prevent or absorb the risk.
            </p>
            <textarea
              id="risk-mitigation"
              aria-invalid={errors.mitigation ? "true" : "false"}
              aria-describedby={
                errors.mitigation ? "risk-mitigation-error" : undefined
              }
              className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none ${
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

          <StageMultiSelect
            id="risk-stage"
            value={stageIds}
            stages={stagesForProduct?.(productId) ?? []}
            onChange={setStageIds}
          />

          {/* Severity chips */}
          <div>
            <span className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]">
              Severity
            </span>
            <p className="mb-1 text-[11px] text-[var(--color-muted-foreground)]">
              How urgent: <strong>At Risk</strong> = needs attention soon;
              <strong> Blocked</strong> = work has stopped. Drives the chip
              colour and SDLC-pipeline sync.
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

          {/* Product picker */}
          {products.length > 1 && (
            <div>
              <label
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
                htmlFor="risk-product"
              >
                Product
              </label>
              <select
                id="risk-product"
                className="w-full rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-3">
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
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)]"
          >
            Save Risk
          </button>
        </div>
      </div>
    </div>
  );
}
