import type {
  DraftSavePayload,
  ReportSectionReadModel,
} from "@customreport/shared";

/**
 * The autosave payload WITHOUT the optimistic-lock version. The version is lock
 * metadata, not user content: keeping it out of the payload the hook hashes
 * means a version bump never marks the form dirty, never re-seeds, and never
 * appears in the dirty/queue key. The hook injects the live version at mutate
 * time instead (so a queued drain rebases onto the freshly-bumped value).
 */
export type DraftSaveContent = Omit<DraftSavePayload, "version">;

export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

export interface AutosaveSnapshot {
  readonly state: AutosaveState;
  readonly lastSavedAt: Date | null;
  readonly dirty: boolean;
  readonly isInFlight: boolean;
  /** Cancels the debounce timer and triggers an immediate save. */
  readonly forceSave: () => Promise<void>;
}

export interface UseLeadFormAutosaveArgs {
  readonly reportSectionId: string | null;
  readonly payload: DraftSaveContent | null;
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
  /**
   * Row revision the next save must compare-and-set against (optimistic lock).
   * The hook seeds its live version from this and re-syncs whenever it changes
   * (e.g. a post-fillFrom or post-conflict refetch).
   */
  readonly version: number;
  /**
   * Called with the server-confirmed NEW version after every successful save.
   * The owning component is the single source of truth for the version; this
   * pushes each bump back so submit/fillFrom carry the current value.
   */
  readonly onVersionChange: (version: number) => void;
  /** Reports the server-confirmed section together with the payload it persisted. */
  readonly onSaved?: (
    section: ReportSectionReadModel,
    payload: DraftSaveContent,
  ) => void;
  /**
   * Called when a save is rejected as a stale-version CONFLICT (409). The
   * caller refetches this section and surfaces it; when provided, the hook
   * suppresses its own generic error toast for that case.
   */
  readonly onConflict?: () => void;
}
