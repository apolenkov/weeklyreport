/** A repository test with an explicit execution owner. */
export interface RepositoryTestManifestEntry {
  readonly path: string;
  readonly owner: string;
}

/**
 * Tests which are not covered by an existing lint-owned package script.
 *
 * The discovery check also includes its own planted probes. Keeping those
 * probes in this manifest means the manifest validates the same shape that
 * the aggregate runner executes.
 */
export const REPOSITORY_TEST_MANIFEST: readonly RepositoryTestManifestEntry[] =
  [
    {
      path: "scripts/eslint/policy/eslint-policy-scope-ledger-schema.test.ts",
      owner: "eslint-policy-ledger",
    },
    {
      path: "scripts/eslint/suppression/eslint-suppression-ledger-schema.test.ts",
      owner: "eslint-suppression-ledger",
    },
    {
      path: "scripts/gates/operations/prod-compose-gate.test.ts",
      owner: "production-compose",
    },
    {
      path: "scripts/gates/operations/restore-guard.test.ts",
      owner: "postgres-restore",
    },
    {
      path: "scripts/gates/repository-tests/discovery.test.ts",
      owner: "repository-test-discovery",
    },
    {
      path: "scripts/shared/repo-root.test.ts",
      owner: "shared-repo-root",
    },
  ];
