import type { ClarificationOption } from "@customreport/shared";

import {
  type AliasKind,
  buildEntityAliasIndex,
  normalizeEntityReference,
  resolveExactAlias,
} from "./entity-alias-index.js";
import type {
  AccessibleEntity,
  AccessibleEntityCatalog,
  ClarificationTokenCodec,
  ClarificationTokenDescriptor,
  ReferenceSlot,
  SingleReferenceOutcome,
} from "./entity-resolver.types.js";

const MAX_CLARIFICATION_OPTIONS = 20;

export const uniqueStrings = (values: readonly string[]): readonly string[] =>
  values.filter((value, index) => values.indexOf(value) === index);

export const referenceKey = (kind: AliasKind, reference: string): string =>
  `${kind}:${normalizeEntityReference(reference)}`;

const mergeAccessibleEntity = (
  entities: readonly AccessibleEntity[],
  next: AccessibleEntity,
): readonly AccessibleEntity[] => {
  const existingIndex = entities.findIndex(
    (entity) => entity.kind === next.kind && entity.id === next.id,
  );
  if (existingIndex === -1) return [...entities, next];

  return entities.map((entity, index) =>
    index === existingIndex
      ? {
          ...entity,
          aliases: uniqueStrings([...entity.aliases, ...next.aliases]),
        }
      : entity,
  );
};

/** Build an alias catalog from occurrences already filtered by current ACL. */
export const buildAccessibleEntityCatalog = (
  entities: readonly AccessibleEntity[],
): AccessibleEntityCatalog => {
  const merged = entities.reduce<readonly AccessibleEntity[]>(
    mergeAccessibleEntity,
    [],
  );
  return {
    entities: merged,
    index: buildEntityAliasIndex(
      merged.map(({ kind, id, label, aliases }) => ({
        kind,
        id,
        aliases: uniqueStrings([label, ...aliases]),
      })),
    ),
  };
};

const accessibleEntitiesForAlias = (
  catalog: AccessibleEntityCatalog,
  kind: AliasKind,
  reference: string,
): readonly AccessibleEntity[] => {
  const ids = uniqueStrings(
    resolveExactAlias(catalog.index, reference)
      .filter((entry) => entry.kind === kind)
      .map((entry) => entry.id),
  );
  return ids.flatMap((id) =>
    catalog.entities.filter(
      (entity) => entity.kind === kind && entity.id === id,
    ),
  );
};

const entityById = (
  catalog: AccessibleEntityCatalog,
  kind: AliasKind,
  id: string,
): AccessibleEntity | undefined =>
  catalog.entities.find((entity) => entity.kind === kind && entity.id === id);

const sortEntities = (
  entities: readonly AccessibleEntity[],
): readonly AccessibleEntity[] =>
  [...entities].sort(
    (left, right) =>
      normalizeEntityReference(left.label).localeCompare(
        normalizeEntityReference(right.label),
      ) || left.id.localeCompare(right.id),
  );

const createClarificationOptions = (
  entities: readonly AccessibleEntity[],
  slot: ReferenceSlot,
  actorId: string,
  tokenCodec: ClarificationTokenCodec,
): readonly ClarificationOption[] =>
  sortEntities(entities)
    .slice(0, MAX_CLARIFICATION_OPTIONS)
    .map((entity) => ({
      label: entity.label,
      token: tokenCodec.encode({
        actorId,
        entityKind: entity.kind,
        entityId: entity.id,
        reference: slot.reference,
      }),
    }));

export const addToken = (
  index: ReadonlyMap<string, readonly ClarificationTokenDescriptor[]>,
  token: ClarificationTokenDescriptor,
): ReadonlyMap<string, readonly ClarificationTokenDescriptor[]> => {
  const key = referenceKey(token.entityKind, token.reference);
  return new Map(index).set(key, [...(index.get(key) ?? []), token]);
};

const uniqueTokenIds = (
  tokens: readonly ClarificationTokenDescriptor[],
): readonly string[] => uniqueStrings(tokens.map((token) => token.entityId));

const resolveWithToken = (
  catalog: AccessibleEntityCatalog,
  tokens: readonly ClarificationTokenDescriptor[],
  kind: AliasKind,
): SingleReferenceOutcome => {
  const ids = uniqueTokenIds(tokens);
  if (ids.length !== 1) return { kind: "no_results" };
  const id = ids[0];
  return id && entityById(catalog, kind, id)
    ? { kind: "resolved", id }
    : { kind: "no_results" };
};

export const resolveReference = (
  catalog: AccessibleEntityCatalog,
  slot: ReferenceSlot,
  tokenIndex: ReadonlyMap<string, readonly ClarificationTokenDescriptor[]>,
  actorId: string,
  tokenCodec: ClarificationTokenCodec,
): SingleReferenceOutcome => {
  const tokens = tokenIndex.get(referenceKey(slot.kind, slot.reference)) ?? [];
  if (tokens.length > 0) {
    return resolveWithToken(catalog, tokens, slot.kind);
  }

  const entities = accessibleEntitiesForAlias(
    catalog,
    slot.kind,
    slot.reference,
  );
  if (entities.length === 0) return { kind: "no_results" };
  if (entities.length === 1) {
    return { kind: "resolved", id: entities[0]?.id ?? "" };
  }
  return {
    kind: "clarification_required",
    options: createClarificationOptions(entities, slot, actorId, tokenCodec),
  };
};
