'use client';

import type { MockProduct, MockUser, StageName } from './mock-data';
import { STAGE_NAMES } from './mock-data';

type StageAssignmentEditorProps = {
  readonly product: MockProduct;
  readonly leads: MockUser[];
  readonly onAssign: (productId: string, stage: StageName, userId: string | null) => void;
};

const STAGE_COLORS: Record<StageName, string> = {
  Planning: 'var(--color-starbucks-green)',
  Analysis: 'var(--color-starbucks-accent)',
  Design: 'var(--color-starbucks-gold)',
  Development: 'var(--color-primary)',
  Testing: 'var(--color-destructive)',
  DevOps: '#6366f1',
  Support: 'var(--color-muted-foreground)',
};

export function StageAssignmentEditor({ product, leads, onAssign }: StageAssignmentEditorProps) {
  return (
    <div className="mt-3 grid grid-cols-7 gap-2">
      {STAGE_NAMES.map((stage) => {
        const assignment = product.stages.find((s) => s.stage === stage);
        const currentAssignee = assignment?.assigneeId ?? '';

        return (
          <div key={stage} className="space-y-1">
            <label
              htmlFor={`${product.id}-${stage}`}
              className="block text-center text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: STAGE_COLORS[stage] }}
            >
              {stage}
            </label>
            <select
              id={`${product.id}-${stage}`}
              value={currentAssignee}
              onChange={(e) => onAssign(product.id, stage, e.target.value || null)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-1.5 py-1.5 text-xs text-[var(--color-foreground)] transition-colors focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
              aria-label={`Assign ${stage} stage for ${product.name}`}
            >
              <option value="">Unassigned</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.name.split(' ')[0]}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
