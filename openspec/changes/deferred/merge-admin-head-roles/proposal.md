# Merge admin and head roles

## Problem

Currently, admin and head are separate roles with overlapping permissions. The
user suggested simplifying: "admin = head" (single unified role for
administrative and leadership functions).

## Solution

Consolidate `admin` and `head` into a single `head` role with all combined
permissions. This simplifies role-coverage testing, dev-login role selection,
and permission logic across the codebase.

## Non-goals

- Add new permissions.
- Change the viewer or lead roles.

## Impact

Load-bearing: role-coverage gate (CI validates all procedures against 7
middleware-chain builders). Merging roles reduces coverage surface area but
requires CI update.
