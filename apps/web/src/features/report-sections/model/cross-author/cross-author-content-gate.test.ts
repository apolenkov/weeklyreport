import { describe, expect, it } from "vitest";

import { crossAuthorContentFetchEnabled } from "./cross-author-content-gate";

describe("crossAuthorContentFetchEnabled", () => {
  const ALL_TRUE = {
    hasReport: true,
    visibilityHydrated: true,
    isEveryone: true,
    isOwnDeck: true,
  };

  it("enables only when every condition holds (own deck, Everyone, hydrated, has report)", () => {
    expect(crossAuthorContentFetchEnabled(ALL_TRUE)).toBe(true);
  });

  it("NEVER fires on a foreign deck, even in Everyone (the tail-1 invariant)", () => {
    // isOwnDeck:false is the foreign-deck row — the read must stay disabled
    // regardless of the persisted Everyone toggle. This is the single guard
    // both LeadSlidesClient and LeadForm rely on for the "every host" clause.
    expect(
      crossAuthorContentFetchEnabled({ ...ALL_TRUE, isOwnDeck: false }),
    ).toBe(false);
  });

  it("is disabled in Mine", () => {
    expect(
      crossAuthorContentFetchEnabled({ ...ALL_TRUE, isEveryone: false }),
    ).toBe(false);
  });

  it("is disabled before the persisted visibility hydrates", () => {
    expect(
      crossAuthorContentFetchEnabled({
        ...ALL_TRUE,
        visibilityHydrated: false,
      }),
    ).toBe(false);
  });

  it("is disabled with no target report", () => {
    expect(
      crossAuthorContentFetchEnabled({ ...ALL_TRUE, hasReport: false }),
    ).toBe(false);
  });
});
