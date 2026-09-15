"use client";

import type { ItemOutcomeResult } from "@customreport/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  blockedReasonOf,
  commandError,
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

export type {
  PromotePlanCommandInput,
  ResolvePlanCommandInput,
  RestorePlanCommandInput,
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
  const activeRef = useRef<ActiveCommand | null>(null);
  const liveScopeRef = useRef<OutcomeScope | null>(scope);
  const preparedScopeRef = useRef<string | null>(scope?.key ?? null);
  const preparedRef = useRef<Map<string, PreparedOutcomeCommand>>(new Map());
  const [pendingScope, setPendingScope] = useState<string | null>(null);

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
    if (preparedScopeRef.current !== nextScopeKey) {
      preparedScopeRef.current = nextScopeKey;
      preparedRef.current.clear();
    }
    if (
      activeRef.current !== null &&
      activeRef.current.scopeKey !== nextScopeKey
    ) {
      activeRef.current = null;
      setPendingScope(null);
    }
  }, [scope]);

  const locallyPending = scope !== null && pendingScope === scope.key;
  const blockedReason = blockedReasonOf(args, scope, locallyPending);

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

  const prepareRegistry = useCallback((commandScope: OutcomeScope) => {
    if (preparedScopeRef.current !== commandScope.key) {
      preparedScopeRef.current = commandScope.key;
      preparedRef.current.clear();
    }
    return preparedRef.current;
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

  const resolve = useCallback<LeadFormOutcomeActions["resolve"]>(
    async (input, sourceStableId) => {
      if (scope === null || args.draftSection === null) {
        throw commandError(SECTION_UNAVAILABLE);
      }
      const token = acquire(scope);
      try {
        const prepared = prepareResolveCommand(
          prepareRegistry(scope),
          input,
          sourceStableId,
          scope,
          args.draftSection,
          args.version,
        );
        const result = await args.writePort.resolvePlan(prepared);
        adoptIfCurrent(result, scope, token);
        return result;
      } finally {
        release(token, scope);
      }
    },
    [acquire, adoptIfCurrent, args, prepareRegistry, release, scope],
  );

  const restore = useCallback<LeadFormOutcomeActions["restore"]>(
    async (input, stableId) => {
      if (scope === null || args.draftSection === null) {
        throw commandError(SECTION_UNAVAILABLE);
      }
      const token = acquire(scope);
      try {
        const prepared = prepareRestoreCommand(
          prepareRegistry(scope),
          input,
          stableId,
          scope,
          args.draftSection,
          args.version,
        );
        const result = await args.writePort.restorePlan(prepared);
        adoptIfCurrent(result, scope, token);
        return result;
      } finally {
        release(token, scope);
      }
    },
    [acquire, adoptIfCurrent, args, prepareRegistry, release, scope],
  );

  // MOVE-NEXT-CURRENT: the recorded commitment is promoted through the same
  // command registry, so an idempotent retry keeps its original physical id.
  const promote = useCallback<LeadFormOutcomeActions["promote"]>(
    async (input, stableId) => {
      if (scope === null || args.draftSection === null) {
        throw commandError(SECTION_UNAVAILABLE);
      }
      const token = acquire(scope);
      try {
        const prepared = preparePromoteCommand(
          prepareRegistry(scope),
          input,
          stableId,
          scope,
          args.draftSection,
          args.version,
        );
        const result = await args.writePort.promotePlan(prepared);
        adoptIfCurrent(result, scope, token);
        return result;
      } finally {
        release(token, scope);
      }
    },
    [acquire, adoptIfCurrent, args, prepareRegistry, release, scope],
  );

  const isLocked = useCallback(
    () =>
      scope !== null &&
      (activeRef.current?.scopeKey === scope.key ||
        portOutcomePending(args.writePort)),
    [args.writePort, scope],
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
