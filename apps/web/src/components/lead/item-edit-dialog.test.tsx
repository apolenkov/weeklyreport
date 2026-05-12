/**
 * A13 regression: typed text must survive parent re-renders that pass a new
 * stagesForProduct function reference (autosave → React Query invalidate cycle).
 *
 * Before fix: useEffect has stagesForProduct in deps → fires on new ref →
 *             setText(initial.text) wipes user input.
 * After fix:  stagesForProduct removed from deps → text preserved.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ItemEditDialog } from './item-edit-dialog';
import type { Product } from './mock-data';

const products: Product[] = [
  { id: 'p1', name: 'DevOps Tools', overallStatus: 'on-track', stages: [] },
];

describe('ItemEditDialog — A13 form-race regression', () => {
  it('preserves typed text when parent re-renders with a new stagesForProduct ref', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const stagesV1 = () => ['Dev', 'Testing'] as const;

    const { rerender } = render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={stagesV1}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    const textField = screen.getByLabelText(/Description \*/i);
    fireEvent.change(textField, { target: { value: 'user typed this — must survive' } });
    expect(textField).toHaveValue('user typed this — must survive');

    // Simulate autosave parent re-render: new function reference, same return value.
    const stagesV2 = () => ['Dev', 'Testing'] as const;
    rerender(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={stagesV2}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    // A13 bug: before fix, text was wiped back to '' by useEffect firing on
    // the new stagesForProduct reference.
    expect(textField).toHaveValue('user typed this — must survive');
  });
});
