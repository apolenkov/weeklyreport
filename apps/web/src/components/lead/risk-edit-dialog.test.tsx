/**
 * 35-04 / UFB-014: the Risk dialog uses an OPTIONAL multi-stage selector
 * (`StageMultiSelect`). Options come from `stagesForProduct(productId)`
 * — the lead's StageAssignment rows.
 *
 * UFB-073: in create mode all owned stages are pre-selected by default.
 * Deselecting all → em-dash sentinel.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { RiskEditDialog } from './risk-edit-dialog';
import type { Product } from './mock-data';

const products: Product[] = [
  {
    id: 'p1',
    name: 'CRM',
    overallStatus: 'on-track',
    stages: [],
  },
];

describe('RiskEditDialog - SDLC stage selector (35-04 / UFB-014)', () => {
  it('pre-selects all owned stages by default in create mode (UFB-073)', () => {
    const onSave = vi.fn();
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ['Dev', 'Testing']}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: 'Vendor delay' },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: 'Slips Q3' },
    });
    fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
      target: { value: 'Escalate' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Risk/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: 'Vendor delay',
      impact: 'Slips Q3',
      mitigation: 'Escalate',
      // UFB-073 + R1: pre-fill saves as stageIds array (not joined CSV).
      stageIds: ['Dev', 'Testing'],
    });
  });

  it('saves with stageName when all required fields including stage are filled', () => {
    const onSave = vi.fn();
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ['Dev', 'Testing']}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: 'Vendor delay' },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: 'Slips Q3' },
    });
    fireEvent.change(screen.getByLabelText(/^Mitigation \*/i), {
      target: { value: 'Escalate' },
    });
    // Both stages are pre-selected (UFB-073). Deselect 'Testing' to keep only 'Dev'.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Testing' }));

    fireEvent.click(screen.getByRole('button', { name: /Save Risk/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      stageIds: ['Dev'],
      text: 'Vendor delay',
      impact: 'Slips Q3',
      mitigation: 'Escalate',
    });
  });

  it('limits stage checkboxes to stages returned by stagesForProduct', () => {
    render(
      <RiskEditDialog
        open
        risk={null}
        products={products}
        onSave={() => undefined}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={() => ['Testing', 'Support']}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    const labels = checkboxes.map((cb) => cb.parentElement?.textContent?.trim());
    expect(labels).toEqual(['Testing', 'Support']);
  });
});

/**
 * A13/A15 regression: typed text AND selected severity must survive parent
 * re-renders that pass a new stagesForProduct function reference
 * (autosave → React Query invalidate cycle).
 *
 * Before fix: useEffect has stagesForProduct in deps → fires on new ref →
 *             setText('') and setSeverity('at-risk') wipe user input.
 * After fix:  stagesForProduct removed from deps → state preserved.
 */
describe('RiskEditDialog — A13/A15 form-race regression', () => {
  it('preserves typed text when parent re-renders with a new stagesForProduct ref', () => {
    const onSave = vi.fn();
    const stagesV1 = () => ['Dev', 'Testing'] as const;

    const { rerender } = render(
      <RiskEditDialog
        open={true}
        risk={null}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={stagesV1}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Risk \*/i), {
      target: { value: 'user typed this — must survive' },
    });
    expect(screen.getByLabelText(/^Risk \*/i)).toHaveValue('user typed this — must survive');

    const stagesV2 = () => ['Dev', 'Testing'] as const;
    rerender(
      <RiskEditDialog
        open={true}
        risk={null}
        products={products}
        onSave={onSave}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={stagesV2}
      />,
    );

    // A13 bug: before fix, text was wiped back to '' by useEffect firing on
    // the new stagesForProduct reference.
    expect(screen.getByLabelText(/^Risk \*/i)).toHaveValue('user typed this — must survive');
  });

  it('preserves selected Blocked severity when parent re-renders with a new stagesForProduct ref', () => {
    const stagesV1 = () => ['Dev'] as const;

    const { rerender } = render(
      <RiskEditDialog
        open={true}
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={stagesV1}
      />,
    );

    // Select "✕ Blocked" severity (the user calls this "Blocker" — A15)
    fireEvent.click(screen.getByRole('button', { name: /Blocked/i }));
    expect(screen.getByRole('button', { name: /Blocked/i })).toHaveAttribute('aria-pressed', 'true');

    const stagesV2 = () => ['Dev'] as const;
    rerender(
      <RiskEditDialog
        open={true}
        risk={null}
        products={products}
        onSave={vi.fn()}
        onCancel={() => undefined}
        defaultProductId="p1"
        stagesForProduct={stagesV2}
      />,
    );

    // A15 bug: before fix, severity was reset to 'at-risk' by the same useEffect.
    expect(screen.getByRole('button', { name: /Blocked/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
