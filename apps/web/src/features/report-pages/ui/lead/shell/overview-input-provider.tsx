"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { useSession } from "../../../../../shared/lib/auth/session-provider";
import type {
  StatusOverviewItem,
  StatusOverviewLinkedDraft,
  StatusOverviewLinkedMemory,
  StatusOverviewQuickEditMemory,
} from "../../../../report-sections";
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import { createOverviewInputMemory } from "./overview-input-memory";
import {
  type AliasIndex,
  linkedAliasKey,
  linkedLineageKey,
  linkedReceiptConfirmsIntent,
  type LinkedReceiptContext,
  resolveLinkedDraftKey,
} from "./overview-linked-retention";
export type { LinkedReceiptContext } from "./overview-linked-retention";
import type { OverviewPlanState } from "./overview-plan-command";

function createMemory() {
  return {
    item: createOverviewInputMemory<OverviewItemDialogState>(),
    plan: createOverviewInputMemory<OverviewPlanState>(),
    quickEdit: createOverviewInputMemory<Readonly<Record<string, string>>>(),
    linked:
      createOverviewInputMemory<
        Readonly<Record<string, StatusOverviewLinkedDraft>>
      >(),
    linkedAliases: createOverviewInputMemory<{
      readonly scopeKey: string;
      readonly aliases: Readonly<Record<string, readonly string[]>>;
    }>(),
  };
}

const MemoryContext = createContext<ReturnType<typeof createMemory> | null>(
  null,
);

function SessionInputMemory({ children }: { readonly children: ReactNode }) {
  const [memory] = useState(createMemory);
  const itemPending = useSyncExternalStore(
    memory.item.subscribe,
    memory.item.hasInput,
    () => false,
  );
  const planPending = useSyncExternalStore(
    memory.plan.subscribe,
    memory.plan.hasInput,
    () => false,
  );
  const quickEditPending = useSyncExternalStore(
    memory.quickEdit.subscribe,
    memory.quickEdit.hasInput,
    () => false,
  );
  const linkedPending = useSyncExternalStore(
    memory.linked.subscribe,
    memory.linked.hasInput,
    () => false,
  );
  useEffect(() => {
    if (!itemPending && !planPending && !quickEditPending && !linkedPending) {
      return;
    }
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [itemPending, planPending, quickEditPending, linkedPending]);
  return (
    <MemoryContext.Provider value={memory}>{children}</MemoryContext.Provider>
  );
}

// The layout survives route changes; its keyed child never survives a user change.
export function OverviewInputProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { user } = useSession();
  return (
    <SessionInputMemory key={user?.id ?? "anonymous"}>
      {children}
    </SessionInputMemory>
  );
}

function useOverviewMemory<
  Kind extends "item" | "plan" | "quickEdit" | "linked" | "linkedAliases",
>(kind: Kind) {
  const shared = useContext(MemoryContext);
  const [local] = useState(createMemory);
  return (shared ?? local)[kind];
}

export function useRetainedOverviewState<
  Kind extends "item" | "plan" | "quickEdit",
>(kind: Kind, reportId: string) {
  const memory = useOverviewMemory(kind);
  type Value = Kind extends "item"
    ? OverviewItemDialogState
    : Kind extends "plan"
      ? OverviewPlanState
      : Readonly<Record<string, string>>;
  const typed = memory as ReturnType<typeof createOverviewInputMemory<Value>>;
  const value = useSyncExternalStore(
    typed.subscribe,
    () => typed.read(reportId),
    () => null,
  );
  return [
    value,
    (action: React.SetStateAction<Value | null>) =>
      typed.write(reportId, action),
  ] as const;
}

function quickEditKey(item: StatusOverviewItem): string | null {
  const identity = item.stableId ?? item.editTarget?.recordId ?? item.recordId;
  if (!identity || item.source === "previous") return null;
  return JSON.stringify([identity, item.source]);
}

export function useRetainedOverviewQuickEdits(
  reportId: string,
): StatusOverviewQuickEditMemory {
  const [drafts, setDrafts] = useRetainedOverviewState("quickEdit", reportId);
  return {
    read: (item) => {
      const key = quickEditKey(item);
      return key ? (drafts?.[key] ?? null) : null;
    },
    write: (item, draft) => {
      const key = quickEditKey(item);
      if (!key) return;
      setDrafts((current) => {
        if (draft !== null) return { ...current, [key]: draft };
        const next = { ...current };
        delete next[key];
        return Object.keys(next).length > 0 ? next : null;
      });
    },
  };
}

export function useRetainedOverviewLinkedEdits(
  reportId: string,
  context: LinkedReceiptContext | null,
): StatusOverviewLinkedMemory {
  const memory = useOverviewMemory("linked");
  const aliasMemory = useOverviewMemory("linkedAliases");
  const scopeKey =
    context?.generation == null
      ? JSON.stringify([reportId, null])
      : JSON.stringify([reportId, context.generation, context.sectionId]);
  const drafts = useSyncExternalStore(
    memory.subscribe,
    () => memory.read(reportId),
    () => null,
  );
  const pending = useSyncExternalStore(
    memory.subscribe,
    () => memory.read(reportId) !== null,
    () => false,
  );
  const aliasState = useSyncExternalStore(
    aliasMemory.subscribe,
    () => aliasMemory.read(reportId),
    () => null,
  );
  const aliases: AliasIndex =
    aliasState?.scopeKey === scopeKey ? aliasState.aliases : {};

  useEffect(() => {
    const receipt = context?.receipt;
    const matches =
      context?.generation != null &&
      receipt?.generation != null &&
      receipt.generation === context.generation &&
      receipt.reportSectionId === context.sectionId &&
      (context.scope == null || receipt.scope === context.scope);
    if (!matches) return;
    const pairs = receipt.itemIdentities
      .map((identity) => ({
        canonical: identity.stableId ?? identity.serverId,
        alias: identity.clientId,
      }))
      .filter(({ canonical, alias }) => canonical !== "" && alias !== "");
    aliasMemory.write(reportId, (current) => {
      const base = current?.scopeKey === scopeKey ? current.aliases : {};
      const nextAliases = pairs.reduce<AliasIndex>(
        (next, { canonical, alias }) => {
          const known = next[canonical] ?? [];
          return known.includes(alias)
            ? next
            : { ...next, [canonical]: [...known, alias] };
        },
        base,
      );
      return nextAliases === base
        ? current
        : { scopeKey, aliases: nextAliases };
    });
    const plan = pairs.filter(
      ({ canonical, alias }) =>
        canonical !== alias && !drafts?.[canonical] && drafts?.[alias],
    );
    if (plan.length === 0) return;
    memory.write(reportId, (current) => {
      if (!current) return current;
      const next = { ...current };
      for (const { canonical, alias } of plan) {
        if (next[canonical] || !next[alias]) continue;
        next[canonical] = next[alias];
        delete next[alias];
      }
      return next;
    });
  }, [aliasMemory, memory, reportId, drafts, context, aliasState, scopeKey]);

  return {
    read: (item) => {
      const key = resolveLinkedDraftKey(drafts, item, context, aliases);
      return key ? (drafts?.[key] ?? null) : null;
    },
    write: (item, next) => {
      const canonical = linkedLineageKey(item);
      if (!canonical) return;
      const currentAlias = linkedAliasKey(item, context);
      const aliasesToClear = [
        ...(aliases[canonical] ?? []),
        ...(currentAlias ? [currentAlias] : []),
      ].filter((alias) => alias !== canonical);
      memory.write(reportId, (current) => {
        const rest = { ...current };
        delete rest[canonical];
        for (const alias of aliasesToClear) delete rest[alias];
        if (next !== null) rest[canonical] = next;
        return Object.keys(rest).length > 0 ? rest : null;
      });
      aliasMemory.write(reportId, (current) =>
        current?.scopeKey === scopeKey
          ? {
              scopeKey,
              aliases: Object.fromEntries(
                Object.entries(current.aliases).filter(
                  ([key]) => key !== canonical,
                ),
              ),
            }
          : current,
      );
    },
    pending,
    receiptSequence: context?.receipt?.sequence ?? 0,
    receiptScope: context?.scope ?? null,
    currentPayloadMatchesSavedBaseline:
      context?.currentPayloadMatchesSavedBaseline === true,
    receiptConfirms: (item, text) =>
      linkedReceiptConfirmsIntent(item, text, context),
  };
}
