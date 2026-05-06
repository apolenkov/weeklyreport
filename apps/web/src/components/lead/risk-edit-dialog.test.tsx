/**
 * 35-04 (FEAT-144): the Risk dialog must require an SDLC stage selection
 * before Save fires. Options come from `stagesForProduct(productId)` —
 * the lead's StageAssignment rows for the active project.
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

describe('RiskEditDialog - SDLC stage selector (35-04 / FEAT-144)', () => {
  it('blocks Save when stage is not selected even if other fields are filled', () => {
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

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/SDLC stage is required/i)).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText(/Стадия SDLC/i), {
      target: { value: 'Dev' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Risk/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      stageName: 'Dev',
      text: 'Vendor delay',
      impact: 'Slips Q3',
      mitigation: 'Escalate',
    });
  });

  it('limits the stage dropdown options to stages returned by stagesForProduct', () => {
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

    const select = screen.getByLabelText(/Стадия SDLC/i) as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    // First entry is the empty placeholder.
    expect(options).toEqual(['', 'Testing', 'Support']);
  });
});
