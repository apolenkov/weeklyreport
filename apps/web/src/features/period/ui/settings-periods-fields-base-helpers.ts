export const PERIOD_LENGTH_DAYS = { min: 1, max: 31, fallback: 1 } as const;
export const DEFAULT_DEADLINE_DAYS = {
  min: 1,
  max: 30,
  fallback: 1,
} as const;
export const GRACE_PERIOD_HOURS = { min: 0, max: 168, fallback: 0 } as const;
export const AUTO_ARCHIVE_WEEKS = { min: 0, max: 52, fallback: 0 } as const;

/**
 * Bounded Integer.
 * @param raw - The raw argument.
 * @param bounds - The bounds argument.
 */
export function boundedInteger(
  raw: string,
  bounds: {
    readonly min: number;
    readonly max: number;
    readonly fallback: number;
  },
): number {
  const parsed = Number.parseInt(raw, 10);
  const value = Number.isNaN(parsed) ? bounds.fallback : parsed;
  return Math.min(bounds.max, Math.max(bounds.min, value));
}
