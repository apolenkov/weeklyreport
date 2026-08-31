# Report persistence

`@customreport/report-persistence` is the server-only Prisma boundary for
report sections and immutable published snapshots. It owns the canonical
Prisma include graph, row-to-read-model mapper, status derivation, and snapshot
assembly used by the API and database seeds.

This package depends on `@customreport/shared` for browser-safe schemas and
never contains UI or transport code. The API supplies the generated Prisma
client at runtime; seeds use the same source through the workspace package.
`@prisma/client` is therefore an explicit peer. The package's two type-only
development dependencies keep pnpm on the same generated-client peer instance
as the root Prisma tooling and the API; a second ungenerated client instance
must never appear.

The package is intentionally source-only: it has no standalone build artifact.
Its unit tests live beside the persistence rules and run through the workspace
`test` task. The API production compiler embeds this source under
`apps/api/dist/packages/report-persistence/src`, and its production ESM gate
rewrites the internal package imports to those embedded files. This keeps one
runtime copy and prevents a stale package distribution from diverging from the
API release.
