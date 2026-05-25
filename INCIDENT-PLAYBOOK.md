# Incident Playbook

Step-by-step for handling a production incident on CustomReport. Pair with
[`RUNBOOK.md`](RUNBOOK.md) for symptom→cause→fix recipes per failure mode.

## When to declare an incident

| Severity  | Trigger                                                            | Response                                  |
| --------- | ------------------------------------------------------------------ | ----------------------------------------- |
| **SEV-1** | Service fully down (>3 min) OR data-loss risk                      | Page on-call. Status update every 15 min. |
| **SEV-2** | Major feature broken for all users (e.g. SAML login, PDF export)   | Page on-call. Status update every 30 min. |
| **SEV-3** | Subset of users affected OR feature degraded but workaround exists | Page on-call within business hours.       |
| **SEV-4** | Cosmetic or single-user issue                                      | Open issue; no page.                      |

## Response sequence

```text
DETECT      Alert / user report / monitoring page
   ↓
TRIAGE      Confirm the symptoms; decide severity
   ↓
COMMUNICATE Open incident channel #incident-NN (or equivalent),
            post initial status with: scope / impact / cause hypothesis
   ↓
MITIGATE    Fastest path to user-visible recovery
            (rollback > hot-fix > config change > restart)
   ↓
RESOLVE     Root-cause fixed in code, deployed, verified
   ↓
POST        Postmortem within 5 business days; one of:
            (a) PR adds RUNBOOK entry
            (b) PR adds new alert
            (c) PR adds regression test
            (d) ADR explaining the design choice that allowed the fault
```

## Standard rollback procedure

The deploy unit is a tagged git revision. Rolling back = checking out the
previous tag and re-deploying. Migrations are the part that needs care.

```bash
# 1. Identify previous tag
git fetch --tags
git tag --sort=-creatordate | head -10

# Pick the last GREEN tag (one before the bad deploy):
PREV=v8.0-phase-37        # example

# 2. On the deploy host:
git fetch
git checkout $PREV
docker compose build api web
docker compose up -d migrate     # runs `prisma migrate deploy`; idempotent
docker compose up -d api web caddy

# 3. Verify
curl -fsSL https://<host>/health/ready
docker compose logs api --tail=50 | grep -E '"level":"(error|warn)"' | tail -10

# 4. Communicate
# Post in incident channel: "rolled back to $PREV; service restored at HH:MM"
```

### Rolling back across a destructive migration

If the bad deploy contained a migration that DROPPED columns/tables:

1. **Stop**. Don't `git checkout` — the previous tag's schema.prisma will
   reject startup.
2. Restore Postgres from backup (most recent pre-migration dump):

   ```bash
   docker compose stop api
   docker compose exec postgres pg_restore -U customreport \
     --clean --if-exists -d customreport /backup/<DATE>.dump
   ```

3. THEN `git checkout $PREV` and `docker compose up -d`.
4. Communicate the data-loss window in the incident channel.

If you don't have a recent backup: do **not** roll back. Forward-fix
instead — write a migration that re-adds the dropped columns/tables, or
deploy a hot-fix that tolerates the new schema.

## On-call rotation (template)

> **Adapt this template** when more than one engineer is on-call. Today
> CustomReport is operated by a small core team — fill in actual names
> when scaled.

| Week                | Primary | Secondary | Escalation     |
| ------------------- | ------- | --------- | -------------- |
| Week 19 (May 5–11)  | _name_  | _name_    | _backend lead_ |
| Week 20 (May 12–18) | _name_  | _name_    | _backend lead_ |
| Week 21 (May 19–25) | _name_  | _name_    | _backend lead_ |

**Primary on-call duties:**

- Acknowledge any page within 5 min, status-update within 15 min.
- Run the playbook above; escalate to secondary if mitigation isn't clear in 30 min.
- Author the postmortem (or assign it explicitly within 24h).

**Secondary on-call duties:**

- Cover when primary is unreachable.
- Co-author postmortem on SEV-1.

**Handoff at end of rotation:**

- Walk the incoming primary through anything in-flight (open incidents,
  pending postmortems, watch items in dashboards).
- Update this rotation table with the next 2 weeks.

## Postmortem template

Five sections, ~1 page each. File at `.planning/postmortems/YYYY-MM-DD-slug.md`.

```markdown
# Postmortem: <slug>

**Date:** YYYY-MM-DD
**Severity:** SEV-N
**Duration:** HH:MM → HH:MM (Δ minutes)
**Author:** <name>
**Reviewers:** <names>

## Summary

2-3 sentences. What happened, who saw it, how it ended.

## Timeline (UTC)

- HH:MM — first signal (alert / user report)
- HH:MM — engineer paged
- HH:MM — root-cause hypothesis confirmed
- HH:MM — mitigation applied
- HH:MM — service restored

## Root cause

What broke, why. Be specific (commit hash, env var, dependency
version). Avoid blame.

## Impact

Who saw what. Quantified if possible: N users, M failed requests,
"reports for week K weren't published until HH:MM".

## What went well / what didn't

Two short bullet lists. Surface the bright spots — they teach as much
as the failures.

## Action items

- [ ] Owner: <name> — <action> — due YYYY-MM-DD
- [ ] Owner: <name> — <action> — due YYYY-MM-DD

Each action must land as a PR (test, alert, doc, ADR) within the
agreed window. Revisit at the next on-call handoff.
```

## Quick links

- [RUNBOOK.md](RUNBOOK.md) — symptom→cause→fix recipes (10 failure modes)
- `.planning/INTERACTION-INVENTORY-2026-05-05.md` — operational mutations
- Bull Board: `/admin/queues` (head session)
- Grafana dashboards: TBD (Phase 37-03)
- Audit trail: `apps/api/src/lib/audit-logger.ts` (auth events today; full coverage Phase 36-02)
