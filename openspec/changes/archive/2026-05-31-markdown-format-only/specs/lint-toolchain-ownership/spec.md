## ADDED Requirements

### Requirement: Markdown is formatted, not linted

The system MUST format Markdown with Prettier and MUST NOT lint it. The
lint-staged `*.md` entry MUST run `prettier --write` (the same treatment as
`*.{yml,yaml}`), and markdownlint MUST be removed entirely: no
`markdownlint-cli2` dependency, no `.markdownlint.json`, and no `lint:md` /
`lint:md:fix` scripts. Dropping markdownlint intentionally forgoes its
structural checks; Markdown is a background-formatted artifact and MUST NOT
block a commit with lint errors.

#### Scenario: markdown is auto-formatted on commit

- **WHEN** a contributor commits a `*.md` file with non-canonical formatting
- **THEN** the lint-staged `*.md` hook runs `prettier --write` and normalizes it
- **AND** no markdownlint error is produced (markdownlint is not installed)

#### Scenario: no markdownlint surface remains

- **WHEN** the repository tooling is inspected
- **THEN** `package.json` contains no `markdownlint-cli2` dependency and no
  `lint:md`/`lint:md:fix` scripts
- **AND** no `.markdownlint.json` file exists
- **AND** Prettier remains the owner of both `*.{yml,yaml}` and `*.md`
