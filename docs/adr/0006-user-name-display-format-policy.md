# User-name display format policy

**Status:** accepted and implemented.

Names use one form per affordance:

- full name appears only in the user's own navigation profile badge;
- two-letter initials appear in avatars and the tightest identity marks;
- short name (`Surname I.P.`) appears everywhere else a name is a text label,
  including stage owners, slide contributors, lead tables, and assignees.

The shared `shortNameFromName` helper derives the short form from a plain name.
Cross-author reads return the short form and never expose a patronymic merely to
render a label. The structured-name contract is defined in
`openspec/specs/structured-user-name/spec.md`.
