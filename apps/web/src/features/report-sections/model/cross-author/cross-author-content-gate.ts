// Single gate for the sensitive full cross-author content read, shared by every
// host that issues it: allowed ONLY on the user's own deck in Everyone once
// visibility has hydrated (ADR 0003 c2 / `status-slide-rendering`).
export function crossAuthorContentFetchEnabled({
  hasReport,
  visibilityHydrated,
  isEveryone,
  isOwnDeck,
}: {
  hasReport: boolean;
  visibilityHydrated: boolean;
  isEveryone: boolean;
  isOwnDeck: boolean;
}): boolean {
  return hasReport && visibilityHydrated && isEveryone && isOwnDeck;
}
