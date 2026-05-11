# Phase 59: Multi-Org Hierarchy + Reporting Tree (STUB)

**Status:** idea / scoping (2026-05-11 in-chat capture)
**Driver:** user vision for tenant-aware org-tree with super-head / CEO levels above current Group/head model.

## Current model (singleton)

```
Organization (singleton, id="singleton", e.g. "PEO")
└── ReportingGroup[]
    ├── head      (one user, reviewer of group reports)
    ├── leads[]   (authors of report sections)
    └── viewers[] (read-only)
```

Roles: `lead | head | viewer | admin | director` (director = god-mode read across all groups).

## Proposed multi-level model

```
Organization[]                              ← root tenant (can be multiple)
└── BusinessUnit (super-group, optional)    ← department cluster, owned by super-head
    └── ReportingGroup[]                    ← existing unit
        ├── head (1)
        ├── leads (N)
        └── viewers (N)
```

Roles widened (placeholder names — pick at scoping time):

| Level   | Role         | Sees                                    | Edits             | Reports to                         |
| ------- | ------------ | --------------------------------------- | ----------------- | ---------------------------------- |
| Tenant  | `root_head`  | everything in the Organization          | settings          | nobody (or external CEO)           |
| Cluster | `super_head` | one or more BusinessUnits               | escalations       | root_head                          |
| Group   | `head`       | one ReportingGroup                      | reviews + publish | super_head (or root_head if flat)  |
| Group   | `lead`       | own sections                            | own sections      | head                               |
| Group   | `viewer`     | one ReportingGroup (read)               | nothing           | n/a                                |
| Cross   | `admin`      | all groups (operational, not reporting) | users + settings  | n/a                                |
| Cross   | `director`   | all groups (read-only)                  | nothing           | n/a (separate from reporting tree) |

> Note: `director` is already implemented (Phase 57) as a global read-only audience. It is **orthogonal** to the reporting tree — both can coexist.

## Reporting rollup flow

```
[lead] ──submits──> [section]
                       │
                       ▼
[head] ──reviews + publishes──> [group report]
                                      │
                                      ▼ (Phase 54 AI rollup, on-prem)
[super_head] ──sees AI summary across attached BusinessUnit──> [cluster brief]
                                                                       │
                                                                       ▼ (Phase 54 AI rollup)
[root_head] ──sees roll-up across whole Organization──> [executive brief]
```

Each level keeps its own chat / RAG vector (Phase 54 seeds-only today).

## Multi-tenant dimension

Today: `Organization` is hard-coded singleton (`id="singleton"`). Future:

- `Organization.id` becomes a real PK with `slug` / `domain`
- All other entities (User, ReportingGroup, Report, etc.) gain `organizationId` FK
- Tenant isolation enforced in scope-filter helper (Phase 46 extension)
- Login flow: SSO claim → which Organization → which login redirect

## Telemetry / AI rollup tie-in

- Phase 52 (telemetry) — metrics gain `organizationId` + `businessUnitId` labels for filtering
- Phase 54 (AI/RAG) — each level (group / business unit / org) gets its own ingestion partition; super_head queries roll up across attached units
- Phase 55 (Telegram) — bot delivers level-appropriate digests:
  - lead chat → own section reminders
  - head chat → group-level publication events
  - super_head → BusinessUnit weekly summary
  - root_head → org-wide executive brief

## Phase scope (when scheduled)

| Plan | Scope                                                                               |
| ---- | ----------------------------------------------------------------------------------- |
| 59-A | Schema: `BusinessUnit` model, `Organization.id` → real PK, `User.organizationId` FK |
| 59-B | Backfill — existing singleton → first Organization row; existing groups → no BU     |
| 59-C | tRPC scope-filter extension: `groupScopeFilter` ↔ `businessUnitScopeFilter`         |
| 59-D | Roles: add `super_head` to enum + auth routing + nav badges                         |
| 59-E | Admin UI: BusinessUnit CRUD; attach groups to BUs; assign super_head                |
| 59-F | Rollup queries: head report → BU summary → org summary                              |
| 59-G | Phase 52 metrics widening (org/BU labels)                                           |
| 59-H | Phase 54 RAG partitioning (org/BU/group ingestion scopes)                           |
| 59-I | Phase 55 Telegram digests per level                                                 |

## Dependencies / sequencing

- Cannot start before Phase 57 (director role) is merged — already done
- Cannot start before Phase 46 scope-filter foundation — already done
- Phase 54/55 enhancements (59-H, 59-I) only useful after their respective real-provider activation

## Open questions for `/gsd-discuss-phase 59`

1. **Naming.** `super_head` vs `cluster_head` vs `vp` vs `director` (collision with existing director). Stable terminology before we encode in enum.
2. **BusinessUnit vs flat.** Skip BU level entirely for v1? Some orgs don't need a middle layer. Make BU optional with `group.businessUnitId nullable`.
3. **Tenant slug routing.** `app.example/org/peo/...` vs subdomain `peo.app.example` vs invisible (one-user-one-org).
4. **Existing singleton migration.** Force every existing User into the new Organization row at deploy time; lock the singleton constant so no new singletons can be created.
5. **Cross-org admin.** Can an `admin` user belong to multiple Organizations (consulting scenario)? Or strictly 1:1?
6. **Reporting tree vs ACL tree.** Are reporting hierarchy (lead→head→super) and access control (who-sees-what) the same tree, or two? Phase 57 director shows they're not — director is a flat cross-cutting role.

## TODO traces in current code

Per CLAUDE.md TODO discipline:

- `apps/api/src/modules/organization/...` (singleton service) — add `TODO(Phase-59-multi-org)`
- `apps/api/src/lib/group-scope.ts` — add `TODO(Phase-59-multi-org)` near scope-filter for future BU extension
- `apps/web/src/app/page.tsx` — already references `orgShortName/orgFullName` from singleton; add `TODO(Phase-59-multi-org)` near the tRPC `org.getPublic` call.

## Use `/gsd-discuss-phase 59`

Stub is intentionally broad. When this becomes near-term, run `/gsd-discuss-phase 59` to:

- Lock terminology (super_head naming)
- Decide BU optional/required
- Decide tenant routing convention
- Produce 59-A through 59-I plans

Until then this file is the source of truth for the idea.
