---
tags: [bug, version-badge, slides, lead-form]
related: [fix/PRJ-2/shiny-eagle]
---

# Version Badge Bug — Source Analysis

## Bug

The autosave indicator badge (rendered in the lead report header) shows
**"Version 1 · HH:MM"** even when the current snapshot is v4 or higher.
The `VersionHistoryNav` pill correctly shows `v4`; the badge does not.

## Root Cause — Single File, Single Line

**File:** `apps/web/src/components/lead/lead-form.tsx`
**Line 1386–1396** — `latestVersionNumber` derivation + `autosaveLabel` template:

```ts
// line 1386
const latestVersionNumber =
  versionsQ.data && versionsQ.data.length > 0
    ? versionsQ.data[versionsQ.data.length - 1]?.version ?? null  // BUG: last = oldest
    : null;

// line 1395–1396
? `${latestVersionNumber != null ? `Version ${latestVersionNumber} · ` : ""}${autosave.lastSavedAt.toLocaleTimeString(...)}`
```

The API (`apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:213`)
returns snapshots **`orderBy: { version: "desc" }`** — newest first.
So `versionsQ.data[0]` is the latest version (e.g. v4) and
`versionsQ.data[length - 1]` is the oldest (v1).

The badge reads the last element → always shows "Version 1".

## Fix

Change line 1388 from:

```ts
versionsQ.data[versionsQ.data.length - 1]?.version ?? null;
```

to:

```ts
versionsQ.data[0]?.version ?? null;
```

## Cross-Check: Why VersionHistoryNav is Correct

`apps/web/src/components/lead/version-history-nav.tsx:114`
initializes at `currentIndex = 0` → `versions[0]` = latest → displays correct `v4`.

## All Rendering Sites for "Version N" Text

| File                                                   | Line(s)   | Text rendered                                             | Data source                               |
| ------------------------------------------------------ | --------- | --------------------------------------------------------- | ----------------------------------------- |
| `apps/web/src/components/lead/lead-form.tsx`           | 1386–1396 | `Version ${latestVersionNumber} · HH:MM` (autosave badge) | `versionsQ.data[length-1]` ← **BUG**      |
| `apps/web/src/components/lead/version-history-nav.tsx` | 248       | `Version {v.version}` (modal row per snapshot)            | per-item `v.version` — correct            |
| `apps/web/src/components/lead/version-history-nav.tsx` | 174–175   | `v{currentVersion?.version}` (nav pill)                   | `versions[0]` (newest-first) — correct    |
| `apps/web/src/components/ui/confirmation-dialog.tsx`   | 195       | `Restore to version ${context}`                           | caller-provided value — not a display bug |

## Conclusion

The only buggy site is `lead-form.tsx:1388`: `versionsQ.data[versionsQ.data.length - 1]`
picks the oldest snapshot from a descending-sorted array; changing the index to `[0]`
fixes the badge without touching any other component.
