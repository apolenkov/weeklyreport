// Reads return items in durable stableId order (report-record-ordering); the
// local draft appends new items, so the Overview orders them the same way or a
// saved row jumps on read-back. Items without an identity stay last.
export function compareIdentityOrder(
  a: { readonly stableId?: string | null | undefined },
  b: { readonly stableId?: string | null | undefined },
): number {
  const left = a.stableId?.length ? a.stableId : null;
  const right = b.stableId?.length ? b.stableId : null;
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}
