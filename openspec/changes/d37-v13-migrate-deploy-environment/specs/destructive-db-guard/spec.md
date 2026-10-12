# Spec Delta

## MODIFIED Requirements

### Requirement: Block on NODE_ENV=production

The guard MUST refuse when `NODE_ENV === "production"`, regardless of `DATABASE_URL`. No environment variable may bypass this refusal for disposable-database workflows. A guarded migration child MUST receive the same resolved environment snapshot used for this check; inherited production MUST NOT escape validation when the supplied input omits NODE_ENV. The migration wrapper MUST retain its existing explicit input requirements for DATABASE_URL and per-run consent.

Consumer surface: `prisma/guards/_destructive-guard.ts` —
`assertE2eRuntimeDestructiveTarget`.

#### Scenario: Production environment variable is set

- **WHEN** `NODE_ENV` is `"production"` and `DATABASE_URL` points to any database
- **THEN** the disposable-database guard throws before destructive work and MUST NOT advertise a bypass

#### Scenario: Migration input omits an inherited production value

- **WHEN** the supplied migration input omits NODE_ENV and the child would inherit production
- **THEN** the wrapper refuses before invoking the migration child

#### Scenario: Explicit safe migration environment overrides the parent

- **WHEN** the parent environment is production and the supplied migration input explicitly sets a non-production environment with an authorized target and consent
- **THEN** the resolved child environment carries that same explicit non-production value and passes the existing guard

#### Scenario: Injected migration safety input is absent

- **WHEN** the supplied migration input omits DATABASE_URL or per-run consent even though the parent has a value
- **THEN** the wrapper retains its existing refusal before invoking the child
