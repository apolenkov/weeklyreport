import type { Cookie } from "@playwright/test";

import {
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
} from "../../../../packages/shared/src/index.ts";
import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import {
  actorForPermission,
  type RuntimeMatrixActor,
  runtimeStateGroupKey,
} from "../../matrix/runtime-matrix.ts";
import type { RouteBindingTarget } from "../../source/contracts.ts";
import { MAX_REVEAL_DEPTH } from "../reveal-path.ts";

type PreflightGroupRoute = Readonly<{
  readonly role: CampaignMatrixState["axes"]["role"];
  readonly target: RouteBindingTarget;
}>;

const preflightStateGroupKey = (
  state: CampaignMatrixState,
  route: PreflightGroupRoute,
): string => runtimeStateGroupKey(state.profile, route.target);

export const preflightSessionGroupKey = (
  state: CampaignMatrixState,
  route: PreflightGroupRoute,
): string => {
  const actor = actorForPermission(state.axes.permission, route.role);
  return [
    preflightStateGroupKey(state, route),
    actor.role ?? "anonymous",
    actor.email ?? "anonymous",
  ].join(":");
};

export interface PreflightCookieContext {
  readonly clearCookies: () => Promise<void>;
  readonly cookies: () => Promise<readonly Cookie[]>;
  readonly addCookies: (cookies: readonly Cookie[]) => Promise<void>;
}

interface PreflightPageQuiescer {
  readonly goto: (
    url: "about:blank",
    options: Readonly<{ waitUntil: "domcontentloaded" }>,
  ) => Promise<unknown>;
}

export interface PreflightStatePageQuiescer extends PreflightPageQuiescer {
  readonly url: () => string;
}

type AuthenticatedActor = RuntimeMatrixActor &
  Readonly<{ readonly role: NonNullable<RuntimeMatrixActor["role"]> }>;

export interface PreflightSessionCache {
  readonly authenticate: (
    actors: readonly RuntimeMatrixActor[],
  ) => Promise<void>;
  readonly reauthenticate: (
    actors: readonly RuntimeMatrixActor[],
  ) => Promise<void>;
  readonly use: (actor: RuntimeMatrixActor) => Promise<void>;
}

type ProfileSessionCacheResult = Readonly<{
  cache: PreflightSessionCache;
  created: boolean;
}>;

export interface ProfileSessionCacheRegistry<Profile extends string> {
  readonly get: (profile: Profile) => Promise<ProfileSessionCacheResult>;
}

export const preflightGroupNeedsReset = (
  preparedGroup: string | undefined,
  nextGroup: string,
  sessionsCreated: boolean,
): boolean => sessionsCreated || preparedGroup !== nextGroup;

async function quiescePreflightPage(
  page: PreflightPageQuiescer,
): Promise<void> {
  await page.goto("about:blank", { waitUntil: "domcontentloaded" });
}

export async function quiescePreflightStatePage(
  page: PreflightStatePageQuiescer,
  clearClientStorage: () => Promise<void>,
  awaitApiDrain: () => Promise<void>,
): Promise<void> {
  if (page.url() !== "about:blank") await clearClientStorage();
  await quiescePreflightPage(page);
  await awaitApiDrain();
}

class PreflightSessionError extends Error {
  override readonly name = "PreflightSessionError";
}

const SESSION_COOKIE_NAME = "customreport_session";
// Each possible reveal step receives one minute for action and settle budgets;
// one additional minute covers initial navigation and inventory.
const SESSION_REFRESH_SAFETY_SECONDS =
  (MAX_REVEAL_DEPTH + 1) * SECONDS_PER_MINUTE;

type CachedActorSession = Readonly<{
  readonly cookies: readonly Cookie[];
  readonly expiresAtSeconds: number;
}>;

type PreflightSessionCacheOptions = Readonly<{
  readonly nowSeconds?: () => number;
}>;

const actorKey = (actor: RuntimeMatrixActor): string =>
  [
    actor.id ?? "anonymous",
    actor.role ?? "anonymous",
    actor.email ?? "anonymous",
  ].join(":");

const uniqueActors = (
  actors: readonly RuntimeMatrixActor[],
): readonly RuntimeMatrixActor[] => [
  ...new Map(actors.map((actor) => [actorKey(actor), actor] as const)).values(),
];

const sessionCookies = (cookies: readonly Cookie[]): readonly Cookie[] =>
  cookies
    .filter((cookie) => cookie.name === SESSION_COOKIE_NAME)
    .map((cookie) => ({ ...cookie }));

const sessionExpiryFor = (cookies: readonly Cookie[]): number | null => {
  const expirations = cookies.map(({ expires }) => expires);
  if (
    expirations.length === 0 ||
    expirations.some((expires) => !Number.isFinite(expires) || expires < 0)
  )
    return null;
  return Math.min(...expirations);
};

const sessionNeedsRefresh = (
  session: CachedActorSession,
  nowSeconds: number,
): boolean =>
  session.expiresAtSeconds <= nowSeconds + SESSION_REFRESH_SAFETY_SECONDS;

const isAuthenticatedActor = (
  actor: RuntimeMatrixActor,
): actor is AuthenticatedActor => actor.role !== null;

const authenticateActorSession = async (input: {
  readonly context: PreflightCookieContext;
  readonly login: (actor: AuthenticatedActor) => Promise<void>;
  readonly sessions: Map<string, CachedActorSession>;
  readonly actor: AuthenticatedActor;
}): Promise<CachedActorSession> => {
  const key = actorKey(input.actor);
  input.sessions.delete(key);
  await input.context.clearCookies();
  try {
    await input.login(input.actor);
    const cookies = sessionCookies(await input.context.cookies());
    if (cookies.length === 0)
      throw new PreflightSessionError(
        `Login for role ${input.actor.role} did not produce a session cookie`,
      );
    const expiresAtSeconds = sessionExpiryFor(cookies);
    if (expiresAtSeconds === null)
      throw new PreflightSessionError(
        `Login for role ${input.actor.role} did not produce an expiring session cookie`,
      );
    const session = { cookies, expiresAtSeconds };
    input.sessions.set(key, session);
    return session;
  } catch (error: unknown) {
    input.sessions.delete(key);
    await input.context.clearCookies();
    throw error;
  }
};

const requiredSessionTime = (nowSeconds: () => number): number => {
  const currentTimeSeconds = nowSeconds();
  if (!Number.isFinite(currentTimeSeconds) || currentTimeSeconds < 0)
    throw new PreflightSessionError(
      "Preflight session clock must return non-negative epoch seconds",
    );
  return currentTimeSeconds;
};

const refreshActorSession = async (input: {
  readonly actor: AuthenticatedActor;
  readonly authenticate: (
    actor: AuthenticatedActor,
  ) => Promise<CachedActorSession>;
  readonly nowSeconds: () => number;
}): Promise<CachedActorSession> => {
  const session = await input.authenticate(input.actor);
  const refreshedAtSeconds = requiredSessionTime(input.nowSeconds);
  if (!sessionNeedsRefresh(session, refreshedAtSeconds)) return session;
  throw new PreflightSessionError(
    `Refreshed session for role ${input.actor.role} remains inside the replay safety window`,
  );
};

const installActorSession = async (input: {
  readonly actor: AuthenticatedActor;
  readonly context: PreflightCookieContext;
  readonly sessions: Map<string, CachedActorSession>;
  readonly nowSeconds: () => number;
  readonly refresh: (actor: AuthenticatedActor) => Promise<CachedActorSession>;
}): Promise<void> => {
  const key = actorKey(input.actor);
  try {
    const cached = input.sessions.get(key);
    if (cached === undefined)
      throw new PreflightSessionError(
        `No cached session exists for role ${input.actor.role}`,
      );
    const refresh = sessionNeedsRefresh(
      cached,
      requiredSessionTime(input.nowSeconds),
    );
    const session = refresh ? await input.refresh(input.actor) : cached;
    if (refresh) await input.context.clearCookies();
    await input.context.addCookies(session.cookies);
  } catch (error: unknown) {
    input.sessions.delete(key);
    await input.context.clearCookies();
    throw error;
  }
};

export function createProfileSessionCacheRegistry<Profile extends string>(
  create: (profile: Profile) => Promise<PreflightSessionCache>,
): ProfileSessionCacheRegistry<Profile> {
  const caches = new Map<Profile, PreflightSessionCache>();
  return {
    async get(profile) {
      const cached = caches.get(profile);
      if (cached !== undefined) return { cache: cached, created: false };
      const cache = await create(profile);
      caches.set(profile, cache);
      return { cache, created: true };
    },
  };
}

export function createPreflightSessionCache(
  context: PreflightCookieContext,
  login: (actor: AuthenticatedActor) => Promise<void>,
  options: PreflightSessionCacheOptions = {},
): PreflightSessionCache {
  const cookiesByActor = new Map<string, CachedActorSession>();
  const state = { initialized: false };
  const nowSeconds = options.nowSeconds ?? (() => Date.now() / MS_PER_SECOND);

  const authenticateActor = (actor: AuthenticatedActor) =>
    authenticateActorSession({
      context,
      login,
      sessions: cookiesByActor,
      actor,
    });

  const authenticateActors = async (
    actors: readonly RuntimeMatrixActor[],
  ): Promise<void> => {
    // A destructive profile reset can remove a section referenced by a JWT.
    // Drop every old cookie before rebuilding the set so a partial login never
    // falls back to a token from the previous database incarnation.
    cookiesByActor.clear();
    for (const actor of uniqueActors(actors)) {
      if (!isAuthenticatedActor(actor)) continue;
      await authenticateActor(actor);
    }
    state.initialized = true;
    await context.clearCookies();
  };

  return {
    async authenticate(actors) {
      if (state.initialized)
        throw new PreflightSessionError(
          "Session cache was already initialized",
        );
      await authenticateActors(actors);
    },
    async reauthenticate(actors) {
      if (!state.initialized)
        throw new PreflightSessionError(
          "Cannot reauthenticate sessions before authentication completes",
        );
      await authenticateActors(actors);
    },
    async use(actor) {
      if (!state.initialized)
        throw new PreflightSessionError(
          "Cannot use sessions before authentication completes",
        );

      await context.clearCookies();
      if (!isAuthenticatedActor(actor)) return;
      await installActorSession({
        actor,
        context,
        sessions: cookiesByActor,
        nowSeconds,
        refresh: (selected) =>
          refreshActorSession({
            actor: selected,
            authenticate: authenticateActor,
            nowSeconds,
          }),
      });
    },
  };
}
