# Architecture decision records

One file per decision, named `NNNN-short-title.md`. The next free number is the
highest existing number plus one. A number is never reused, even after a record
is deleted: `0017` was once a removed record, so the current `0017` is the only
one in the tree, and older history may point to the removed one.

Copy the template below. Fill every heading; write `None` where nothing applies.
Older records predate the template and keep their own shape until they are next
edited.

```markdown
# Short decision title

**Status:** proposed | accepted | superseded
**Date:** YYYY-MM-DD
**Superseded-by:** None | NNNN-short-title

## Context

The forces and constraints that made a decision necessary.

## Decision

What is decided, stated in the present tense.

## Alternatives

Each rejected option and the reason it lost.

## Consequences

What becomes easier, harder, or required after this decision.
```
