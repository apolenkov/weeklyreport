import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import {
  actorForPermission,
  type RuntimeMatrixActor,
} from "../../matrix/runtime-matrix.ts";
import { clearClientStorage } from "../../replay/browser-state/client-storage.ts";
import {
  type PreparedRuntimeState,
  prepareRuntimeState,
  type RuntimeStateDatabase,
  type RuntimeStateResetter,
} from "../../support/state-preparation.ts";
import {
  assertPreparedStateUnchanged,
  provePreparedStateNonMutation,
} from "../../support/state-preparation-nonmutation.ts";
import {
  type PreflightRoute,
  routeForState,
} from "../execution/playwright-preflight-support.ts";
import type { RevealPreparation } from "../reveal/interaction/preflight-reveal-types.ts";
import {
  preflightPreparationKeyFor,
  statePreparationInputFor,
} from "./preflight-preparation-key.ts";
import type { PreparedStateCache } from "./preflight-prepared-state-cache.ts";
import {
  actorsForProfile,
  resetProfileSessions,
} from "./preflight-profile-session-reset.ts";
import type {
  PreflightRuntimePreparation,
  PreflightRuntimePreparationWithBoundary,
} from "./preflight-runtime-preparation-contract.ts";
import type { PreflightRuntimeSetupInput } from "./preflight-runtime-setup.ts";
import {
  createProfileSessionCacheRegistry,
  type PreflightSessionCache,
  quiescePreflightStatePage,
} from "./preflight-session.ts";

type ProfileSessionRegistry = ReturnType<
  typeof createProfileSessionCacheRegistry<CampaignMatrixState["profile"]>
>;

const prepareStateForPreflight = async (input: {
  readonly setup: PreflightRuntimeSetupInput;
  readonly state: CampaignMatrixState;
  readonly route: PreflightRoute;
  readonly database: RuntimeStateDatabase;
}): Promise<Awaited<ReturnType<typeof prepareRuntimeState>>> =>
  prepareRuntimeState(
    {
      ...statePreparationInputFor({
        state: input.state,
        route: input.route,
        repoRoot: input.setup.repoRoot,
      }),
      databaseUrl: input.setup.databaseUrl,
    },
    input.database,
    (() => undefined) satisfies RuntimeStateResetter,
  );

const assertPreparedStateObservation = (
  state: CampaignMatrixState,
  prepared: Awaited<ReturnType<typeof prepareRuntimeState>>,
): void => {
  if (prepared.observation.matches) return;
  throw new Error(
    `State oracle mismatch before preflight navigation for ${state.stateId}: ${JSON.stringify(prepared.observation.mismatches)}`,
  );
};

type PreflightPreparationContext = Readonly<{
  readonly setup: PreflightRuntimeSetupInput;
  readonly database: RuntimeStateDatabase;
  readonly sessionsByProfile: ProfileSessionRegistry;
  readonly awaitApiDrain: () => Promise<void>;
}>;

const isReadOnlyPreparation = (state: CampaignMatrixState): boolean =>
  state.axes.fault === "none" && state.axes.controlTransition === "none";

const preparedStateFor = async (input: {
  readonly context: PreflightPreparationContext;
  readonly cache: PreparedStateCache;
  readonly state: CampaignMatrixState;
  readonly route: PreflightRoute;
  readonly preparationKey: string;
  readonly reusable: boolean;
}): Promise<PreparedRuntimeState> => {
  const cached = input.cache.prepared;
  if (cached?.key === input.preparationKey) {
    try {
      // quiescePreflightStatePage has drained tracked API work immediately
      // before this call. Never navigate or inventory against an unverified
      // cached database baseline.
      await assertPreparedStateUnchanged({
        database: input.context.database,
        prepared: cached.prepared,
        phase: "before navigation",
      });
    } catch (error: unknown) {
      if (input.cache.prepared === cached) input.cache.prepared = undefined;
      throw error;
    }
    return cached.prepared;
  }
  const prepared = await prepareStateForPreflight({
    setup: input.context.setup,
    state: input.state,
    route: input.route,
    database: input.context.database,
  });
  assertPreparedStateObservation(input.state, prepared);
  input.cache.prepared = input.reusable
    ? { key: input.preparationKey, prepared }
    : undefined;
  return prepared;
};

const clearCacheForChangedPreparation = (
  cache: PreparedStateCache,
  input: Readonly<{
    readonly resetRequired: boolean;
    readonly reusable: boolean;
    readonly preparationKey: string;
  }>,
): void => {
  if (
    input.resetRequired ||
    !input.reusable ||
    (cache.prepared !== undefined &&
      cache.prepared.key !== input.preparationKey)
  )
    cache.prepared = undefined;
};

const quiescePreflightSetup = (
  setup: PreflightRuntimeSetupInput,
  awaitApiDrain: () => Promise<void>,
): Promise<void> =>
  quiescePreflightStatePage(
    setup.page,
    () => clearClientStorage(setup.page),
    awaitApiDrain,
  );

const selectPreflightActor = async (input: {
  readonly setup: PreflightRuntimeSetupInput;
  readonly sessions: PreflightSessionCache;
  readonly actor: RuntimeMatrixActor;
  readonly awaitApiDrain: () => Promise<void>;
}): Promise<void> => {
  await input.sessions.use(input.actor);
  await quiescePreflightSetup(input.setup, input.awaitApiDrain);
};

const preparePreflightState = async (input: {
  readonly context: PreflightPreparationContext;
  readonly cache: PreparedStateCache;
  readonly state: CampaignMatrixState;
  readonly route: PreflightRoute;
  readonly groupChanged: boolean;
}): Promise<RevealPreparation> => {
  const { setup, awaitApiDrain, sessionsByProfile } = input.context;
  await quiescePreflightSetup(setup, awaitApiDrain);
  const profileSessions = await sessionsByProfile.get(input.state.profile);
  const resetRequired = input.groupChanged || profileSessions.created;
  const preparationKey = preflightPreparationKeyFor({
    source: setup.source,
    state: input.state,
    route: input.route,
    databaseUrl: setup.databaseUrl,
    repoRoot: setup.repoRoot,
  });
  const reusable = isReadOnlyPreparation(input.state);
  clearCacheForChangedPreparation(input.cache, {
    resetRequired,
    reusable,
    preparationKey,
  });
  const actors = actorsForProfile(setup.source, input.state.profile);
  if (resetRequired)
    await resetProfileSessions({
      setup,
      profile: input.state.profile,
      actors,
      sessions: profileSessions,
      clearPage: () => clearClientStorage(setup.page),
      awaitApiDrain,
    });
  await selectPreflightActor({
    setup,
    sessions: profileSessions.cache,
    actor: actorForPermission(input.state.axes.permission, input.route.role),
    awaitApiDrain,
  });
  const prepared = await preparedStateFor({
    context: input.context,
    cache: input.cache,
    state: input.state,
    route: input.route,
    preparationKey,
    reusable,
  });
  return {
    proveNonMutation: async (action, timing) => {
      try {
        return await provePreparedStateNonMutation({
          database: input.context.database,
          prepared,
          settle: awaitApiDrain,
          action,
          ...(timing === undefined ? {} : { timing }),
        });
      } catch (error: unknown) {
        if (
          input.cache.prepared?.key === preparationKey &&
          input.cache.prepared.prepared === prepared
        )
          input.cache.prepared = undefined;
        throw error;
      }
    },
  };
};

const recreateDisposableBoundaryFor = async (input: {
  readonly setup: PreflightRuntimeSetupInput;
  readonly prepare: PreflightRuntimePreparation;
}): Promise<void> => {
  const boundaryState = input.setup.source.plan.states.at(0);
  if (boundaryState === undefined)
    throw new Error("Preflight source has no state for boundary recreation");
  await input.prepare(
    boundaryState,
    routeForState(input.setup.source, boundaryState),
    true,
  );
};

export const createPreflightPreparation = (
  context: PreflightPreparationContext,
): PreflightRuntimePreparationWithBoundary => {
  const cache: PreparedStateCache = { prepared: undefined };
  const prepare: PreflightRuntimePreparation = (state, route, groupChanged) =>
    preparePreflightState({
      context,
      cache,
      state,
      route,
      groupChanged,
    });
  const recreateDisposableBoundary = (): Promise<void> =>
    recreateDisposableBoundaryFor({ setup: context.setup, prepare });
  return Object.assign(prepare, { recreateDisposableBoundary });
};

export { resetProfileSessions } from "./preflight-profile-session-reset.ts";
export type { PreflightRuntimePreparationWithBoundary } from "./preflight-runtime-preparation-contract.ts";
