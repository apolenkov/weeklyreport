# Activity status is independent of product health

**Date:** 2026-06-30

**Status:** accepted and implemented. Current contract:
`openspec/specs/activity-reporting-unit/spec.md`.

Activity status is an independent traffic-light signal. It does not recolor a
linked Product, contribute to portfolio totals, or enter the escalation set.
Product health remains derived from owned stages and their risks. The
many-to-many `ProjectActivityProduct` links group an activity visually and do
not couple these calculations.

Activities and their status are visible to authorized head and viewer users and
are included in published snapshots.
