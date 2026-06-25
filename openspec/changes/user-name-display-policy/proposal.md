## Why

A user's name renders in three forms — full «Иванов Василий Петрович», short
«Иванов В.П.», and the two-letter mark «ИВ» — but the forms are applied
inconsistently. On one SDLC pipeline a lead sees their OWN stage owners as the
full ФИО and a CROSS-AUTHOR's stage owner as the two-letter mark; the slides, the
leads summary table, and the dashboard escalations show the full ФИО. Three
conventions collide on a single screen. The product owner's rule: the full ФИО is
for the user's own top badge only; everywhere a name is spelled out as a label,
use the short form; keep the two-letter mark for round avatars and the tightest
inline marks.

## What Changes

- Adopt one display form per surface (see ADR 0006 and the `User name (ФИО)`
  glossary entry):
  - **full ФИО** — ONLY the user's own top navigation badge;
  - **two-letter mark** — round avatar chips and the item-row stage micro-chip;
  - **short form** — every spelled-out name label: SDLC stage owners (own AND
    cross-author), slide owners + contributors, the leads summary table,
    cross-author content authors, dashboard escalation assignees.
- Add a shared `shortNameFromName(name)` helper (surname + dotted initials from a
  denormalized name string) — most display sites carry only the `name` string.
- Reverse, narrowly, the cross-author STATUS read's "the full name never leaves
  the method" stance: `getCrossAuthors` now also returns `authorShortName` so the
  cross-author stage label can render «Кузнецова М.А.» instead of «КМ». Only the
  short form (surname + initials) leaves the server; the full ФИО never does.

Net effect: the full ФИО shows in exactly one place; every other name label is
the short form; avatars and micro-chips keep the two-letter mark.
