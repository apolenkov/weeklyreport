import type { ClarificationOption, SearchPlan } from "@customreport/shared";

import type { AliasKind, EntityAliasIndex } from "./entity-alias-index.js";
import type {
  ReportOccurrence,
  ResolvedSearchPlan,
  SectionScope,
} from "./report-retrieval.types.js";

export type AccessibleEntity = Readonly<{
  kind: AliasKind;
  id: string;
  label: string;
  aliases: readonly string[];
}>;

export type AccessibleEntityCatalog = Readonly<{
  entities: readonly AccessibleEntity[];
  index: EntityAliasIndex;
}>;

export type ClarificationTokenDescriptor = Readonly<{
  actorId: string;
  entityKind: AliasKind;
  entityId: string;
  reference: string;
}>;

export interface ClarificationTokenCodec {
  encode: (input: ClarificationTokenDescriptor) => string;
  decode: (
    token: string,
    actorId: string,
  ) => ClarificationTokenDescriptor | null;
}

type ResolvedEntityReferences = Readonly<{
  authorIds: readonly string[];
  productIds: readonly string[];
  activityIds: readonly string[];
  stageIds: readonly string[];
  periodIds: readonly string[];
}>;

export type EntityResolutionOutcome =
  | Readonly<{ kind: "resolved"; references: ResolvedEntityReferences }>
  | Readonly<{
      kind: "clarification_required";
      options: readonly ClarificationOption[];
    }>
  | Readonly<{ kind: "no_results" }>;

export type ResolveSearchPlanInput = Readonly<{
  plan: SearchPlan;
  actorId: string;
  occurrences: readonly ReportOccurrence[];
  sectionScopes: readonly SectionScope[];
  catalog: AccessibleEntityCatalog;
  resolutionTokens: readonly string[];
  tokenCodec: ClarificationTokenCodec;
}>;

export type SearchPlanResolutionOutcome =
  | Readonly<{ kind: "resolved"; plan: ResolvedSearchPlan }>
  | Readonly<{
      kind: "clarification_required";
      options: readonly ClarificationOption[];
    }>
  | Readonly<{ kind: "no_results" }>;

export type SingleReferenceOutcome =
  | Readonly<{ kind: "resolved"; id: string }>
  | Readonly<{
      kind: "clarification_required";
      options: readonly ClarificationOption[];
    }>
  | Readonly<{ kind: "no_results" }>;

export type ReferenceSlot = Readonly<{
  kind: AliasKind;
  reference: string;
}>;
