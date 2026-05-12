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
