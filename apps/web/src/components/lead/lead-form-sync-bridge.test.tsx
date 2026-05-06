import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LeadFormSyncBridge } from './lead-form-sync-bridge';
import type { Product, RiskEntry } from './mock-data';
import { expectDefined } from '../../test/expect-defined.js';

function buildProduct(overrides?: Partial<Product>): Product {
  return {
    id: 'crm',
    name: 'CRM Platform',
    overallStatus: 'on-track',
    stages: [
      { stageName: 'Planning', status: 'on-track', ownership: 'locked', assignee: 'PM' },
      { stageName: 'Dev', status: 'on-track', ownership: 'mine', assignee: 'Polenkov A.' },
      { stageName: 'Testing', status: 'on-track', ownership: 'mine', assignee: 'Polenkov A.' },
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
      impact: '',
      mitigation: '',
    };

    render(<Harness initialProducts={[product]} initialRisks={[risk]} />);

    // Pipeline rendered with product name (appears in both pipeline header and risk card)
    expect(screen.getAllByText('CRM Platform').length).toBeGreaterThanOrEqual(1);
    // Risk preview card surfaces the risk text (no inline textarea anymore — Phase 22+ moved
    // editing into RiskEditDialog; the main UI shows a read-only preview).
    expect(screen.getByText('pre-existing')).toBeInTheDocument();
  });

  it('Test 2: clicking stage chip from on-track to at-risk fires onProductsChange (status sync via popover)', async () => {
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

    // Open the stage popover for Dev (lead-owned, currently on-track)
    const devChip = screen.getByRole('button', { name: 'Dev: on-track' });
    await user.click(devChip);

    // Pick "At Risk" from the popover (rendered as role="menuitem", not button)
    const atRiskOption = await screen.findByRole('menuitem', { name: /At Risk/i });
    await user.click(atRiskOption);

    expect(onProductsChangeSpy).toHaveBeenCalled();
    const lastProductsCall = expectDefined(expectDefined(onProductsChangeSpy.mock.calls.at(-1))[0]);
    const dev = expectDefined(lastProductsCall[0]).stages.find((s) => s.stageName === 'Dev');
    expect(dev?.status).toBe('at-risk');
  });

  it('Test 3: clicking Edit on a risk opens the RiskEditDialog (edit surface for impact/mitigation)', async () => {
    const user = userEvent.setup();
    const product = buildProduct();
    const risk: RiskEntry = {
      id: 'r1',
      productId: 'crm',
      productName: 'CRM Platform',
      stageName: 'Dev',
      severity: 'at-risk',
      text: 'OAuth delay',
      impact: '',
      mitigation: '',
    };

    render(<Harness initialProducts={[product]} initialRisks={[risk]} />);

    // Click the Edit (pencil) button on the risk card → opens RiskEditDialog
    const editBtn = screen.getByRole('button', { name: /Edit risk for CRM Platform/i });
    await user.click(editBtn);

    // Dialog renders with the existing risk text in a textbox (Phase 22+ moved
    // editing here so impact/mitigation can be validated together).
    const textbox = await screen.findByDisplayValue('OAuth delay');
    expect(textbox).toBeInTheDocument();
  });

  it('Test 4: when readOnly=true, stage chips are disabled and risks render as preview cards without edit/add controls', () => {
    const product = buildProduct();
    const risk: RiskEntry = {
      id: 'r1',
      productId: 'crm',
      productName: 'CRM Platform',
      stageName: 'Dev',
      severity: 'at-risk',
      text: 'existing',
      impact: '',
      mitigation: '',
    };

    render(
      <Harness initialProducts={[product]} initialRisks={[risk]} readOnly />,
    );

    // Stage chip is disabled (popover cannot open).
    const devChip = screen.getByRole('button', { name: 'Dev: on-track' });
    expect(devChip).toBeDisabled();

    // Risk text rendered as plain preview, not a form control.
    expect(screen.getByText('existing')).toBeInTheDocument();

    // Edit / Delete / + Add Risk controls are hidden in read-only mode.
    expect(screen.queryByRole('button', { name: /Edit risk/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete risk/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Add Risk/i })).not.toBeInTheDocument();
  });
});
