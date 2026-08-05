import type { Cookie } from "@playwright/test";

import type { RuntimeMatrixActor } from "./runtime-matrix.ts";

export interface PreflightCookieContext {
  readonly clearCookies: () => Promise<void>;
  readonly cookies: () => Promise<readonly Cookie[]>;
  readonly addCookies: (cookies: readonly Cookie[]) => Promise<void>;
}

type AuthenticatedActor = RuntimeMatrixActor &
  Readonly<{ readonly role: NonNullable<RuntimeMatrixActor["role"]> }>;

export interface PreflightSessionCache {
  readonly authenticate: (
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

  return {
    async authenticate(actors) {
      if (state.initialized)
        throw new PreflightSessionError(
          "Session cache was already initialized",
        );

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
