# Fix decisions slide overflow

## Problem

The Decisions section on the slide view overflows vertically and provides no way
to exit fullscreen mode. Users cannot view all decisions, and once in fullscreen,
navigation back to the normal view is blocked.

## Solution

Wrap the decisions section in a scrollable container with max-height constraint
on the slide deck. Add an explicit exit-fullscreen button (or reuse the existing
close affordance) to provide a clear path out.

## Non-goals

- Redesign the decisions UX or card layout.
- Change the decision data model or lead/head permissions.
- Add pagination (vertical scroll is sufficient).

## Source

User report: "Почему десижнсы не поместились на слайде? Как мне выйти из слайда
в фуллскрин?" Phase 61+ bug.

## Activation trigger

(Active — blocking user workflow.)
