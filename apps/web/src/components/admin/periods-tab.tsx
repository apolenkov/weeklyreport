'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { invalidateAdmin } from '../../lib/cache-keys';
import { toReportPeriodInput } from '../../lib/mappers';
import { useTRPC } from '../../lib/trpc-context';

import type { MockPeriod, PeriodStatus } from './mock-data';

type PeriodFormData = {
  weekLabel: string;
  startDate: string;
  endDate: string;
  deadline: string;
};

const EMPTY_FORM: PeriodFormData = { weekLabel: '', startDate: '', endDate: '', deadline: '' };

type PeriodsTabProps = {
  readonly periods: MockPeriod[];
};

/**
 * Periods Tab.
 *
 * Backend gap (deferred): the admin tRPC router exposes `savePeriod` (upsert)
 * but no `deletePeriod`. The UI therefore supports add + edit only.
 */
export function PeriodsTab({ periods }: PeriodsTabProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [editingPeriod, setEditingPeriod] = useState<MockPeriod | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<PeriodFormData>(EMPTY_FORM);

  const savePeriodMut = useMutation(
    trpc.admin.savePeriod.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success('Period saved');
        setShowDialog(false);
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to save period');
      },
    }),
  );

  function openAdd() {
    setEditingPeriod(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  }

  function openEdit(period: MockPeriod) {
    setEditingPeriod(period);
    setForm({
      weekLabel: period.weekLabel,
      startDate: period.startDate,
      endDate: period.endDate,
      deadline: period.deadline,
    });
    setShowDialog(true);
  }

  function handleSave() {
    // mock 'open'|'reopened' both map to 'draft' on the API side; 'published'
    // is preserved so editing a published period does not silently demote it.
    const apiStatus: 'draft' | 'published' =
      editingPeriod?.status === 'published' ? 'published' : 'draft';
    savePeriodMut.mutate(
      toReportPeriodInput(
        {
          startDate: form.startDate,
          endDate: form.endDate,
          deadline: form.deadline,
          status: apiStatus,
        },
        editingPeriod?.id,
      ),
    );
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const isSaving = savePeriodMut.isPending;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {periods.length} periods
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="btn-press inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            aria-label="Create new period"
          >
            <PlusIcon />
            Create Period
          </button>
        </div>

        {/* Periods table */}
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">Week</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">Start</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">End</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">Deadline</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--color-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr
                  key={period.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[#f8f6f2]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
                    {period.weekLabel}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {formatDate(period.startDate)}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {formatDate(period.endDate)}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {formatDate(period.deadline)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={period.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(period)}
                      className="btn-press rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
                      aria-label={`Edit ${period.weekLabel}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={editingPeriod ? 'Edit period' : 'Create period'}
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              {editingPeriod ? 'Edit Period' : 'Create Period'}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="period-label" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
                  Week Label
                </label>
                <input
                  id="period-label"
                  type="text"
                  value={form.weekLabel}
                  onChange={(e) => setForm({ ...form, weekLabel: e.target.value })}
                  placeholder="e.g., Week 18"
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="period-start" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
                    Start Date
                  </label>
                  <input
                    id="period-start"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                  />
                </div>
                <div>
                  <label htmlFor="period-end" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
                    End Date
                  </label>
                  <input
                    id="period-end"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="period-deadline" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
                  Deadline
                </label>
                <input
                  id="period-deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                disabled={isSaving}
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : editingPeriod ? 'Save Changes' : 'Create Period'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- Helper components ----

function StatusBadge({ status }: { readonly status: PeriodStatus }) {
  const styles: Record<PeriodStatus, { bg: string; text: string }> = {
    open: { bg: 'var(--color-success)', text: 'var(--color-primary)' },
    published: { bg: '#e8e0f0', text: '#6b21a8' },
    reopened: { bg: '#fef3c7', text: '#92400e' },
  };
  const s = styles[status];

  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold capitalize"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {status}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
