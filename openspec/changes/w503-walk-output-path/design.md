# Design

`walk.sh` already consumes the separated output argument. Add the equivalent
equals-form case to the same parser, storing its value in the existing `OUT`.
Keep the remaining arguments and existing per-state output structure intact.

Extend the existing shell-fixture test table to exercise quick and full output
propagation. Stub cluster/browser callees; retain the real wrapper and guard
scripts. Captured crawler and merge arguments independently prove destinations.
These fixtures do not establish a live cluster, browser or database result.
