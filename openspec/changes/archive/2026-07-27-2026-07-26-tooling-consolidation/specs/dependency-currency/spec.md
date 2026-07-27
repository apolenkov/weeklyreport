## MODIFIED Requirements

### Requirement: One declaration per dependency

A dependency declared by more than one workspace manifest MUST resolve through a
single `catalog:` entry in `pnpm-workspace.yaml` rather than through a range
repeated per manifest. Repeated ranges drift, and two ranges for one library can
resolve into two copies inside one process — which is not a style problem when
the library passes data through React context, because two copies mean two
different contexts.

Cross-manifest agreement is therefore enforced by the package manager at install
time, and the runtime-sync script MUST NOT re-implement that check. It reads the
single catalog declaration instead.

#### Scenario: A library is needed by two workspaces

- **WHEN** two workspace manifests both depend on the same library
- **THEN** each declares it as `catalog:` and the version lives once in
  `pnpm-workspace.yaml`

#### Scenario: The composite lint runs the typed gates

- **WHEN** `pnpm lint` runs
- **THEN** it runs the Prisma, scripts and e2e typecheck projects and the
  `lint:ssot-gate` sweep, so a type error or a vocabulary re-declaration in any
  of those trees fails the composite
