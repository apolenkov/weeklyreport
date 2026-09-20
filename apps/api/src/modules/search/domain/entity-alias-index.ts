import { normalizeEntityReference } from "@customreport/shared";

export { normalizeEntityReference };

export type AliasKind = "author" | "product" | "activity" | "period";

export type AliasEntry = Readonly<{
  kind: AliasKind;
  id: string;
  aliases: readonly string[];
}>;

export type EntityAliasIndex = ReadonlyMap<string, readonly AliasEntry[]>;

export const buildEntityAliasIndex = (
  entries: readonly AliasEntry[],
): EntityAliasIndex => {
  const aliases = entries.flatMap((entry) =>
    entry.aliases.flatMap((alias) => {
      const normalized = normalizeEntityReference(alias);
      return normalized ? [{ normalized, entry }] : [];
    }),
  );
  return new Map(
    [...Map.groupBy(aliases, ({ normalized }) => normalized)].map(
      ([alias, occurrences]) => [
        alias,
        [
          ...Map.groupBy(
            occurrences.map(({ entry }) => entry),
            ({ kind, id }) => `${kind}:${id}`,
          ).values(),
        ].flatMap((matches) => matches.slice(0, 1)),
      ],
    ),
  );
};

export const resolveExactAlias = (
  index: EntityAliasIndex,
  reference: string,
): readonly AliasEntry[] =>
  index.get(normalizeEntityReference(reference)) ?? [];
