// A bare `.sort()` orders by UTF-16 code unit, which puts every capital ahead
// of every lowercase and reads as a bug in a report a human scans. The locale
// is pinned rather than left to the machine so a catalog listing comes out in
// the same order on a developer's laptop and in CI.
const ORDERING_LOCALE = "en";

export const byName = (a: string, b: string): number =>
  a.localeCompare(b, ORDERING_LOCALE);
