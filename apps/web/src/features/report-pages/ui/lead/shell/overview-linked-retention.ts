import type {
  StatusOverviewItem,
  StatusOverviewLinkedDraft,
} from "../../../../report-sections";

/** Current editor identity context used to adopt a saved draft's new key. */
export interface LinkedReceiptContext {
  readonly scope?: string | null | undefined;
  readonly currentPayloadMatchesSavedBaseline?: boolean | undefined;
  readonly generation: string | null;
  readonly sectionId: string;
  readonly receipt: {
    readonly sequence?: number | undefined;
    readonly scope?: string | undefined;
    readonly generation: string | null;
    readonly reportSectionId: string;
    readonly itemIdentities: readonly {
      readonly clientId: string;
      readonly serverId: string;
      readonly stableId: string | null;
      readonly persistedNextStepText?: string | null | undefined;
    }[];
  } | null;
}

export type AliasIndex = Readonly<Record<string, readonly string[]>>;

// Stable lineage (not the projection slot) so a Current item that moves between
// the AdditionalUpdates and LineageRow surfaces keeps its linked draft.
export function linkedLineageKey(item: StatusOverviewItem): string | null {
  if (item.source === "previous") return null;
  return item.stableId ?? item.recordId ?? null;
}

// A new Current starts under its temporary client id. After the autosave
// receipt maps it to a serverId/stableId, this returns the original client key
// so the retained draft can be found. Identity-only: never matches on text.
export function linkedAliasKey(
  item: StatusOverviewItem,
  context: LinkedReceiptContext | null,
): string | null {
  if (context?.generation == null) return null;
  const receipt = context.receipt;
  if (receipt?.generation == null) return null;
  if (receipt.generation !== context.generation) return null;
  if (receipt.reportSectionId !== context.sectionId) return null;
  if (context.scope != null && context.scope !== receipt.scope) return null;
  const identity = receipt.itemIdentities.find(
    (candidate) =>
      candidate.serverId === item.recordId ||
      (candidate.stableId !== null && candidate.stableId === item.stableId),
  );
  return identity?.clientId ?? null;
}

export function linkedReceiptConfirmsIntent(
  item: StatusOverviewItem,
  text: string,
  context: LinkedReceiptContext | null,
): boolean {
  if (context?.generation == null) return false;
  const receipt = context.receipt;
  if (
    receipt?.generation == null ||
    receipt.generation !== context.generation ||
    receipt.reportSectionId !== context.sectionId ||
    (context.scope != null && context.scope !== receipt.scope)
  ) {
    return false;
  }
  const identity = receipt.itemIdentities.find(
    (candidate) =>
      candidate.clientId === item.recordId ||
      candidate.serverId === item.recordId ||
      (candidate.stableId !== null && candidate.stableId === item.stableId),
  );
  return identity?.persistedNextStepText === text;
}

export function resolveLinkedDraftKey(
  drafts: Readonly<Record<string, StatusOverviewLinkedDraft>> | null,
  item: StatusOverviewItem,
  context: LinkedReceiptContext | null,
  remembered: AliasIndex,
): string | null {
  const canonical = linkedLineageKey(item);
  if (!canonical) return null;
  if (drafts?.[canonical]) return canonical;
  // A previously observed mapping survives a later superseding receipt.
  const known = remembered[canonical] ?? [];
  const retainedAlias = known.find((alias) => drafts?.[alias]);
  if (retainedAlias) return retainedAlias;
  const alias = linkedAliasKey(item, context);
  return alias && drafts?.[alias] ? alias : canonical;
}
