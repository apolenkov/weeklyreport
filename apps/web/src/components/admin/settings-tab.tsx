'use client';

import { useState } from 'react';

import type { MockSettings } from './mock-data';
import { MOCK_SETTINGS } from './mock-data';

export function SettingsTab() {
  const [settings, setSettings] = useState<MockSettings>(MOCK_SETTINGS);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-muted-foreground)]">
        General department settings for CustomReport
      </p>

      <div className="max-w-lg space-y-5">
        {/* Department Name */}
        <div>
          <label htmlFor="dept-name" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
            Department Name
          </label>
          <input
            id="dept-name"
            type="text"
            value={settings.departmentName}
            onChange={(e) => setSettings({ ...settings, departmentName: e.target.value })}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Displayed in report headers and navigation
          </p>
        </div>

        {/* Auto-create Periods */}
        <div className="flex items-start justify-between gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-5 py-4">
          <div>
            <span className="text-sm font-medium text-[var(--color-foreground)]">
              Auto-create Periods
            </span>
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              Automatically create new weekly reporting periods based on the calendar
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoCreatePeriods}
            aria-label="Toggle auto-create periods"
            onClick={() =>
              setSettings({ ...settings, autoCreatePeriods: !settings.autoCreatePeriods })
            }
            className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: settings.autoCreatePeriods
                ? 'var(--color-starbucks-accent)'
                : 'var(--color-border)',
            }}
          >
            <span
              className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{
                transform: settings.autoCreatePeriods ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>

        {/* Default Deadline Days */}
        <div>
          <label htmlFor="deadline-days" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
            Default Deadline (days from period start)
          </label>
          <input
            id="deadline-days"
            type="number"
            min={1}
            max={7}
            value={settings.defaultDeadlineDays}
            onChange={(e) =>
              setSettings({ ...settings, defaultDeadlineDays: parseInt(e.target.value, 10) || 5 })
            }
            className="w-32 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Number of days after period start when submissions are due (1-7)
          </p>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="btn-press inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            aria-label="Save settings"
          >
            Save Settings
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
              <CheckIcon />
              Settings saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
