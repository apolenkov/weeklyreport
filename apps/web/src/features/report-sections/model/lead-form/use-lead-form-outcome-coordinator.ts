"use client";

import type { ItemOutcomeResult } from "@customreport/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  blockedReasonOf,
  commandError,
  type OutcomeCommandContext,
  type OutcomeCoordinatorArgs,
  type OutcomeScope,
  outcomeScopeOf,
  portOutcomePending,
  type PreparedOutcomeCommand,
  preparePromoteCommand,
  prepareResolveCommand,
  prepareRestoreCommand,
  type PromotePlanCommandInput,
  type ResolvePlanCommandInput,
  type RestorePlanCommandInput,
  resultMatchesScope,
  WAIT_FOR_OUTCOME,
} from "./lead-form-outcome-coordinator-helpers";

export interface LeadFormOutcomeActions {
  readonly pending: boolean;
  readonly canExecute: boolean;
  readonly blockedReason: string | null;
  readonly resolve: (
    input: ResolvePlanCommandInput,
    sourceStableId: string | null,
  ) => Promise<ItemOutcomeResult>;
  readonly restore: (
    input: RestorePlanCommandInput,
    stableId: string,
  ) => Promise<ItemOutcomeResult>;
  readonly promote: (
    input: PromotePlanCommandInput,
    stableId: string,
  ) => Promise<ItemOutcomeResult>;
}

interface ActiveCommand {
  readonly token: symbol;
  readonly scopeKey: string;
}

const SECTION_UNAVAILABLE = "This report section is unavailable.";

// The prepared-request registry is dropped whenever the command scope moves.
function usePreparedRegistry(scope: OutcomeScope | null) {
  const preparedScopeRef = useRef<string | null>(scope?.key ?? null);
  const preparedRef = useRef<Map<string, PreparedOutcomeCommand>>(new Map());

  useEffect(() => {
    const nextScopeKey = scope?.key ?? null;
    if (preparedScopeRef.current !== nextScopeKey) {
      preparedScopeRef.current = nextScopeKey;
      preparedRef.current.clear();
    }
  }, [scope]);

  return useCallback((commandScope: OutcomeScope) => {
    if (preparedScopeRef.current !== commandScope.key) {
      preparedScopeRef.current = commandScope.key;
      preparedRef.current.clear();
    }
    return preparedRef.current;
  }, []);
}

// Single-flight gate: at most one active command per scope, adopted only while
// that command and its scope are still current.
function useOutcomeGate(
  args: OutcomeCoordinatorArgs,
  scope: OutcomeScope | null,
) {
  const activeRef = useRef<ActiveCommand | null>(null);
  const liveScopeRef = useRef<OutcomeScope | null>(scope);
  const [pending, setPendingScope] = useState<string | null>(null);

  useEffect(
    () => () => {
      liveScopeRef.current = null;
      activeRef.current = null;
    },
    [],
  );

  useEffect(() => {
    liveScopeRef.current = scope;
    const nextScopeKey = scope?.key ?? null;
    if (
      activeRef.current !== null &&
      activeRef.current.scopeKey !== nextScopeKey
    ) {
      activeRef.current = null;
      setPendingScope(null);
    }
  }, [scope]);

  const acquire = useCallback(
    (commandScope: OutcomeScope): symbol => {
      const active = activeRef.current;
      if (active !== null && active.scopeKey === commandScope.key) {
        throw commandError(WAIT_FOR_OUTCOME);
      }
      const reason = blockedReasonOf(args, commandScope, false);
      if (reason !== null) throw commandError(reason);

      const token = Symbol("lead-form-outcome-command");
      activeRef.current = { token, scopeKey: commandScope.key };
      setPendingScope(commandScope.key);
      return token;
    },
    [args],
  );

  const release = useCallback((token: symbol, commandScope: OutcomeScope) => {
    if (activeRef.current?.token !== token) return;
    activeRef.current = null;
    setPendingScope((current) =>
      current === commandScope.key ? null : current,
    );
  }, []);

  const adoptIfCurrent = useCallback(
    (result: ItemOutcomeResult, commandScope: OutcomeScope, token: symbol) => {
      if (
        activeRef.current?.token !== token ||
        liveScopeRef.current?.key !== commandScope.key ||
        !resultMatchesScope(result, commandScope)
      ) {
        return;
      }
      if (
        !args.acceptVersion(
          result.section.reportSectionId,
          result.section.version,
        )
      ) {
        return;
      }
      args.adoptServerSection(result.section);
    },
    [args],
  );

  const isActiveIn = useCallback(
    (scopeKey: string) => activeRef.current?.scopeKey === scopeKey,
    [],
  );

  return {
    acquire,
    release,
    adoptIfCurrent,
    isActiveIn,
    locallyPending: scope !== null && pending === scope.key,
  };
}

function useOutcomeExecutor(
  args: OutcomeCoordinatorArgs,
  scope: OutcomeScope | null,
  gate: ReturnType<typeof useOutcomeGate>,
) {
  const prepareRegistry = usePreparedRegistry(scope);
  const { acquire, release, adoptIfCurrent } = gate;
  return useCallback(
    async <Prepared>(
      prepare: (
        registry: Map<string, PreparedOutcomeCommand>,
        context: OutcomeCommandContext,
      ) => Prepared,
      send: (prepared: Prepared) => Promise<ItemOutcomeResult>,
    ): Promise<ItemOutcomeResult> => {
      if (scope === null || args.draftSection === null) {
        throw commandError(SECTION_UNAVAILABLE);
      }
      const token = acquire(scope);
      try {
        const prepared = prepare(prepareRegistry(scope), {
          scope,
          draftSection: args.draftSection,
          version: args.version,
        });
        const result = await send(prepared);
        adoptIfCurrent(result, scope, token);
        return result;
      } finally {
        release(token, scope);
      }
    },
    [acquire, adoptIfCurrent, args, prepareRegistry, release, scope],
  );
}

// Coordinates explicit lineage commands with the ordinary draft writer. A
// command is accepted only from a clean saved baseline, and its first prepared
// request is retained by commandId so an idempotent retry keeps the original
// physical source id even if a later read remints that occurrence.
export function useLeadFormOutcomeCoordinator(
  args: OutcomeCoordinatorArgs,
): LeadFormOutcomeActions & { readonly isLocked: () => boolean } {
  const scope = useMemo(
    () => outcomeScopeOf(args.generation, args.sectionId, args.draftSection),
    [args.draftSection, args.generation, args.sectionId],
  );
  const gate = useOutcomeGate(args, scope);
  const { isActiveIn, locallyPending } = gate;
  const execute = useOutcomeExecutor(args, scope, gate);
  const blockedReason = blockedReasonOf(args, scope, locallyPending);

  const resolve = useCallback<LeadFormOutcomeActions["resolve"]>(
    (input, sourceStableId) =>
      execute(
        (registry, context) =>
          prepareResolveCommand(registry, input, sourceStableId, context),
        (prepared) => args.writePort.resolvePlan(prepared),
      ),
    [args.writePort, execute],
  );

  const restore = useCallback<LeadFormOutcomeActions["restore"]>(
    (input, stableId) =>
      execute(
        (registry, context) =>
          prepareRestoreCommand(registry, input, stableId, context),
        (prepared) => args.writePort.restorePlan(prepared),
      ),
    [args.writePort, execute],
  );

  // MOVE-NEXT-CURRENT: the recorded commitment is promoted through the same
  // command registry, so an idempotent retry keeps its original physical id.
  const promote = useCallback<LeadFormOutcomeActions["promote"]>(
    (input, stableId) =>
      execute(
        (registry, context) =>
          preparePromoteCommand(registry, input, stableId, context),
        (prepared) => args.writePort.promotePlan(prepared),
      ),
    [args.writePort, execute],
  );

  const isLocked = useCallback(
    () =>
      scope !== null &&
      (isActiveIn(scope.key) || portOutcomePending(args.writePort)),
    [args.writePort, isActiveIn, scope],
  );

  return useMemo(
    () => ({
      pending: locallyPending || portOutcomePending(args.writePort),
      canExecute: blockedReason === null,
      blockedReason,
      resolve,
      restore,
      promote,
      isLocked,
    }),
    [
      args.writePort,
      blockedReason,
      isLocked,
      locallyPending,
      promote,
      resolve,
      restore,
    ],
  );
}
