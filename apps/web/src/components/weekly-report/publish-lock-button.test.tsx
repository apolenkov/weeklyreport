import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { PublishLockButton } from './publish-lock-button';

describe('PublishLockButton (Phase 22 — plan 22-05)', () => {
  it('renders "Publish & Lock" when periodStatus is open', () => {
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="open"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /publish & lock/i })).toBeInTheDocument();
  });

  it('renders "Publish & Lock" when periodStatus is reopened', () => {
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="reopened"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /publish & lock/i })).toBeInTheDocument();
  });

  it('renders "Reopen Period" when periodStatus is published', () => {
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="published"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /reopen period/i })).toBeInTheDocument();
  });

  it('opens a confirmation dialog before invoking onPublish', async () => {
    const onPublish = vi.fn();
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="open"
        onPublish={onPublish}
        onReopen={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /publish & lock/i }));
    // Dialog opens — only the dialog confirm button calls onPublish
    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /confirm publish/i })).toBeInTheDocument();

    // Cancel does NOT call onPublish
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('confirming the dialog calls onPublish exactly once', async () => {
    const onPublish = vi.fn();
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="open"
        onPublish={onPublish}
        onReopen={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /publish & lock/i }));
    // Pick the dialog's confirm action — the only button labeled exactly "Publish & Lock"
    // inside the dialog (when pendingCount === 0).
    const dialog = screen.getByRole('dialog', { name: /confirm publish/i });
    const confirmBtn = dialog.querySelectorAll('button');
    // Last button in dialog footer is the confirm one (label varies on pendingCount)
    await userEvent.click(confirmBtn[confirmBtn.length - 1]!);
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('shows pending-leads warning copy when pendingCount > 0', async () => {
    render(
      <PublishLockButton
        pendingCount={2}
        totalLeads={6}
        periodStatus="open"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /publish & lock/i }));
    expect(screen.getByText(/2 of 6 leads/i)).toBeInTheDocument();
  });

  it('clicking "Reopen Period" calls onReopen directly (no confirmation)', async () => {
    const onReopen = vi.fn();
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="published"
        onPublish={vi.fn()}
        onReopen={onReopen}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /reopen period/i }));
    expect(onReopen).toHaveBeenCalledTimes(1);
  });

  it('disables the trigger button while isPending=true', () => {
    render(
      <PublishLockButton
        pendingCount={0}
        totalLeads={6}
        periodStatus="open"
        onPublish={vi.fn()}
        onReopen={vi.fn()}
        isPending
      />,
    );
    expect(screen.getByRole('button', { name: /publish & lock/i })).toBeDisabled();
  });
});
