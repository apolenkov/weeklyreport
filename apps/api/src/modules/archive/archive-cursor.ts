const CURSOR_SEPARATOR = "|";

export interface ArchiveCursor {
  publishedAt: Date;
  id: string;
}

/**
 * Keyset cursor for archive pagination: the `(publishedAt, id)` coordinate of
 * the last row on a page, base64-encoded. Keyset — not Prisma `cursor`/`skip` —
 * so the next page still resolves after the cursor row is unarchived or
 * deleted: the coordinate is self-contained and never re-read from the
 * database, whereas `cursor: { id }` throws once its row is gone.
 * @param publishedAt - The publishedAt argument.
 * @param id - The id argument.
 */
export function encodeArchiveCursor(publishedAt: Date, id: string): string {
  return Buffer.from(
    `${publishedAt.toISOString()}${CURSOR_SEPARATOR}${id}`,
    "utf8",
  ).toString("base64");
}

/**
 * Decode a keyset cursor back to its coordinate. Returns null on a malformed
 * token; the caller (withArchiveKeyset) rejects a present-but-malformed cursor
 * with a 400 rather than silently restarting pagination (the id is a UUID and
 * the ISO date carries no separator, so the first `|` splits the two cleanly).
 * @param cursor - The cursor argument.
 */
export function decodeArchiveCursor(cursor: string): ArchiveCursor | null {
  const decoded = Buffer.from(cursor, "base64").toString("utf8");
  const separatorAt = decoded.indexOf(CURSOR_SEPARATOR);
  if (separatorAt === -1) return null;

  const publishedAt = new Date(decoded.slice(0, separatorAt));
  const id = decoded.slice(separatorAt + 1);
  if (id.length === 0 || Number.isNaN(publishedAt.getTime())) return null;

  return { publishedAt, id };
}
