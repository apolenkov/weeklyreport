# cleanup-tail Specification

## Purpose

Governs cosmetic and dead-code cleanups whose only behavioral member is dev-only HMR log-stacking: comments carry no ticket or change-name prefixes, a schema field's wire contract matches its read path, an invariant comment matches the code at its use site, a dev-only console patch survives Fast Refresh without stacking, a view-model field with no real data source is not silently inert, CSS overrides target stable selectors, and no dead custom properties or orphan wrapper classes remain.

## Requirements

### Requirement: Comments Carry No Change-Name Or Ticket Prefix, Regardless Of Case

A source comment MUST NOT open with a change-name or ticket-style prefix
(e.g. `refactor-auth-exemplary-layering:`, `Phase 35-08`, `UFB-036`),
regardless of whether the prefix is uppercase-ticket-style or
lowercase-kebab-case. Load-bearing rationale is kept, rewritten without the
prefix.

#### Scenario: A lowercase-kebab change-name prefix is removed

- **WHEN** `apps/api/src/lib/env.ts`'s `requireEnv` docblock is inspected
- **THEN** it carries no `refactor-auth-exemplary-layering:` (or similar
  kebab-case change-name) prefix
- **AND** the underlying rationale for `requireEnv` being a bare
  presence-check helper is still documented

### Requirement: A Schema Field's Wire Contract Matches What The Write Path Reads

A Zod schema field MUST NOT accept a value the corresponding write path
ignores. When a write path hardcodes a value instead of reading it from the
parsed payload, the schema field MUST be narrowed to a literal matching that
hardcoded value (or removed), not left accepting a wider range that implies
false client control.

#### Scenario: `draftSaveSchema.status` matches what `saveDraft` writes

- **WHEN** `draftSaveSchema` is inspected alongside the `saveDraft` write
  path
- **THEN** either `status` is narrowed to the literal value `saveDraft`
  actually writes, or the field is removed if no consumer needs it in the
  payload

### Requirement: A Code Comment's Invariant Claim Matches The Code At Its Own Use Site

A comment asserting a structural invariant about a prop/value MUST be true at every use site in the same file.

For example, a comment claiming "never read in any deps array" that is
contradicted by code visible in the same file MUST be rewritten to describe
the real constraint.

#### Scenario: The risk-edit-dialog comment matches its own hook call

- **WHEN** `risk-edit-dialog.tsx`'s docblock comment about `stagesForProduct`
  is read alongside `useRiskEditDialog`'s actual invocation in the same file
- **THEN** the comment's claim is true of that invocation
- **AND** it describes the real constraint (mount-time snapshot via the
  remount pattern), not a claim the file's own code contradicts

### Requirement: A Dev-Only Console Patch Survives Fast Refresh Without Stacking

`installClientLogger`'s guard against re-installing its console patch MUST survive a Fast Refresh module re-instantiation.

A module-level variable that resets on Fast Refresh MUST NOT be the sole
guard against re-wrapping an already-wrapped `console.error` /
`console.warn`.

#### Scenario: A second install call during HMR does not double-wrap console

- **WHEN** `installClientLogger()` is called a second time after a Fast
  Refresh module re-instantiation, with `console.error` already wrapped by
  the first call
- **THEN** `console.error` is not wrapped a second time
- **AND** a subsequent `console.error(...)` call produces exactly one
  forwarded log entry, not two

### Requirement: A View-Model Field With No Real Data Source Is Not Silently Inert

A presentation view-model field MUST either be fed by a real data source, or
be explicitly marked deferred (`ComingSoonBadge` per `deferred-feature-pattern`),
or be removed. It MUST NOT be permanently hardcoded to an empty/placeholder
value with a live mapper chain behind it that no caller ever exercises with
real data.

#### Scenario: The dashboard archive field is resolved one way or the other

- **WHEN** `dashboard-page.tsx`'s `archive` field composition is inspected
- **THEN** it either feeds `mapArchiveSummary`/`ArchiveReport` from the real
  `archive.list` query, is marked `ComingSoonBadge`-deferred, or the dead
  mapper chain is removed — not left hardcoded to an always-empty input with
  no UI consumer

### Requirement: A CSS Override Targets A Stable Selector, Not A Build-Hashed Class

A CSS rule overriding a third-party or generated component's styling MUST target a stable selector, not a hashed CSS-module class name that changes on rebuild.

The stable selector is a `data-*` attribute or an explicitly-authored class,
never a build-generated hash.

#### Scenario: The agentation devtools override survives a rebuild

- **WHEN** the CSS-module package producing the agentation toolbar is
  rebuilt (regenerating its hashed class names)
- **THEN** `app.css`'s override still applies, because it targets a stable
  `data-*` attribute rather than the rebuilt hash

### Requirement: No Dead CSS Custom Properties Or Orphan Wrapper Classes Remain

A CSS custom property MUST have at least one consumer in the same
stylesheet (or be removed), and a class referenced from a component MUST
have a matching CSS rule in the stylesheet it's documented to belong to (or
the component reference is removed).

#### Scenario: `pulse.css` carries no dead var or orphan wrapper

- **WHEN** `pulse.css` and `pulse-mark.tsx` are inspected together
- **THEN** every custom property declared in `pulse.css` has a consumer in
  that file
- **AND** every class `pulse-mark.tsx` references from `pulse.css` has a
  matching rule

### Requirement: The 2026-07-22 Needs-Attention Minor Tail Is Cleared To Good, Not Tolerated

The cleanup backlog MUST record that the 2026-07-22 mass review graded 125
files **needs-attention**, that the 38 confirmed **major** findings on those
files are owned by the seven sibling `fix-*` / `harden-*` changes committed
that day, and that the residual **215 minor findings across 112 files** (the
13 majors-only files carry no minor) are cleared to **good** by the
`needs-attention-to-good` campaign — each minor either fixed or explicitly
re-graded as a non-issue against live code, never left standing. The
authoritative per-file, per-finding backlog is
`files-seed.json` in that change; findings are dated 2026-07-22 and each
`line` is re-resolved against current code before action.

#### Scenario: A listed needs-attention file still reads needs-attention on a minor this campaign owns

- **WHEN** the final control re-grade re-reviews one of the 112 files and a
  minor finding recorded in `files-seed.json` still reproduces against live
  code
- **THEN** that file is not considered cleared — the minor MUST be fixed, or
  a written justification recorded re-grading it as a non-issue — a minor
  from this frozen set may not be silently left as needs-attention

#### Scenario: A finding no longer reproduces because a sibling fix rewrote the line

- **WHEN** a minor's review-SHA line was rewritten by one of the seven
  `fix-*` / `harden-*` changes (or by another slice of this campaign) so the
  finding no longer holds
- **THEN** the finding is closed as a **stale re-grade** with that reason
  recorded, not counted as a fix and not reopened as new work
