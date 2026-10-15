/** Trims a draft value; blank means "no value" (null), as the section save stores it. */
export function normalize(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** True while the normalized draft pair differs from the authoritative pair it was opened against. */
export function activityDraftDirty(
  authoritative: {
    readonly titleOverride: string | null;
    readonly description: string | null;
  },
  title: string,
  description: string,
): boolean {
  return (
    normalize(title) !== authoritative.titleOverride ||
    normalize(description) !== authoritative.description
  );
}
