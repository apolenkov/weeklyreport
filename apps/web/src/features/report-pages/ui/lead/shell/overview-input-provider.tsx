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
import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import { createOverviewInputMemory } from "./overview-input-memory";
import {
  isPlanInputEdited,
  type OverviewPlanState,
} from "./overview-plan-command";

function createMemory() {
  return {
    item: createOverviewInputMemory<OverviewItemDialogState>(),
    plan: createOverviewInputMemory<OverviewPlanState>(),
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
  useEffect(() => {
    if (!itemPending && !planPending) return;
    // Retained input that still equals what its composer opened with has
    // nothing to lose, so unload is only blocked for edited input.
    const preventUnload = (event: BeforeUnloadEvent) => {
      if (
        memory.item.some((dialog) => dialog.draftStore.isDirty()) ||
        memory.plan.some(isPlanInputEdited)
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [itemPending, planPending, memory]);
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

function useOverviewMemory<Kind extends "item" | "plan">(kind: Kind) {
  const shared = useContext(MemoryContext);
  const [local] = useState(createMemory);
  return (shared ?? local)[kind];
}

export function useRetainedOverviewState<Kind extends "item" | "plan">(
  kind: Kind,
  reportId: string,
) {
  const memory = useOverviewMemory(kind);
  type Value = Kind extends "item"
    ? OverviewItemDialogState
    : OverviewPlanState;
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
