"use client";

import {
  type AppSettings,
  appSettingsUpdateSchema,
} from "@weeklyreport/shared";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";

// Same 0..168 (one week) bound used for grace-period hours.
const REOPEN_WINDOW_HOURS_MIN = 0;
const REOPEN_WINDOW_HOURS_MAX = 168;
const REOPEN_WINDOW_FIELD_ID = "reopen-window-hours";

const FIELD_INPUT_CLASS =
  "w-40 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]";
const FIELD_LABEL_CLASS =
  "mb-1 block text-sm font-medium text-[var(--color-foreground)]";
const FIELD_HINT_CLASS = "mt-1 text-xs text-[var(--color-muted-foreground)]";
const FIELD_ERROR_CLASS = "mt-1 text-xs text-[var(--color-destructive)]";

interface DraftFieldProps {
  readonly draft: AppSettings;
  readonly setDraft: Dispatch<SetStateAction<AppSettings>>;
  readonly onValidityChange?: (id: string, valid: boolean) => void;
}

interface AcceptedServerSeedProps {
  readonly acceptedServerSeed: AppSettings | null;
  readonly saveAcknowledgement: {
    readonly sequence: number;
    readonly reopenWindowHours: number;
  } | null;
}

function parseReopenWindow(text: string): number | null {
  const parsed = /^\d+$/.test(text.trim())
    ? Number.parseInt(text.trim(), 10)
    : null;
  return parsed !== null &&
    parsed >= REOPEN_WINDOW_HOURS_MIN &&
    parsed <= REOPEN_WINDOW_HOURS_MAX
    ? parsed
    : null;
}

function useReopenWindowState({
  draft,
  setDraft,
  onValidityChange,
  acceptedServerSeed,
  saveAcknowledgement,
}: DraftFieldProps & AcceptedServerSeedProps) {
  const [raw, setRaw] = useState(() => String(draft.reopenWindowHours));
  const [error, setError] = useState<string | null>(null);
  const [committedValue, setCommittedValue] = useState(draft.reopenWindowHours);
  const acceptedServerSeedRef = useRef(acceptedServerSeed);
  const saveAcknowledgementRef = useRef(saveAcknowledgement);

  useEffect(() => {
    if (
      acceptedServerSeed === null ||
      acceptedServerSeedRef.current === acceptedServerSeed
    ) {
      return;
    }
    acceptedServerSeedRef.current = acceptedServerSeed;
    setCommittedValue(acceptedServerSeed.reopenWindowHours);
    setRaw(String(acceptedServerSeed.reopenWindowHours));
    setError(null);
  }, [acceptedServerSeed]);

  useEffect(() => {
    if (
      saveAcknowledgement === null ||
      saveAcknowledgementRef.current === saveAcknowledgement
    ) {
      return;
    }
    saveAcknowledgementRef.current = saveAcknowledgement;
    setCommittedValue(saveAcknowledgement.reopenWindowHours);
    setRaw(String(saveAcknowledgement.reopenWindowHours));
    setError(null);
  }, [saveAcknowledgement]);

  if (committedValue !== draft.reopenWindowHours) {
    setCommittedValue(draft.reopenWindowHours);
    setRaw(String(draft.reopenWindowHours));
    setError(null);
  }

  function handleChange(text: string) {
    setRaw(text);
    const parsed = parseReopenWindow(text);
    if (parsed === null) {
      // Invalid raw text is still an unsaved edit; keep server reseeds suspended.
      setDraft((current) => current);
      setError(
        `Whole number between ${REOPEN_WINDOW_HOURS_MIN} and ${REOPEN_WINDOW_HOURS_MAX} required`,
      );
      onValidityChange?.(REOPEN_WINDOW_FIELD_ID, false);
      return;
    }
    setError(null);
    onValidityChange?.(REOPEN_WINDOW_FIELD_ID, true);
    setDraft((current) => ({ ...current, reopenWindowHours: parsed }));
  }

  return { raw, error, handleChange };
}

function DeadlineTimeField({
  draft,
  setDraft,
  onValidityChange,
}: DraftFieldProps) {
  const [raw, setRaw] = useState(draft.deadlineTime);
  const [committedValue, setCommittedValue] = useState(draft.deadlineTime);
  const [error, setError] = useState<string | null>(null);
  if (committedValue !== draft.deadlineTime) {
    setCommittedValue(draft.deadlineTime);
    setRaw(draft.deadlineTime);
    setError(null);
  }
  function handleChange(value: string) {
    setRaw(value);
    const valid = appSettingsUpdateSchema.safeParse({
      deadlineTime: value,
    }).success;
    onValidityChange?.("deadline-time", valid);
    if (!valid) {
      setDraft((current) => current);
      setError("Enter a valid time in HH:MM format.");
      return;
    }
    setError(null);
    setDraft((current) => ({ ...current, deadlineTime: value }));
  }
  return (
    <div>
      <label htmlFor="deadline-time" className={FIELD_LABEL_CLASS}>
        Deadline time
      </label>
      <input
        id="deadline-time"
        name="deadline-time"
        type="time"
        autoComplete="off"
        step={60}
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        aria-invalid={error !== null}
        aria-describedby={`deadline-time-hint${error ? " deadline-time-error" : ""}`}
        className={FIELD_INPUT_CLASS}
      />
      <p id="deadline-time-hint" className={FIELD_HINT_CLASS}>
        Used for manually created and scheduled auto-created periods, with HH:MM
        minute precision in the default timezone (Reminders tab).
      </p>
      {error && (
        <p id="deadline-time-error" role="alert" className={FIELD_ERROR_CLASS}>
          {error}
        </p>
      )}
    </div>
  );
}

function AllowReopenField({
  draft,
  setDraft,
  onValidityChange,
  reopenWindowValid,
}: DraftFieldProps & { readonly reopenWindowValid: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm text-[var(--color-foreground)]">
      <input
        name="allow-reopen-after-publish"
        type="checkbox"
        checked={draft.allowReopenAfterPublish}
        onChange={(e) => {
          const enabled = e.target.checked;
          onValidityChange?.(
            REOPEN_WINDOW_FIELD_ID,
            enabled ? reopenWindowValid : true,
          );
          setDraft((current) => ({
            ...current,
            allowReopenAfterPublish: enabled,
          }));
        }}
        className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-starbucks-accent)]"
      />
      <span>
        <span className="block font-medium">Allow reopen after publish</span>
        <span className="block text-xs text-[var(--color-muted-foreground)]">
          Lets the head reopen a published period for late corrections. When
          off, the reopen request is rejected.
        </span>
      </span>
    </label>
  );
}

// Keeps the raw draft text and commits only a parsed in-bounds integer; invalid
// input surfaces an inline error instead of silently becoming 0 (no-fallback).
function ReopenWindowField({
  draft,
  state,
}: {
  readonly draft: AppSettings;
  readonly state: ReturnType<typeof useReopenWindowState>;
}) {
  const { raw, error, handleChange } = state;
  return (
    <div
      className={
        draft.allowReopenAfterPublish ? "" : "pointer-events-none opacity-60"
      }
    >
      <label htmlFor="reopen-window-hours" className={FIELD_LABEL_CLASS}>
        Reopen window (hours)
      </label>
      <input
        id={REOPEN_WINDOW_FIELD_ID}
        name={REOPEN_WINDOW_FIELD_ID}
        type="number"
        inputMode="numeric"
        min={REOPEN_WINDOW_HOURS_MIN}
        max={REOPEN_WINDOW_HOURS_MAX}
        disabled={!draft.allowReopenAfterPublish}
        aria-invalid={draft.allowReopenAfterPublish && error !== null}
        aria-describedby={
          draft.allowReopenAfterPublish && error
            ? `${REOPEN_WINDOW_FIELD_ID}-error`
            : undefined
        }
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        className={`${FIELD_INPUT_CLASS} disabled:cursor-not-allowed`}
      />
      {!draft.allowReopenAfterPublish || error === null ? (
        <p className={FIELD_HINT_CLASS}>
          How long after publish a period can still be reopened. 0..168 (one
          week). Greyed out when «allow reopen» is off.
        </p>
      ) : (
        <p
          id={`${REOPEN_WINDOW_FIELD_ID}-error`}
          className={FIELD_ERROR_CLASS}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// Live consumers: deadlineTime (manual and scheduled period creation),
// allowReopenAfterPublish + reopenWindowHours (period.service reopen gate).
export function PeriodCycleFields({
  draft,
  setDraft,
  onValidityChange,
  acceptedServerSeed,
  saveAcknowledgement,
}: DraftFieldProps & AcceptedServerSeedProps) {
  const reopenWindowState = useReopenWindowState({
    draft,
    setDraft,
    acceptedServerSeed,
    saveAcknowledgement,
    ...(onValidityChange === undefined ? {} : { onValidityChange }),
  });

  return (
    <>
      <DeadlineTimeField
        draft={draft}
        setDraft={setDraft}
        {...(onValidityChange === undefined ? {} : { onValidityChange })}
      />
      <AllowReopenField
        draft={draft}
        setDraft={setDraft}
        reopenWindowValid={reopenWindowState.error === null}
        {...(onValidityChange === undefined ? {} : { onValidityChange })}
      />
      <ReopenWindowField draft={draft} state={reopenWindowState} />
    </>
  );
}
