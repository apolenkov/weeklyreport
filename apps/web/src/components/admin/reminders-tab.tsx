"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/cache-keys";
import { toReminderPolicyInput } from "../../lib/mappers";
import { useTRPC } from "../../lib/trpc-context";
import { ConfirmDeleteDialog } from "../lead/confirm-delete-dialog";
import type { MockPeriod, MockReminder, MockReminderPolicy } from "./mock-data";
import { PlusIcon, PolicyForm } from "./policy-form";
import { PolicyRow } from "./policy-row";
import { RemindersEmptyState } from "./reminders-empty-state";
import {
  emptyPolicyForm,
  type PolicyFormState,
  policyToForm,
} from "./reminders-form-state";
import {
  formatOffset,
  formatPolicyAudience,
  formatPolicyHeadline,
  formatPolicyTiming,
  formatValidityWindow,
} from "./reminders-tab-format";
import { TabHeader, TabSearch } from "./tab-header";

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
          <RemindersEmptyState
            hasNoPolicies={policies.length === 0}
            onCreate={handleNewPolicy}
          />
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
