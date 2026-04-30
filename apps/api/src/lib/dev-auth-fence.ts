/**
 * AUTH-01 (Phase 29-04): boot-time fence (CC-2 fail-closed).
 *
 * Refuses to start the API in `NODE_ENV=production` whenever either dev-auth
 * env switch is active. This is a configuration-time check (verified once at
 * boot, can't be bypassed mid-request). Mitigates the worst case: an ops
 * mis-config promoting a dev session into prod, with every user becoming
 * `head` via the `DEV_SESSION` fallback in `trpc.context.ts`.
 *
 * The fence is intentionally narrow:
 *  - Throws on `NODE_ENV==='production'` only — dev/test/staging are unaffected.
 *  - Considers both `AUTH_DEV_MODE` (legacy) and `AUTH_DEV_MODE_ALLOW_TEST`
 *    (Phase 28 staged switch) — both must be off in production.
 *  - Symmetric handling: either flag → throw, neither → pass through.
 */
export function assertNoDevAuthInProduction(env: NodeJS.ProcessEnv): void {
  if (env['NODE_ENV'] !== 'production') return;
  const devMode = env['AUTH_DEV_MODE'] === 'true';
  const allowTest = env['AUTH_DEV_MODE_ALLOW_TEST'] === 'true';
  if (devMode || allowTest) {
    throw new Error(
      'AUTH_DEV_MODE refused outside test/dev — set NODE_ENV=development to use dev auth, or unset both AUTH_DEV_MODE and AUTH_DEV_MODE_ALLOW_TEST in production.',
    );
  }
}
