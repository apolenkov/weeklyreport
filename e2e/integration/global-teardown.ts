/**
 * Intentionally a no-op.
 *
 * The next run's globalSetup performs `migrate reset --force`, which drops the
 * schema, so post-run cleanup is unnecessary and only slows down local re-runs.
 */
export default async function globalTeardown(): Promise<void> {
  // no-op
}
