export type AliasKind = "author" | "product" | "activity" | "period";

export type AliasEntry = Readonly<{
  kind: AliasKind;
  id: string;
  aliases: readonly string[];
}>;

export type EntityAliasIndex = ReadonlyMap<string, readonly AliasEntry[]>;

const DASHES = /[‐‑‒–—―−]/gu;
const WHITESPACE = /\s+/gu;

export const normalizeEntityReference = (reference: string): string =>
  reference
    .normalize("NFKC")
    .replaceAll(DASHES, "-")
    .replaceAll(WHITESPACE, " ")
    .trim()
    .toLocaleLowerCase("und");

const addAlias = (
  index: ReadonlyMap<string, readonly AliasEntry[]>,
  alias: string,
  entry: AliasEntry,
): ReadonlyMap<string, readonly AliasEntry[]> => {
  const normalized = normalizeEntityReference(alias);
  if (!normalized) return index;
  const existing = index.get(normalized) ?? [];
  const hasEntry = existing.some(
    (candidate) => candidate.kind === entry.kind && candidate.id === entry.id,
  );
  return hasEntry
    ? index
    : new Map(index).set(normalized, [...existing, entry]);
};

export const buildEntityAliasIndex = (
  entries: readonly AliasEntry[],
): EntityAliasIndex =>
  entries.reduce<EntityAliasIndex>(
    (index, entry) =>
      entry.aliases.reduce<EntityAliasIndex>(
        (next, alias) => addAlias(next, alias, entry),
        index,
      ),
    new Map<string, readonly AliasEntry[]>(),
  );

export const resolveExactAlias = (
  index: EntityAliasIndex,
  reference: string,
): readonly AliasEntry[] =>
  index.get(normalizeEntityReference(reference)) ?? [];
