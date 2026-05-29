import type { CreateSnapshotResult, LeadFormRepository } from "./lead-form-shared";

/** Minimum time between autosave-triggered snapshots for a single section. */
const SNAPSHOT_THROTTLE_MS = 60_000;

/**
 * Stable JSON serialisation with sorted object keys so equivalent payloads
 * compare equal regardless of property insertion order.
 * Used for content-based dedup in createSnapshot.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${(value as unknown[]).map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map((k) => {
    const v = (value as Record<string, unknown>)[k];
    return `${JSON.stringify(k)}:${stableStringify(v)}`;
  });
  return `{${parts.join(",")}}`;
}

/**
 * Owns explicit/autosave version snapshots of the current section state.
 * Extracted verbatim from `LeadFormService` (code-quality-modernization,
 * Wave 3, HOT ZONE — guarded by
 * `version-snapshot.characterization.integration.test.ts`); throttle +
 * content-dedup semantics are unchanged.
 */
export class SnapshotService {
  constructor(private readonly repository: LeadFormRepository) {}

  /**
   * Create an explicit version snapshot of the current section state.
   *
   * Used by:
   * - The "Save Version" button on the lead form (manual checkpoint).
   * - The autosave hook on every successful autosave (silent safety net).
   *
   * Validates ownership and skips when the section is submitted (locked
   * sections shouldn't accumulate snapshots — there's nothing changing).
   *
   * Server-side throttle + dedup applied before writing:
   * - Throttle: at most one snapshot per 60 s per section (silently skipped).
   * - Content dedup: if the section data hasn't changed vs. the last snapshot,
   *   the write is silently skipped.
   * Time-based retention (all <24 h / hourly 24 h–7 d / daily 7–30 d /
   * drop >30 d) is enforced inside the repository.
   *
   * Internal callers (fillFrom, restoreVersion) call
   * repository.createVersionSnapshot() directly and bypass throttle — those
   * are safety-net snapshots that must always fire.
   */
  async createSnapshot(
    sectionId: string,
    userId: string,
  ): Promise<CreateSnapshotResult> {
    const section = await this.repository.getSectionById(sectionId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found.`);
    }

    if (section.authorId !== userId) {
      throw new Error("Can only snapshot your own section.");
    }

    if (section.status === "submitted") {
      throw new Error("Cannot snapshot a submitted section.");
    }

    const latest = await this.repository.getLatestSnapshot(sectionId);

    if (latest) {
      // Throttle: skip if last snapshot is less than 60 seconds ago
      const ageMs = Date.now() - latest.createdAt.getTime();
      if (ageMs < SNAPSHOT_THROTTLE_MS) {
        return { version: latest.version, skipped: true, reason: "throttled" };
      }

      // Content dedup: skip if data is byte-identical to the latest snapshot.
      // Compare two snapshot projections (same shape) — not section vs snapshot.
      const currentProjection =
        await this.repository.buildSnapshotProjection(sectionId);
      if (stableStringify(latest.data) === stableStringify(currentProjection)) {
        return { version: latest.version, skipped: true, reason: "no-change" };
      }
    }

    const version = await this.repository.createVersionSnapshot(sectionId);
    return { version };
  }
}
