'use client';

import { useState } from 'react';

import type { MockReminder } from './mock-data';
import { MOCK_REMINDERS } from './mock-data';

export function RemindersTab() {
  const [reminders, setReminders] = useState<MockReminder[]>(MOCK_REMINDERS);
  const [sendingId, setSendingId] = useState<string | null>(null);

  function handleToggle(id: string) {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
    );
  }

  function handleSendNow(id: string) {
    setSendingId(id);
    // Simulate send delay
    setTimeout(() => setSendingId(null), 1500);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Configure automatic email reminders for report submissions
      </p>

      <div className="space-y-3">
        {reminders.map((reminder) => (
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
                onClick={() => handleToggle(reminder.id)}
                className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200"
                style={{
                  backgroundColor: reminder.active ? 'var(--color-starbucks-accent)' : 'var(--color-border)',
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                  style={{
                    transform: reminder.active ? 'translateX(20px)' : 'translateX(0)',
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
                      backgroundColor: reminder.active ? 'var(--color-success)' : 'var(--color-muted)',
                      color: reminder.active ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                    }}
                  >
                    {reminder.active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  {reminder.description}
                </p>
              </div>
            </div>

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
                  Sending...
                </>
              ) : (
                <>
                  <SendIcon />
                  Send Now
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Icons ----

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
    </svg>
  );
}
