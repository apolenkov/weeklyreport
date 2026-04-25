'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../lib/trpc-context';
import { invalidateLeadForm } from '../lib/cache-keys';

import type { DraftSavePayload } from '@customreport/shared';

export type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export type AutosaveSnapshot = {
  readonly state: AutosaveState;
  readonly lastSavedAt: Date | null;
  readonly dirty: boolean;
};

export type UseLeadFormAutosaveArgs = {
  readonly reportSectionId: string | null;
  readonly payload: DraftSavePayload | null;
  readonly enabled: boolean;
  readonly debounceMs?: number;
  /**
   * Optional baseline-payload key. When provided, the hook treats this exact
   * key as the last-saved snapshot — so a fresh load from the server is not
   * considered dirty until the user actually edits a field. The caller is
   * responsible for stable serialization (e.g. via the same stringify the
   * hook would produce). When omitted, dirty starts true on first non-null
   * payload (legacy behavior).
   */
  readonly initialSavedKey?: string | null;
};

const DEFAULT_DEBOUNCE_MS = 3000;

/**
 * Stable JSON serialization with sorted keys so payload diffs are deterministic
 * regardless of object construction order. Exported so callers can compute
 * the same baseline key when priming `initialSavedKey`.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]))
      .join(',') +
    '}'
  );
}

/**
 * Debounced autosave hook for the Lead Form.
 *
 * - Triggers `reports.saveDraft` after `debounceMs` of payload stillness.
 * - Coalesces rapid edits into a single mutation call.
 * - Tracks dirty state (current payload vs last successfully-saved payload).
 * - Attaches a `beforeunload` listener while dirty to satisfy INT-07.
 * - Skips autosave entirely when disabled (read-only or submitted).
 */
export function useLeadFormAutosave(
  args: UseLeadFormAutosaveArgs,
): AutosaveSnapshot {
  const { reportSectionId, payload, enabled } = args;
  const debounceMs = args.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const initialSavedKey = args.initialSavedKey ?? null;

  const trpc = useTRPC();
  const qc = useQueryClient();

  const [state, setState] = useState<AutosaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const lastSavedRef = useRef<string>('');
  const inFlightRef = useRef<string>('');

  // Prime lastSavedRef from caller-supplied baseline whenever it changes.
  // Lets the LeadForm tell us "this freshly-loaded server payload is already
  // saved" so the user doesn't see a dirty state on initial render.
  useEffect(() => {
    if (initialSavedKey !== null) {
      lastSavedRef.current = initialSavedKey;
    }
  }, [initialSavedKey]);

  const saveDraftMut = useMutation(
    trpc.reports.saveDraft.mutationOptions({
      onSuccess: () => {
        // The payload that was sent (captured at mutate time) is now persisted.
        lastSavedRef.current = inFlightRef.current;
        setState('saved');
        setLastSavedAt(new Date());
        invalidateLeadForm(qc, trpc);
      },
      onError: (err: unknown) => {
        setState('error');
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Autosave failed';
        toast.error(msg);
      },
    }),
  );

  const payloadKey = payload === null ? '' : stableStringify(payload);
  const dirty =
    enabled &&
    payload !== null &&
    payloadKey !== '' &&
    payloadKey !== lastSavedRef.current;

  // Debounced save trigger.
  useEffect(() => {
    if (!enabled || !dirty || !reportSectionId || payload === null) {
      return;
    }

    setState('pending');
    const timer = setTimeout(() => {
      setState('saving');
      inFlightRef.current = payloadKey;
      saveDraftMut.mutate({ ...payload, reportSectionId });
    }, debounceMs);

    return () => clearTimeout(timer);
    // We intentionally key on `payloadKey` (not `payload` reference) so equal
    // deep-content payloads don't restart the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, enabled, dirty, reportSectionId, debounceMs]);

  // beforeunload guard while dirty (INT-07).
  useEffect(() => {
    if (!dirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Setting returnValue is required for legacy browsers.
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  return { state, lastSavedAt, dirty };
}
