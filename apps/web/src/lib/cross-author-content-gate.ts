/**
 * Single source of truth for whether the `crossAuthorContent` read may fire.
 *
 * Both hosts that issue the read — `LeadSlidesClient` and the shared toolbar
 * host `LeadForm` — call this predicate so the own-deck gate is identical on
 * every host. The read is the sensitive full cross-author content fetch; it is
 * allowed ONLY on the current user's own deck in Everyone after the persisted
 * visibility has hydrated.
 *
 * Per ADR 0003 constraint 2 and the `status-slide-rendering` "Everyone is
 * available only on the lead's own deck" requirement: on a foreign `authorId`
 * deck the read MUST NOT fire, regardless of the user's persisted Mine/Everyone
 * value. Each host maps its own notion of own-deck to `isOwnDeck`
 * (`LeadSlidesClient`: `isOwnDeck` from `authorId` + session; `LeadForm`:
 * `!isForeignSlidesDeck`).
  * @param options - The options argument.
 */
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
