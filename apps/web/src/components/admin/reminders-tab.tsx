"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAdmin } from "../../lib/cache-keys";
import { toAdminReminderRuleInput } from "../../lib/mappers";
import { useTRPC } from "../../lib/trpc-context";
import { ConfirmDeleteDialog } from "../lead/confirm-delete-dialog";

import type { MockPeriod, MockReminder } from "./mock-data";

type RemindersTabProps = {
  readonly reminders: MockReminder[];
  readonly periods: MockPeriod[];
};

type RuleForm = {
  kind: "deadline" | "follow_up" | "escalation";
  reportId: string;
  fireAt: string;
  timezone: string;
};

export function RemindersTab({ reminders, periods }: RemindersTabProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [sendingId, setSendingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MockReminder | null>(null);
  const [search, setSearch] = useState("");
  const [showRuleForm, setShowRuleForm] = useState(reminders.length === 0);
  const [form, setForm] = useState<RuleForm>(() => ({
    kind: "deadline",
    reportId: periods[0]?.id ?? "",
    fireAt: toDateTimeLocal(new Date()),
    timezone: "Europe/Moscow",
  }));

  const saveRuleMut = useMutation(
    trpc.admin.saveReminderRule.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Reminder updated");
        setShowRuleForm(false);
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to update reminder");
      },
    }),
  );

  const deleteRuleMut = useMutation(
    trpc.admin.deleteReminderRule.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success("Reminder deleted");
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to delete reminder");
      },
    }),
  );

  function handleToggle(reminder: MockReminder) {
    const nextStatus: "active" | "paused" = reminder.active
      ? "paused"
      : "active";
    saveRuleMut.mutate(
      toAdminReminderRuleInput(
        {
          kind: reminder.kind,
          fireAt: reminder.fireAt,
          timezone: reminder.timezone,
          status: nextStatus,
          reportId: reminder.reportId,
          version: reminder.version,
        },
        reminder.id,
      ),
    );
  }

  function handleDelete(reminder: MockReminder) {
    setPendingDelete(reminder);
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    deleteRuleMut.mutate({ ruleId: pendingDelete.id });
    setPendingDelete(null);
  }

  function handleSendNow(id: string) {
    setSendingId(id);
    // Send-now is an admin trigger; no dedicated endpoint exists yet — keep
    // the visual feedback for now and surface a backend gap in SUMMARY.
    setTimeout(() => setSendingId(null), 1500);
  }

  function handleCreateRule() {
    if (!form.reportId) {
      toast.error("Select report period before creating a reminder rule");
      return;
    }
    saveRuleMut.mutate(
      toAdminReminderRuleInput({
        kind: form.kind,
        reportId: form.reportId,
        fireAt: form.fireAt,
        timezone: form.timezone,
        status: "active",
        version: 1,
      }),
    );
  }

  const isMutating = saveRuleMut.isPending || deleteRuleMut.isPending;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredReminders = useMemo(() => {
    if (!normalizedSearch) return reminders;
    return reminders.filter((reminder) =>
      [
        reminder.name,
        reminder.description,
        reminder.kind,
        reminder.timezone,
        reminder.reportId ?? "",
        reminder.active ? "active" : "paused",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [normalizedSearch, reminders]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
            Reminder Rules
          </h2>
          <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
            Create active rules per report period so Dashboard can send
            pending-lead email reminders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRuleForm((value) => !value)}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
        >
          <PlusIcon />
          Add Rule
        </button>
      </div>

      {showRuleForm && (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[#fafaf7] p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label
                htmlFor="reminder-kind"
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
              >
                Type
              </label>
              <select
                id="reminder-kind"
                value={form.kind}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as RuleForm["kind"] })
                }
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                <option value="deadline">Deadline reminder</option>
                <option value="follow_up">Follow-up reminder</option>
                <option value="escalation">Escalation digest</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="reminder-report"
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
              >
                Report period
              </label>
              <select
                id="reminder-report"
                value={form.reportId}
                onChange={(e) => setForm({ ...form, reportId: e.target.value })}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              >
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.weekLabel} · {period.startDate} - {period.endDate}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="reminder-fire-at"
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
              >
                Fire at
              </label>
              <input
                id="reminder-fire-at"
                type="datetime-local"
                value={form.fireAt}
                onChange={(e) => setForm({ ...form, fireAt: e.target.value })}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="reminder-timezone"
                className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
              >
                Timezone
              </label>
              <input
                id="reminder-timezone"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleCreateRule}
              disabled={isMutating || periods.length === 0}
              className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveRuleMut.isPending ? "Saving…" : "Create Active Rule"}
            </button>
          </div>
        </div>
      )}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search reminder rules…"
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        aria-label="Search reminder rules"
      />

      <div className="space-y-3">
        {filteredReminders.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[#fafaf7] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
            {reminders.length === 0
              ? "No reminder rules yet. Add an active rule for the current report period."
              : "No reminder rules match the search."}
          </div>
        )}
        {filteredReminders.map((reminder) => (
          <div
            key={reminder.id}
            className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-5 py-4 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-center gap-4">
              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={reminder.active}
                aria-label={`Toggle ${reminder.name}`}
                onClick={() => handleToggle(reminder)}
                disabled={isMutating}
                className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor: reminder.active
                    ? "var(--color-starbucks-accent)"
                    : "var(--color-border)",
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                  style={{
                    transform: reminder.active
                      ? "translateX(20px)"
                      : "translateX(0)",
                  }}
                />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--color-foreground)]">
                    {reminder.name}
                  </span>
                  <span
                    className="rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: reminder.active
                        ? "var(--color-success)"
                        : "var(--color-muted)",
                      color: reminder.active
                        ? "var(--color-primary)"
                        : "var(--color-muted-foreground)",
                    }}
                  >
                    {reminder.active ? "Active" : "Paused"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {reminder.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSendNow(reminder.id)}
                disabled={sendingId === reminder.id}
                className="btn-press inline-flex min-h-[36px] items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Send ${reminder.name} now`}
              >
                {sendingId === reminder.id ? (
                  <>
                    <SpinnerIcon />
                    Sending…
                  </>
                ) : (
                  <>
                    <SendIcon />
                    Send Now
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(reminder)}
                disabled={isMutating}
                className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-destructive)] transition-colors hover:border-[rgba(200,32,20,0.3)] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Delete ${reminder.name}`}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Delete reminder rule?"
        preview={pendingDelete?.name ?? ""}
        subtitle={
          pendingDelete
            ? formatReminderSchedule(
                pendingDelete.fireAt,
                pendingDelete.timezone,
              )
            : undefined
        }
        consequence="No further emails will be sent for this rule."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function formatReminderSchedule(fireAt: unknown, timezone: string): string {
  const d = fireAt instanceof Date ? fireAt : new Date(String(fireAt));
  if (Number.isNaN(d.getTime())) return timezone;
  const time = d.toISOString().slice(11, 16);
  return `${time} UTC · ${timezone}`;
}

function toDateTimeLocal(value: Date): string {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

// ---- Icons ----

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

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

function SpinnerIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
    </svg>
  );
}
