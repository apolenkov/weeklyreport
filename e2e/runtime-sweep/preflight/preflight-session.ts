import type { Cookie } from "@playwright/test";

import type { CampaignMatrixState } from "../matrix/campaign-matrix.ts";
import {
  actorForPermission,
  type RuntimeMatrixActor,
  runtimeStateGroupKey,
} from "../matrix/runtime-matrix.ts";
import type { RouteBindingTarget } from "../source/contracts.ts";

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

const isAuthenticatedActor = (
  actor: RuntimeMatrixActor,
): actor is AuthenticatedActor => actor.role !== null;

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
): PreflightSessionCache {
  const cookiesByActor = new Map<string, readonly Cookie[]>();
  const state = { initialized: false };

  const authenticateActors = async (
    actors: readonly RuntimeMatrixActor[],
  ): Promise<void> => {
    // A destructive profile reset can remove a section referenced by a JWT.
    // Drop every old cookie before rebuilding the set so a partial login never
    // falls back to a token from the previous database incarnation.
    cookiesByActor.clear();
    for (const actor of uniqueActors(actors)) {
      if (!isAuthenticatedActor(actor)) continue;
      await context.clearCookies();
      await login(actor);
      const cookies = sessionCookies(await context.cookies());
      if (cookies.length === 0)
        throw new PreflightSessionError(
          `Login for role ${actor.role} did not produce a session cookie`,
        );
      cookiesByActor.set(actorKey(actor), cookies);
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
      if (actor.role === null) return;

      const cookies = cookiesByActor.get(actorKey(actor));
      if (cookies === undefined)
        throw new PreflightSessionError(
          `No cached session exists for role ${actor.role}`,
        );
      await context.addCookies(cookies);
    },
  };
}
