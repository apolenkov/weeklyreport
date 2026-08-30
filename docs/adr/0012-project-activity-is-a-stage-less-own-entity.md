# Project Activity is a stage-less entity

**Status:** accepted and implemented.

A Project Activity is a separate reporting entity beside Products. It has a
required group, an optional label-only product link, and no SDLC stage, items,
risks, or decisions. Its weekly status is stored in an `ActivityStatus` child
of the lead's `ReportSection`, unique per section and activity.

Admin CRUD uses the `projectActivity.*` namespace. Activity reads are separate
from stage-driven product reads, so the invariant that items, risks, and
decisions have concrete stages remains strict. Adding stage-bearing behavior to
an activity requires a new product decision.
