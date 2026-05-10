"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/cache-keys";
import { toReminderPolicyInput } from "../../lib/mappers";
import type { AdminReminderPolicyFormInput } from "../../lib/mappers";
import { useTRPC } from "../../lib/trpc-context";
import { ConfirmDeleteDialog } from "../lead/confirm-delete-dialog";

import { TabHeader, TabSearch } from "./tab-header";
import { DerivedRulesPanel } from "./derived-rules-panel";
// UFB-035: timezone catalog moved to ./timezone-options so the Settings →
// Reminders sub-tab (UFB-048 / Phase 48-B) can reuse the same curated list.
import { TIMEZONE_OPTIONS } from "./timezone-options";

import type {
  MockPeriod,
  MockReminder,
  MockReminderPolicy,
} from "./mock-data";

const KIND_OPTIONS: ReadonlyArray<{
  value: MockReminderPolicy["kind"];
  label: string;
}> = [
  { value: "deadline", label: "Deadline reminder" },
  { value: "follow_up", label: "Follow-up reminder" },
  { value: "escalation", label: "Escalation digest" },
];

const AUDIENCE_OPTIONS: ReadonlyArray<{
  value: MockReminderPolicy["audience"];
  label: string;
}> = [
  { value: "lead-with-draft", label: "Leads with draft" },
  { value: "head-of-late", label: "Head of late leads" },
];

type RemindersTabProps = {
  /** UFB-036 (Phase 44-04): policies are the new top-level editable rows. */
  readonly policies: ReadonlyArray<MockReminderPolicy>;
  /**
   * Read-only derived rules grouped by `policyId`. The Reminders Tab's
   * expander surfaces them under each policy. Rules whose `policyId`
   * is `null` (legacy, pre-44-01) are NOT surfaced here — they still
   * exist in the DB but live outside the policy model.
   */
  readonly derivedRulesByPolicyId: Readonly<
    Record<string, ReadonlyArray<MockReminder>>
  >;
  /** Used by the derived-rules panel to render period labels. */
  readonly periods: ReadonlyArray<MockPeriod>;
  /**
   * UFB-048 (Phase 48-B): organisation-wide defaults for new policies.
   * When the admin opens the «New Policy» form, the timezone and audience
   * controls prefill from these values instead of hardcoded constants.
   * Optional — older callers (and component tests that predate 48-B) get
   * the historical Europe/Moscow + lead-with-draft defaults.
   */
  readonly defaultTimezone?: string;
  readonly defaultAudience?: MockReminderPolicy["audience"];
};

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

function formatValidityWindow(policy: MockReminderPolicy): string {
  const from = isoFromDate(policy.validFrom);
  if (policy.validUntil === null) {
    return `since ${from} · forever`;
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
  const [pendingDelete, setPendingDelete] =
    useState<MockReminderPolicy | null>(null);

  const periodById = useMemo(
    () => new Map(periods.map((p) => [p.id, p] as const)),
    [periods],
  );

  const saveMut = useMutation(
    trpc.admin.savePolicy.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success(
          editingId ? "Policy updated" : "Policy created",
        );
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
            className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]"
          >
            {policies.length === 0
              ? "No active reminder policies. Create one to start sending reminders."
              : "No reminder policies match the search."}
          </div>
        )}

        {filteredPolicies.length > 0 && (
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-empty)] text-left text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="px-4 py-3">Kind</th>
                  <th className="px-4 py-3">Offset</th>
                  <th className="px-4 py-3">Timezone</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3">Validity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPolicies.map((policy) => {
                  const derivedRules =
                    derivedRulesByPolicyId[policy.id] ?? [];
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
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Remove reminder policy?"
        preview={pendingDelete ? formatPolicyHeadline(pendingDelete) : ""}
        subtitle={
          pendingDelete
            ? formatValidityWindow(pendingDelete)
            : undefined
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

type PolicyRowProps = {
  readonly policy: MockReminderPolicy;
  readonly derivedCount: number;
  readonly isExpanded: boolean;
  readonly isMutating: boolean;
  readonly derivedRules: ReadonlyArray<MockReminder>;
  readonly periodById: ReadonlyMap<string, MockPeriod>;
  readonly onToggle: () => void;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
};

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
  return (
    <>
      <tr
        data-testid={`policy-row-${policy.id}`}
        className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-empty)]"
      >
        <td className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
          {policy.kind}
        </td>
        <td className="px-4 py-3 font-mono text-xs">
          {formatOffset(policy.offsetMinutes)}
        </td>
        <td className="px-4 py-3 text-xs">{policy.timezone}</td>
        <td className="px-4 py-3 text-xs">{policy.audience}</td>
        <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
          {formatValidityWindow(policy)}
        </td>
        <td className="px-4 py-3">
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
        </td>
        <td className="px-4 py-3 text-right">
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              data-testid={`expand-${policy.id}`}
              aria-expanded={isExpanded}
              className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-empty)]"
            >
              {isExpanded ? "Hide" : "Show"} rules ({derivedCount})
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={isMutating}
              data-testid={`edit-${policy.id}`}
              className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-empty)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={isMutating}
              data-testid={`remove-${policy.id}`}
              className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-destructive)] transition-colors hover:border-[rgba(200,32,20,0.3)] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-[var(--color-surface-empty)]">
          <td colSpan={7} className="px-4 py-3">
            <DerivedRulesPanel
              policyId={policy.id}
              rules={derivedRules}
              periodById={periodById}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: PolicyForm
// ---------------------------------------------------------------------------

type PolicyFormProps = {
  readonly form: PolicyFormState;
  readonly editing: boolean;
  readonly isSaving: boolean;
  readonly validityValid: boolean;
  readonly onChange: (
    next: PolicyFormState | ((prev: PolicyFormState) => PolicyFormState),
  ) => void;
  readonly onCancel: () => void;
  readonly onSave: () => void;
};

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
  const offsetMagnitude = Math.abs(form.offsetMinutes);

  return (
    <div
      data-testid="policy-form"
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-empty)] p-4"
    >
      <div className="grid gap-3 md:grid-cols-3">
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
            htmlFor="policy-offset-minutes"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Offset (minutes)
          </label>
          <div className="flex gap-2">
            <input
              id="policy-offset-minutes"
              type="number"
              min={0}
              value={offsetMagnitude}
              onChange={(e) => {
                const raw = Number.parseInt(e.target.value, 10);
                const magnitude = Number.isFinite(raw) && raw >= 0 ? raw : 0;
                onChange((prev) => ({
                  ...prev,
                  offsetMinutes: offsetIsBeforeDeadline
                    ? -magnitude
                    : magnitude,
                }));
              }}
              className="w-24 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            />
            <select
              aria-label="before or after deadline"
              value={offsetIsBeforeDeadline ? "before" : "after"}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  offsetMinutes:
                    e.target.value === "before"
                      ? -Math.abs(prev.offsetMinutes)
                      : Math.abs(prev.offsetMinutes),
                }))
              }
              className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
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
          <label
            htmlFor="policy-valid-until"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Valid until
          </label>
          <div className="flex flex-col gap-1">
            <label className="inline-flex items-center gap-2 text-xs">
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
              <span>forever (no end date)</span>
            </label>
            {!form.foreverChecked && (
              <input
                id="policy-valid-until"
                type="date"
                value={form.validUntilIso ?? ""}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    validUntilIso: e.target.value || null,
                  }))
                }
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
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
        <div className="flex items-center gap-2">
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
