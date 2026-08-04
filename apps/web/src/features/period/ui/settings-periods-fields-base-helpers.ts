export interface IntegerBounds {
  readonly min: number;
  readonly max: number;
}

export const PERIOD_LENGTH_DAYS = { min: 1, max: 31 } as const;
export const DEFAULT_DEADLINE_DAYS = { min: 1, max: 30 } as const;
export const GRACE_PERIOD_HOURS = { min: 0, max: 168 } as const;
export const AUTO_ARCHIVE_WEEKS = { min: 0, max: 52 } as const;
const INTEGER_PATTERN = /^[+-]?\d+$/;

// Strict parse: an empty or non-integer raw string (or one outside the bounds)
// yields null so the caller keeps the raw text and surfaces a validation error
// instead of silently fabricating a value. See the no-fallback policy.
export function parseIntegerInBounds(
  raw: string,
  bounds: {
    readonly min: number;
    readonly max: number;
  },
): number | null {
  const text = raw.trim();
  if (!INTEGER_PATTERN.test(text)) return null;
  const parsed = Number.parseInt(text, 10);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < bounds.min || parsed > bounds.max) return null;
  return parsed;
}
