import {
  CANONICAL_STATUS_PRECEDENCE,
  type CanonicalStatus,
} from "@customreport/shared";

interface StatusNamed {
  readonly status: CanonicalStatus;
  readonly name: string;
}

// One display order for every product list: Blocked, At risk, On track,
// No updates; equal statuses fall back to the name in the API's "ru" collation.
export function compareBySeverityThenName(
  left: StatusNamed,
  right: StatusNamed,
): number {
  return (
    CANONICAL_STATUS_PRECEDENCE[right.status] -
      CANONICAL_STATUS_PRECEDENCE[left.status] ||
    left.name.localeCompare(right.name, "ru")
  );
}
