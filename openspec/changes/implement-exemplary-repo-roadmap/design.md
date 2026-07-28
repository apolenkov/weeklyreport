# Design

## Source precedence

The campaign uses both supplied sources:

1. the PDF supplies order, measured backlog, and the six work areas;
2. `exemplary-repo-roadmap` supplies mechanical invariants, declined rules, and
   open decisions;
3. current source and command output decide whether an item is already done.

The PDF's first three printed pages are blank because of an artifact print
failure. Their sections 01-04 are recoverable from the source HTML of the same
artifact and agree with the OpenSpec floor requirements.

## Ratchet

The repository stores a reviewed baseline for the three counters. A check
compares the current tree with that baseline and compares any edited baseline
with its first-parent predecessor. Therefore a contributor cannot make a
regression pass merely by weakening the baseline in the same commit.

The check is part of `pnpm lint`. Improvements update the baseline in the same
commit as the code that produced them.

## Landing order

Work lands in independently verifiable slices:

1. mechanical ratchet;
2. local and already-decided rules/findings;
3. cross-module ownership and shared-contract changes;
4. broad debt burn-down projects;
5. human-decision items after explicit rulings.
