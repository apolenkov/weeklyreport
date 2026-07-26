// A bare `.sort()` orders by UTF-16 code unit, putting every capital ahead of
// every lowercase. The locale is pinned rather than taken from the machine so
// a listing comes out in the same order on a laptop and in CI.
const ORDERING_LOCALE = "en";

export const byName = (a: string, b: string): number =>
  a.localeCompare(b, ORDERING_LOCALE);
