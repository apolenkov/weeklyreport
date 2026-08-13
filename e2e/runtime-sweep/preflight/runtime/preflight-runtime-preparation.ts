import { reseedE2eDatabase } from "../../../helpers/e2e-database-setup.ts";
import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import {
  actorForPermission,
  type RuntimeMatrixActor,
} from "../../matrix/runtime-matrix.ts";
import { clearClientStorage } from "../../replay/browser-state/client-storage.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
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
import type { PreflightRuntimeSetupInput } from "./preflight-runtime-setup.ts";
import {
  createProfileSessionCacheRegistry,
  quiescePreflightStatePage,
} from "./preflight-session.ts";

const actorsForProfile = (
  source: SourceArtifact,
  profile: CampaignMatrixState["profile"],
): readonly RuntimeMatrixActor[] =>
  source.plan.states
    .filter((candidate) => candidate.profile === profile)
    .map(({ axes }) => actorForPermission(axes.permission, axes.role));

type ProfileSessionRegistry = ReturnType<
  typeof createProfileSessionCacheRegistry<CampaignMatrixState["profile"]>
>;

export const resetProfileSessions = async (input: {
  readonly setup: PreflightRuntimeSetupInput;
  readonly profile: CampaignMatrixState["profile"];
  readonly actors: readonly RuntimeMatrixActor[];
  readonly sessions: Awaited<
    ReturnType<
      ReturnType<
        typeof createProfileSessionCacheRegistry<CampaignMatrixState["profile"]>
      >["get"]
    >
  >;
  readonly clearPage: () => Promise<void>;
  readonly awaitApiDrain: () => Promise<void>;
}): Promise<void> => {
  reseedE2eDatabase({
    databaseUrl: input.setup.databaseUrl,
    profile: input.profile,
    repoRoot: input.setup.repoRoot,
  });
  if (input.sessions.created) {
    await input.sessions.cache.authenticate(input.actors);
  } else {
    await input.sessions.cache.reauthenticate(input.actors);
  }
  await quiescePreflightStatePage(
    input.setup.page,
    input.clearPage,
    input.awaitApiDrain,
  );
};

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

type PreflightRuntimePreparation = (
  state: CampaignMatrixState,
  route: PreflightRoute,
  groupChanged: boolean,
) => Promise<RevealPreparation>;

export type PreflightRuntimePreparationWithBoundary =
  PreflightRuntimePreparation &
    Readonly<{
      readonly recreateDisposableBoundary: () => Promise<void>;
    }>;

type PreflightPreparationContext = Readonly<{
  readonly setup: PreflightRuntimeSetupInput;
  readonly database: RuntimeStateDatabase;
  readonly sessionsByProfile: ProfileSessionRegistry;
  readonly awaitApiDrain: () => Promise<void>;
}>;

interface PreparedStateCache {
  prepared:
    | Readonly<{
        readonly key: string;
        readonly prepared: PreparedRuntimeState;
      }>
    | undefined;
}

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

const preparePreflightState = async (input: {
  readonly context: PreflightPreparationContext;
  readonly cache: PreparedStateCache;
  readonly state: CampaignMatrixState;
  readonly route: PreflightRoute;
  readonly groupChanged: boolean;
}): Promise<RevealPreparation> => {
  const { setup, awaitApiDrain, sessionsByProfile } = input.context;
  await quiescePreflightStatePage(
    setup.page,
    () => clearClientStorage(setup.page),
    awaitApiDrain,
  );
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
  const prepared = await preparedStateFor({
    context: input.context,
    cache: input.cache,
    state: input.state,
    route: input.route,
    preparationKey,
    reusable,
  });
  await profileSessions.cache.use(
    actorForPermission(input.state.axes.permission, input.route.role),
  );
  return {
    proveNonMutation: async (action: () => Promise<void>) => {
      try {
        return await provePreparedStateNonMutation({
          database: input.context.database,
          prepared,
          settle: awaitApiDrain,
          action,
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
