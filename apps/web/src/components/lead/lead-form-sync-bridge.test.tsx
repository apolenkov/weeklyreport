import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LeadFormSyncBridge } from './lead-form-sync-bridge';
import type { Product, RiskEntry } from './mock-data';

function buildProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'crm',
    name: 'CRM Platform',
    overallStatus: 'on-track',
    stages: [
      { stageName: 'Planning', status: 'on-track', ownership: 'locked', assignee: 'PM' },
      { stageName: 'Dev', status: 'on-track', ownership: 'mine', assignee: 'Platanov A.' },
      { stageName: 'Testing', status: 'on-track', ownership: 'mine', assignee: 'Platanov A.' },
    ],
    ...overrides,
  };
}

type HarnessProps = {
  initialProducts: Product[];
  initialRisks: RiskEntry[];
  readOnly?: boolean;
  onProductsChangeSpy?: (next: Product[]) => void;
  onRisksChangeSpy?: (next: RiskEntry[]) => void;
};

function Harness({
  initialProducts,
  initialRisks,
  readOnly,
  onProductsChangeSpy,
  onRisksChangeSpy,
}: HarnessProps) {
  const [products, setProducts] = useState(initialProducts);
  const [risks, setRisks] = useState(initialRisks);

  return (
    <LeadFormSyncBridge.Provider
      products={products}
      risks={risks}
      readOnly={readOnly}
      onProductsChange={(next) => {
        setProducts(next);
        onProductsChangeSpy?.(next);
      }}
      onRisksChange={(next) => {
        setRisks(next);
        onRisksChangeSpy?.(next);
      }}
    >
      <section>
        <h2>SDLC</h2>
        <LeadFormSyncBridge.Pipeline />
      </section>
      <section>
        <h2>Risks</h2>
        <LeadFormSyncBridge.Risks />
      </section>
    </LeadFormSyncBridge.Provider>
  );
}

describe('LeadFormSyncBridge', () => {
  it('Test 1: renders Pipeline + Risks with the same data passed to the Provider', () => {
    const product = buildProduct();
    const risk: RiskEntry = {
      id: 'r1',
      productId: 'crm',
      productName: 'CRM Platform',
      stageName: 'Dev',
      severity: 'at-risk',
      text: 'pre-existing',
    };

    render(<Harness initialProducts={[product]} initialRisks={[risk]} />);

    // Pipeline rendered with product name (appears in both pipeline header and risk header)
    expect(screen.getAllByText('CRM Platform').length).toBeGreaterThanOrEqual(1);
    // Risk textarea rendered with existing text
    expect(screen.getByDisplayValue('pre-existing')).toBeInTheDocument();
  });

  it('Test 2: clicking stage chip from on-track to at-risk fires onProductsChange AND onRisksChange (auto-add)', async () => {
    const user = userEvent.setup();
    const product = buildProduct();
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();
    const onRisksChangeSpy = vi.fn<(next: RiskEntry[]) => void>();

    render(
      <Harness
        initialProducts={[product]}
        initialRisks={[]}
        onProductsChangeSpy={onProductsChangeSpy}
        onRisksChangeSpy={onRisksChangeSpy}
      />,
    );

    // Open the stage dropdown for Dev (the lead-owned stage)
    const devChip = screen.getByRole('button', { name: 'Dev: on-track' });
    await user.click(devChip);

    // Pick "At Risk"
    const atRiskOption = await screen.findByRole('button', { name: /At Risk/i });
    await user.click(atRiskOption);

    expect(onProductsChangeSpy).toHaveBeenCalled();
    const lastProductsCall = onProductsChangeSpy.mock.calls.at(-1)![0]!;
    const dev = lastProductsCall[0]!.stages.find((s) => s.stageName === 'Dev');
    expect(dev?.status).toBe('at-risk');

    // Auto-created an empty risk row
    expect(onRisksChangeSpy).toHaveBeenCalled();
    const lastRisksCall = onRisksChangeSpy.mock.calls.at(-1)![0]!;
    expect(lastRisksCall).toHaveLength(1);
    expect(lastRisksCall[0]).toMatchObject({
      productId: 'crm',
      stageName: 'Dev',
      severity: 'at-risk',
      text: '',
    });
  });

  it('Test 3: filling text on a risk for an on-track stage opens a confirmation dialog; Confirm updates the stage', async () => {
    const user = userEvent.setup();
    const product = buildProduct();
    const risk: RiskEntry = {
      id: 'r1',
      productId: 'crm',
      productName: 'CRM Platform',
      stageName: 'Dev',
      severity: 'at-risk',
      text: '',
    };
    const onProductsChangeSpy = vi.fn<(next: Product[]) => void>();

    render(
      <Harness
        initialProducts={[product]}
        initialRisks={[risk]}
        onProductsChangeSpy={onProductsChangeSpy}
      />,
    );

    // Type into the risk textarea (transitions empty -> non-empty).
    // Use a single char so userEvent does not continue typing after the
    // confirmation dialog steals focus (the dialog's Skip button focuses
    // automatically on mount, which would otherwise consume subsequent keys).
    const textareas = screen.getAllByRole('textbox');
    const riskTextarea = textareas[0]!;
    await user.type(riskTextarea, 'X');

    // Confirmation dialog appears
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName(/Update stage status/i);

    // Click "Update Stage"
    const confirmBtn = screen.getByRole('button', { name: 'Update Stage' });
    await user.click(confirmBtn);

    // Dialog closed and stage updated to at-risk
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onProductsChangeSpy).toHaveBeenCalled();
    const lastCall = onProductsChangeSpy.mock.calls.at(-1)![0]!;
    const dev = lastCall[0]!.stages.find((s) => s.stageName === 'Dev');
    expect(dev?.status).toBe('at-risk');
  });

  it('Test 4: when readOnly=true, stage chips are disabled and risks textarea is read-only', () => {
    const product = buildProduct();
    const risk: RiskEntry = {
      id: 'r1',
      productId: 'crm',
      productName: 'CRM Platform',
      stageName: 'Dev',
      severity: 'at-risk',
      text: 'existing',
    };

    render(
      <Harness initialProducts={[product]} initialRisks={[risk]} readOnly />,
    );

    // Stage chip is disabled (button cannot be activated)
    const devChip = screen.getByRole('button', { name: 'Dev: on-track' });
    expect(devChip).toBeDisabled();

    // Risk textarea is read-only
    const textarea = screen.getByDisplayValue('existing');
    expect(textarea).toHaveAttribute('readonly');
  });
});
