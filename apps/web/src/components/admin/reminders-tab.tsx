"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/cache-keys";
import type { AdminReminderPolicyFormInput } from "../../lib/mappers";
import { toReminderPolicyInput } from "../../lib/mappers";
import { useTRPC } from "../../lib/trpc-context";
import { ConfirmDeleteDialog } from "../lead/confirm-delete-dialog";
import { DerivedRulesPanel } from "./derived-rules-panel";
import type { MockPeriod, MockReminder, MockReminderPolicy } from "./mock-data";
import { TabHeader, TabSearch } from "./tab-header";
// UFB-035: timezone catalog moved to ./timezone-options so the Settings →
// Reminders sub-tab (UFB-048 / Phase 48-B) can reuse the same curated list.
import { TIMEZONE_OPTIONS } from "./timezone-options";

const KIND_OPTIONS: readonly {
  value: MockReminderPolicy["kind"];
  label: string;
}[] = [
  { value: "deadline", label: "Deadline reminder" },
  { value: "follow_up", label: "Follow-up reminder" },
  { value: "escalation", label: "Escalation digest" },
];

const AUDIENCE_OPTIONS: readonly {
  value: MockReminderPolicy["audience"];
  label: string;
}[] = [
  { value: "lead-with-draft", label: "Leads with draft" },
  { value: "head-of-late", label: "Head of late leads" },
];

interface RemindersTabProps {
  /** UFB-036 (Phase 44-04): policies are the new top-level editable rows. */
  readonly policies: readonly MockReminderPolicy[];
  /**
   * Read-only derived rules grouped by `policyId`. The Reminders Tab's
   * expander surfaces them under each policy. Rules whose `policyId`
   * is `null` (legacy, pre-44-01) are NOT surfaced here — they still
   * exist in the DB but live outside the policy model.
   */
  readonly derivedRulesByPolicyId: Readonly<
    Record<string, readonly MockReminder[]>
  >;
  /** Used by the derived-rules panel to render period labels. */
  readonly periods: readonly MockPeriod[];
  /**
   * UFB-048 (Phase 48-B): organisation-wide defaults for new policies.
   * When the admin opens the «New Policy» form, the timezone and audience
   * controls prefill from these values instead of hardcoded constants.
   * Optional — older callers (and component tests that predate 48-B) get
   * the historical Europe/Moscow + lead-with-draft defaults.
   */
  readonly defaultTimezone?: string;
  readonly defaultAudience?: MockReminderPolicy["audience"];
}

type PolicyFormState = AdminReminderPolicyFormInput & {
  /** ISO `YYYY-MM-DD` of "now" when this form was first opened. */
  todayIso: string;
  /**
   * Mirrors the "forever" checkbox. When `true`, `validUntilIso` is
   * forced to `null` and the upper-bound input is hidden.
   */
  foreverChecked: boolean;
};

function todayIsoString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * UFB-048 (Phase 48-B): the timezone + audience defaults are now sourced
 * from AppSettings (the org-wide singleton) rather than hardcoded here.
 * Historical fallbacks preserved so component tests that don't pipe in
 * settings still render with the same shape they did pre-48-B.
 */
function emptyPolicyForm(opts?: {
  timezone?: string;
  audience?: MockReminderPolicy["audience"];
}): PolicyFormState {
  const today = todayIsoString();
  return {
    kind: "deadline",
    offsetMinutes: -1440, // T-24h
    timezone: opts?.timezone ?? "Europe/Moscow",
    audience: opts?.audience ?? "lead-with-draft",
    active: true,
    validFromIso: today,
    validUntilIso: null,
    todayIso: today,
    foreverChecked: true,
  };
}

function policyToForm(policy: MockReminderPolicy): PolicyFormState {
  return {
    kind: policy.kind,
    offsetMinutes: policy.offsetMinutes,
    timezone: policy.timezone,
    audience: policy.audience,
    active: policy.active,
    validFromIso: isoFromDate(policy.validFrom),
    validUntilIso:
      policy.validUntil === null ? null : isoFromDate(policy.validUntil),
    todayIso: todayIsoString(),
    foreverChecked: policy.validUntil === null,
  };
}

/**
 * Format the wall-clock offset like "T-24h" / "T+2h" / "T-15m" so admins
 * can sanity-check offsetMinutes at a glance. We avoid Intl-RelativeTimeFormat
 * here because the canonical "T-24h" form is the one used in the spec docs.
 */
function formatOffset(minutes: number): string {
  if (minutes === 0) return "T+0";
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  if (abs % 60 === 0) {
    return `T${sign}${abs / 60}h`;
  }
  return `T${sign}${abs}m`;
}

function pluralize(value: number, singular: string, plural: string): string {
  return value === 1 ? singular : plural;
}

function formatPolicyTiming(policy: MockReminderPolicy): string {
  const minutes = policy.offsetMinutes;
  if (minutes === 0) return "At deadline";

  const abs = Math.abs(minutes);
  const direction = minutes < 0 ? "before" : "after";

  if (abs % 60 === 0 && abs <= 48 * 60) {
    const hours = abs / 60;
    return `${hours} ${pluralize(hours, "hour", "hours")} ${direction} deadline`;
  }

  if (abs % 1440 === 0) {
    const days = abs / 1440;
    return `${days} ${pluralize(days, "day", "days")} ${direction} deadline`;
  }

  return `${abs} ${pluralize(abs, "minute", "minutes")} ${direction} deadline`;
}

function formatPolicyAudience(
  audience: MockReminderPolicy["audience"],
): string {
  switch (audience) {
    case "lead-with-draft":
      return "Leads with drafts";
    case "head-of-late":
      return "Head of late leads";
  }
}

function formatGeneratedRulesSummary(count: number): string {
  if (count === 0) return "No scheduled periods yet";
  if (count === 1) return "1 scheduled period";
  return `${count} scheduled periods`;
}

function formatValidityWindow(policy: MockReminderPolicy): string {
  const from = isoFromDate(policy.validFrom);
  if (policy.validUntil === null) {
    return `Valid since ${from} · no end date`;
  }
  const until = isoFromDate(policy.validUntil);
  return `${from} → ${until}`;
}

export function RemindersTab({
  policies,
  derivedRulesByPolicyId,
  periods,
  defaultTimezone,
  defaultAudience,
}: RemindersTabProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(policies.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  // UFB-048 (Phase 48-B): seed the form with org-wide defaults so the «New
  // Policy» form opens with the admin's preferred timezone and audience.
  const [form, setForm] = useState<PolicyFormState>(() =>
    emptyPolicyForm({
      timezone: defaultTimezone,
      audience: defaultAudience,
    }),
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pendingDelete, setPendingDelete] = useState<MockReminderPolicy | null>(
    null,
  );

  const periodById = useMemo(
    () => new Map(periods.map((p) => [p.id, p] as const)),
    [periods],
  );

  const saveMut = useMutation(
    trpc.admin.savePolicy.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success(editingId ? "Policy updated" : "Policy created");
        setShowForm(false);
        setEditingId(null);
        setForm(
          emptyPolicyForm({
            timezone: defaultTimezone,
            audience: defaultAudience,
          }),
        );
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to save policy";
        toast.error(message);
      },
    }),
  );

  const removeMut = useMutation(
    trpc.admin.removePolicy.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Policy removed");
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to remove policy";
        toast.error(message);
      },
    }),
  );

  const isMutating = saveMut.isPending || removeMut.isPending;

  // Derived: validity-window guard for the Save button.
  const validityValid = useMemo(() => {
    if (form.foreverChecked) return true;
    if (form.validUntilIso === null) return true;
    return form.validUntilIso >= form.validFromIso;
  }, [form.foreverChecked, form.validFromIso, form.validUntilIso]);

  function handleNewPolicy() {
    setEditingId(null);
    // UFB-048 (Phase 48-B): seed with org defaults from AppSettings.
    setForm(
      emptyPolicyForm({
        timezone: defaultTimezone,
        audience: defaultAudience,
      }),
    );
    setShowForm(true);
  }

  function handleEditPolicy(policy: MockReminderPolicy) {
    setEditingId(policy.id);
    setForm(policyToForm(policy));
    setShowForm(true);
  }

  function handleSave() {
    if (!validityValid) {
      toast.error("End date must be after start date");
      return;
    }
    const payload = toReminderPolicyInput(
      {
        kind: form.kind,
        offsetMinutes: form.offsetMinutes,
        timezone: form.timezone,
        audience: form.audience,
        active: form.active,
        validFromIso: form.validFromIso,
        validUntilIso: form.foreverChecked ? null : form.validUntilIso,
      },
      editingId ?? undefined,
    );
    saveMut.mutate(payload);
  }

  function handleConfirmRemove() {
    if (!pendingDelete) return;
    removeMut.mutate({ id: pendingDelete.id });
    setPendingDelete(null);
  }

  function toggleExpanded(policyId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(policyId)) {
        next.delete(policyId);
      } else {
        next.add(policyId);
      }
      return next;
    });
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredPolicies = useMemo(() => {
    if (!normalizedSearch) return policies;
    return policies.filter((p) =>
      [
        p.kind,
        p.timezone,
        p.audience,
        formatPolicyTiming(p),
        formatPolicyAudience(p.audience),
        p.active ? "active" : "disabled",
        formatOffset(p.offsetMinutes),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [normalizedSearch, policies]);

  return (
    <div className="space-y-4">
      <TabHeader
        title="Reminder Policies"
        description="Configure once. Each policy is auto-applied to every report period whose deadline falls inside the validity window."
        count={`${policies.length} policies`}
        search={
          <TabSearch
            value={search}
            onChange={setSearch}
            placeholder="Search reminder policies…"
            testId="reminders-search"
            ariaLabel="Search reminder policies"
          />
        }
        actions={
          <button
            type="button"
            onClick={handleNewPolicy}
            data-testid="new-policy-button"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
          >
            <PlusIcon />
            New Policy
          </button>
        }
      />

      {showForm && (
        <PolicyForm
          form={form}
          editing={editingId !== null}
          isSaving={saveMut.isPending}
          validityValid={validityValid}
          onChange={setForm}
          onCancel={() => {
            setShowForm(false);
            setEditingId(null);
            setForm(
              emptyPolicyForm({
                timezone: defaultTimezone,
                audience: defaultAudience,
              }),
            );
          }}
          onSave={handleSave}
        />
      )}

      <div className="space-y-3">
        {filteredPolicies.length === 0 && (
          <div
            data-testid="reminders-empty-state"
            className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center"
          >
            {policies.length === 0 ? (
              <>
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-border)]">
                  {/* Bell icon */}
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 text-[var(--color-muted-foreground)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[var(--color-foreground)]">
                  No reminder policies yet
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Policies fire automatically before each deadline — for all
                  periods that fall inside the validity window.
                </p>
                <button
                  type="button"
                  onClick={handleNewPolicy}
                  className="btn-press mt-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[rgba(0,117,74,0.25)] bg-[rgba(0,117,74,0.08)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-success)]"
                >
                  <PlusIcon />
                  Create first policy
                </button>
              </>
            ) : (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No reminder policies match the search.
              </p>
            )}
          </div>
        )}

        {filteredPolicies.length > 0 && (
          <div className="space-y-3">
            {filteredPolicies.map((policy) => {
              const derivedRules = derivedRulesByPolicyId[policy.id] ?? [];
              const isExpanded = expanded.has(policy.id);
              return (
                <PolicyRow
                  key={policy.id}
                  policy={policy}
                  derivedCount={derivedRules.length}
                  isExpanded={isExpanded}
                  isMutating={isMutating}
                  derivedRules={derivedRules}
                  periodById={periodById}
                  onToggle={() => toggleExpanded(policy.id)}
                  onEdit={() => handleEditPolicy(policy)}
                  onRemove={() => setPendingDelete(policy)}
                />
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Remove reminder policy?"
        preview={pendingDelete ? formatPolicyHeadline(pendingDelete) : ""}
        subtitle={
          pendingDelete ? formatValidityWindow(pendingDelete) : undefined
        }
        consequence={
          pendingDelete
            ? `This will remove ${
                (derivedRulesByPolicyId[pendingDelete.id] ?? []).length
              } derived rule(s) and stop further reminders.`
            : ""
        }
        onConfirm={handleConfirmRemove}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: PolicyRow
// ---------------------------------------------------------------------------

interface PolicyRowProps {
  readonly policy: MockReminderPolicy;
  readonly derivedCount: number;
  readonly isExpanded: boolean;
  readonly isMutating: boolean;
  readonly derivedRules: readonly MockReminder[];
  readonly periodById: ReadonlyMap<string, MockPeriod>;
  readonly onToggle: () => void;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}

function PolicyRow({
  policy,
  derivedCount,
  isExpanded,
  isMutating,
  derivedRules,
  periodById,
  onToggle,
  onEdit,
  onRemove,
}: PolicyRowProps) {
  const generatedSummary = formatGeneratedRulesSummary(derivedCount);

  return (
    <div
      data-testid={`policy-row-${policy.id}`}
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div>
            <h3 className="text-base font-semibold leading-6 text-[var(--color-foreground)]">
              {formatPolicyTiming(policy)}
            </h3>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {formatPolicyAudience(policy.audience)} · {policy.timezone}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
            <span>{formatValidityWindow(policy)}</span>
            <span aria-hidden="true">·</span>
            <span>{generatedSummary}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span
            className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: policy.active
                ? "var(--color-success)"
                : "var(--color-muted)",
              color: policy.active
                ? "var(--color-primary)"
                : "var(--color-muted-foreground)",
            }}
          >
            {policy.active ? "Active" : "Disabled"}
          </span>
          <button
            type="button"
            onClick={onToggle}
            data-testid={`expand-${policy.id}`}
            aria-expanded={isExpanded}
            className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-empty)]"
          >
            {isExpanded ? "Hide schedule" : "Schedule"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={isMutating}
            data-testid={`edit-${policy.id}`}
            className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-empty)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit policy
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={isMutating}
            data-testid={`remove-${policy.id}`}
            className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-transparent bg-white px-3 text-xs font-semibold text-[var(--color-destructive)] transition-colors hover:border-[rgba(200,32,20,0.3)] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>

      {isExpanded && (
        <div
          data-testid={`policy-details-${policy.id}`}
          className="mt-3 border-t border-[var(--color-border)] pt-3"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Generated schedule
              </span>
              <span className="rounded-[var(--radius-pill)] bg-[var(--color-surface-empty)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Read-only
              </span>
            </div>
            <span className="text-[var(--color-muted-foreground)]">
              {generatedSummary}
            </span>
          </div>
          <DerivedRulesPanel
            policyId={policy.id}
            rules={derivedRules}
            periodById={periodById}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: PolicyForm
// ---------------------------------------------------------------------------

interface PolicyFormProps {
  readonly form: PolicyFormState;
  readonly editing: boolean;
  readonly isSaving: boolean;
  readonly validityValid: boolean;
  readonly onChange: (
    next: PolicyFormState | ((prev: PolicyFormState) => PolicyFormState),
  ) => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}

type OffsetUnit = "minutes" | "hours" | "days";

function offsetUnitFactor(unit: OffsetUnit): number {
  switch (unit) {
    case "minutes":
      return 1;
    case "hours":
      return 60;
    case "days":
      return 1440;
  }
}

function getOffsetUnit(minutes: number): OffsetUnit {
  const abs = Math.abs(minutes);
  if (abs > 0 && abs % 60 === 0 && abs <= 48 * 60) return "hours";
  if (abs > 0 && abs % 1440 === 0) return "days";
  if (abs > 0 && abs % 60 === 0) return "hours";
  return "minutes";
}

function getOffsetAmount(minutes: number, unit: OffsetUnit): number {
  return Math.abs(minutes) / offsetUnitFactor(unit);
}

function PolicyForm({
  form,
  editing,
  isSaving,
  validityValid,
  onChange,
  onCancel,
  onSave,
}: PolicyFormProps) {
  // Offset shown to admins as a positive number + before/after toggle.
  const offsetIsBeforeDeadline = form.offsetMinutes <= 0;
  const offsetUnit = getOffsetUnit(form.offsetMinutes);
  const offsetMagnitude = getOffsetAmount(form.offsetMinutes, offsetUnit);

  function applyOffset(
    magnitude: number,
    unit: OffsetUnit,
    beforeDeadline: boolean,
  ) {
    const nextMinutes = magnitude * offsetUnitFactor(unit);
    onChange((prev) => ({
      ...prev,
      offsetMinutes: beforeDeadline ? -nextMinutes : nextMinutes,
    }));
  }

  return (
    <div
      data-testid="policy-form"
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] p-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="policy-kind"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Kind
          </label>
          <select
            id="policy-kind"
            value={form.kind}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                kind: e.target.value as MockReminderPolicy["kind"],
              }))
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="policy-audience"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Audience
          </label>
          <select
            id="policy-audience"
            value={form.audience}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                audience: e.target.value as MockReminderPolicy["audience"],
              }))
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            {AUDIENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 md:col-span-2">
          <label
            htmlFor="policy-offset-minutes"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Send
          </label>
          <div className="grid gap-2 sm:grid-cols-[88px_minmax(120px,1fr)_minmax(168px,1.2fr)]">
            <input
              id="policy-offset-minutes"
              type="number"
              min={0}
              value={offsetMagnitude}
              onChange={(e) => {
                const raw = Number.parseFloat(e.target.value);
                const magnitude = Number.isFinite(raw) && raw >= 0 ? raw : 0;
                applyOffset(magnitude, offsetUnit, offsetIsBeforeDeadline);
              }}
              aria-label="reminder offset amount"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
            <select
              aria-label="reminder offset unit"
              value={offsetUnit}
              onChange={(e) =>
                applyOffset(
                  offsetMagnitude,
                  e.target.value as OffsetUnit,
                  offsetIsBeforeDeadline,
                )
              }
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
            <select
              aria-label="before or after deadline"
              value={offsetIsBeforeDeadline ? "before" : "after"}
              onChange={(e) =>
                applyOffset(
                  offsetMagnitude,
                  offsetUnit,
                  e.target.value === "before",
                )
              }
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            >
              <option value="before">before deadline</option>
              <option value="after">after deadline</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="policy-timezone"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Timezone
          </label>
          <select
            id="policy-timezone"
            value={form.timezone}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, timezone: e.target.value }))
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          >
            {TIMEZONE_OPTIONS.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.zones.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="policy-valid-from"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Valid from
          </label>
          <input
            id="policy-valid-from"
            type="date"
            value={form.validFromIso}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, validFromIso: e.target.value }))
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label
              htmlFor="policy-valid-until"
              className="text-xs font-semibold text-[var(--color-muted-foreground)]"
            >
              Valid until
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
              <input
                type="checkbox"
                checked={form.foreverChecked}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    foreverChecked: e.target.checked,
                    validUntilIso: e.target.checked ? null : prev.todayIso,
                  }))
                }
                aria-label="forever (no end date)"
              />
              <span>forever</span>
            </label>
          </div>
          <input
            id="policy-valid-until"
            type="date"
            value={form.validUntilIso ?? ""}
            disabled={form.foreverChecked}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                validUntilIso: e.target.value || null,
              }))
            }
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[var(--color-muted)] disabled:opacity-50"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) =>
              onChange((prev) => ({ ...prev, active: e.target.checked }))
            }
          />
          <span>Active</span>
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!validityValid && (
            <span
              data-testid="policy-validity-hint"
              className="text-xs text-[var(--color-destructive)]"
            >
              End date must be after start date
            </span>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !validityValid}
            data-testid="policy-save-button"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving…" : editing ? "Save changes" : "Create policy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatPolicyHeadline(policy: MockReminderPolicy): string {
  return `${policy.kind} · ${formatOffset(policy.offsetMinutes)} · ${policy.audience}`;
}

// ---- Icons ----

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
