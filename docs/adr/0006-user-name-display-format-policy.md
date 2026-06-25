# User-name display-format policy (full ФИО vs short vs two-letter)

**Status:** accepted

## Context

A user's name has three render forms derived from the structured ФИО parts (see
the `structured-user-name` spec and the `User name (ФИО)` glossary entry):

- **full** — «Иванов Василий Петрович» (`composeName` / the stored `name`);
- **short** — «Иванов В.П.» (surname + dotted initials; `shortName` from parts,
  or `shortNameFromName` from a plain name string);
- **two-letter mark** — «ИВ» (`initials` / `initialsFromName`).

These were applied inconsistently: the SDLC pipeline showed a lead's OWN stage
owners as the full ФИО but CROSS-AUTHOR stage owners as the two-letter mark; the
slides, the leads table, and the dashboard escalations showed the full ФИО. The
result read as three different conventions on one screen.

## Decision

One form per surface, by affordance:

- **Full ФИО** appears in EXACTLY ONE place: the user's own top navigation badge
  (their profile chip in the nav bar). Nowhere else.
- **Two-letter mark** is for round avatar chips (nav avatar, dashboard gutters,
  the activity panel) and the tightest inline identity marks (the item-row stage
  micro-chip «Development · ВИ»).
- **Short form** is for every other place a name is rendered as a spelled-out
  text label: SDLC stage owners (own AND cross-author), slide owners +
  contributors, the leads summary table, cross-author content authors, and
  dashboard escalation assignees.

A shared `shortNameFromName(name: string)` helper produces the short form from a
denormalized `name` string (the only thing most display sites carry).

## The one non-obvious consequence — cross-author stage labels

The lead-form cross-author STATUS read (`LeadFormRepository.getCrossAuthors`)
historically returned only the two-letter mark, with a comment that "the full
name never leaves the method" — a deliberate payload-minimisation / scope choice
for a co-owner on a shared product. To render the cross-author stage owner in the
short form, that read now also returns `authorShortName` (surname + initials).
This is a deliberate, narrow reversal: the SHORT form (surname + initials) leaves
the server for a co-owner the lead already shares a product with; the FULL ФИО
and patronymic still never leave. The two-letter-only stance is gone for this
read; the short form is the new floor.

## Considered alternatives

- **Keep cross-author stages as two-letter** (no backend change). Rejected: it
  leaves the exact inconsistency the policy exists to remove — a lead would see
  their own stages as «Иванов В.П.» and a co-owner's as «КМ» side by side.
- **Short everything, including avatars.** Rejected: «Иванов В.П.» does not fit a
  round avatar chip; the two-letter mark is the right affordance there.
