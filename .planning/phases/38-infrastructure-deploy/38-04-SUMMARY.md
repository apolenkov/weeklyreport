# Phase 38, Plan 04 — SUMMARY

**REQ-IDs:** INF-04
**Commit:** `dcd5f6a docs(38-04): RUNBOOK + INCIDENT-PLAYBOOK + README links`
**Status:** complete

## What shipped

### RUNBOOK.md

10 failure modes with `detect → triage → resolve → escalate` per entry:

1. Postgres down
2. Redis down
3. SMTP fail / emails not sending
4. Migration fails on deploy
5. BullMQ DLQ growth
6. SAML 500 on login
7. PDF export job stuck
8. Disk full on host
9. 5xx spike
10. TLS certificate expired

Each entry has copy-pasteable commands (docker compose exec, psql, redis-cli, curl, openssl). Architecture diagram at top.

### INCIDENT-PLAYBOOK.md

- Severity matrix (SEV-1..4) with response cadence
- Detect → Triage → Communicate → Mitigate → Resolve → Postmortem flow diagram
- Standard rollback procedure (incl. across destructive migrations — explicit "stop, restore from backup, then checkout" sequence)
- On-call rotation table template (3 weeks)
- 5-section postmortem template (Summary, Timeline, Root cause, Impact, What went well/didn't, Action items)

### README.md

New "Operating in production" section linking RUNBOOK + INCIDENT-PLAYBOOK + CONTRIBUTING.

## Verification

- Both files render cleanly in GitHub markdown.
- All linked anchors resolve.
- All shell commands manually verified — no broken pipe-chains.

## Files

- `RUNBOOK.md` (new)
- `INCIDENT-PLAYBOOK.md` (new)
- `README.md` (Operating section added)
