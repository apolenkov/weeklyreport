# Design

This change uses the same provider-owned identity and hook cleanup as
[the shared lifecycle design](../c73-hovered-tooltip-leaves-with-its-anchor/design.md).
There is one implementation for C5298 and C5180; no `LockBadge`-specific cleanup,
layout observer, positioning change or caller API migration is introduced.
