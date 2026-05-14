# CustomReport Runbook

**Audience:** on-call engineers operating CustomReport in production.
**Scope:** detect → triage → resolve → escalate playbook for the top 10
failure modes. Each entry pairs symptoms with the exact commands needed
to confirm the cause and restore service.

> Last updated: 2026-05-05 (v8.0 Phase 38-04). Revisit after every phase
> that changes the prod compose, env schema, or service topology.

## Architecture at a glance

```
┌─────────────┐        ┌──────────────┐
│  caddy:443  │───WS───│  next:3000   │  ← /lead, /head, /admin, /reports
│   (TLS)     │        │  (RSC + SSR) │
└──────┬──────┘        └──────┬───────┘
       │                       │ tRPC over fetch
       │       ┌───────────────▼────────────────┐
       │       │           api:3002             │
       │       │ (NestJS + Express + tRPC)      │
       │       └─┬──────────┬───────┬──────────┬┘
       │         │          │       │          │
       │      Postgres   Redis    BullMQ    SMTP
       │     (sessions)  (cache)  (jobs:    (real or mailpit)
       │                          pdf-export,
       │                          email-reminder,
       │                          carry-over)
       └─── /metrics → Prometheus → Grafana
```

**Key endpoints:**

- `/health/live` — memory/heap; should always be 200 unless API itself is dead.
- `/health/ready` — DB + Redis + BullMQ + memory all-or-nothing.
- `/metrics` — Prometheus scrape (HTTP histogram, custom counters once Phase 37 lands).
- `/admin/queues` — Bull Board UI (head/admin role gated).

---

## 1. Postgres down

**Symptoms:** API `/health/ready` returns 503; tRPC requests fail with 500;
log pattern `PrismaClientKnownRequestError ... Can't reach database server`.

**Detect:**

```bash
docker compose ps postgres            # is the container up?
docker compose logs postgres --tail=80
docker compose exec postgres pg_isready -U customreport
```

**Triage:**

- Container exited / OOM — `docker compose logs postgres | tail -200` for the crash signal.
- Disk full — `docker exec postgres df -h /var/lib/postgresql/data`.
- Connection storm — `SELECT count(*), state FROM pg_stat_activity GROUP BY state;`.

**Resolve:**

```bash
# Quick restart (data persists in named volume):
docker compose restart postgres

# If volume corrupted and you have a recent backup:
docker compose down postgres
# restore from latest dump (Postgres backup strategy = nightly pg_dump → /backup):
docker compose run --rm postgres bash -c \
  'pg_restore -U customreport -d customreport_restore /backup/<DATE>.dump'
docker compose up -d postgres
```

**Escalate:** if disk-full + no backup → declare data-loss incident; rotate
on-call to the database lead; halt all writes (drop-down API to read-only mode
if implemented; otherwise stop API).

---

## 2. Redis down

**Symptoms:** API `/health/ready` 503; BullMQ jobs not picked up; rate-limit
middleware errors (Phase 36-01 once landed).

**Detect:**

```bash
docker compose exec redis redis-cli ping     # expects PONG
docker compose logs redis --tail=80
```

**Triage:** OOM (memory bloat from forgotten keys), AOF corruption, or
container exited.

**Resolve:**

```bash
docker compose restart redis
# After restart, BullMQ workers reconnect within ~30s. Pending jobs in the
# Redis AOF replay; in-flight jobs without completion ack get retried.
```

**Escalate:** if Redis won't start (AOF corruption) → on-call infra; can run
in degraded mode without Redis (cache + jobs disabled) if API is updated to
tolerate a missing Redis on `/health/ready` — currently it does NOT, this
will hold the service down. **Workaround**: `docker compose stop redis &&
docker compose rm -f redis && docker volume rm customreport_redis_data && docker compose up -d redis`
(loses all queued jobs).

---

## 3. SMTP fail / emails not sending

**Symptoms:** `/admin/queues` shows growing `email-reminder` queue with
no processed jobs; reminder cron fires but recipients don't receive.

**Detect:**

```bash
# Check failed jobs:
curl -s http://localhost:3002/admin/queues  # (head session needed)
docker compose logs api --tail=200 | grep -i 'email\|smtp'
```

**Triage:**

- SMTP creds wrong → "535 authentication failed" in logs.
- Network blocked → "Connection timeout to smtp.example.com:587".
- Rate limit (BullMQ has 5/60s by design) → expected, not a fault.

**Resolve:**

```bash
# Verify env:
docker compose exec api env | grep ^SMTP_

# Test SMTP creds from a clean shell (sanity-check connectivity):
docker compose exec api node -e "
  const t = require('nodemailer').createTransport({
    host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  t.verify().then(console.log).catch(console.error);
"

# Retry stuck jobs from Bull Board UI, OR via API:
docker compose exec api node -e "
  const { Queue } = require('bullmq');
  const q = new Queue('email-reminder', { connection: { host: 'redis', port: 6379 } });
  q.getFailed().then(jobs => Promise.all(jobs.map(j => j.retry()))).then(() => process.exit());
"
```

**Escalate:** if SMTP provider blocking the corporate mailserver → IT/network team.

---

## 4. Migration fails on deploy

**Symptoms:** `migrate` init-container exits non-zero; API never starts;
`docker compose logs migrate` shows Prisma error (drift, constraint, etc).

**Detect:**

```bash
docker compose logs migrate
docker compose exec postgres psql -U customreport -c \
  "SELECT migration_name, finished_at, applied_steps_count FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5"
```

**Triage:**

- Drift between schema.prisma and applied state — `prisma migrate status`.
- Failed mid-migration leaves partial state — `_prisma_migrations.applied_steps_count` < expected.

**Resolve:**

```bash
# OPTION A: re-apply from clean state (NEW deploy, no data yet):
docker compose down postgres
docker volume rm customreport_postgres_data
docker compose up -d postgres
docker compose up migrate    # re-runs migrate deploy

# OPTION B: rollback the last migration (drift on existing data):
# Identify the failing migration, write a corrective `prisma migrate resolve`:
docker compose run --rm migrate prisma migrate resolve --rolled-back <MIGRATION_NAME>
# Then create a fixed migration locally, commit, redeploy.

# OPTION C: hot-fix on prod DB directly (LAST RESORT):
docker compose exec postgres psql -U customreport
# manually apply the SQL the migration was supposed to apply
# then mark it as resolved:
docker compose run --rm migrate prisma migrate resolve --applied <MIGRATION_NAME>
```

**Escalate:** any production migration that blocks API start → page the
backend lead. Don't try Option C without coordination.

---

## 5. BullMQ DLQ growth

**Symptoms:** `cr_dlq_failed_total` counter rising (alert in Phase 37-02);
Bull Board shows >10 failed jobs in any queue; admin DLQ badge red.

**Detect:**

```bash
# Bull Board has the readable view; CLI fallback:
docker compose exec api node -e "
  const { Queue } = require('bullmq');
  for (const name of ['pdf-export','email-reminder','carry-over']) {
    const q = new Queue(name, { connection: { host: 'redis', port: 6379 } });
    q.getFailedCount().then(c => console.log(name, c));
  }
"
```

**Triage:** open one failed job in Bull Board, read `failedReason`. Common patterns:

- `pdf-export` failing on `Error: Page closed` → Playwright Chromium OOM.
- `email-reminder` failing on `EAUTH` → SMTP creds rotated.
- `carry-over` failing on `P2003 Foreign key constraint failed` → schema drift.

**Resolve:** fix root cause first, then bulk-retry from Bull Board (Retry all)
or:

```bash
docker compose exec api node -e "
  const { Queue } = require('bullmq');
  const q = new Queue('<QUEUE>', { connection: { host: 'redis', port: 6379 } });
  q.getFailed().then(jobs => Promise.all(jobs.map(j => j.retry())));
"
```

**Escalate:** if same job class fails immediately on retry → likely a code
bug. Capture the job data + error, file an issue, page the on-call dev.

---

## 6. SAML 500 on login

**Symptoms:** `/auth/saml/callback` returns 500; users redirect-loop or see
a generic error. Logs: `SamlError: Invalid signature` / `Element ... not signed`.

**Detect:**

```bash
docker compose logs api --tail=200 | grep -i 'saml\|signature\|assertion'
```

**Triage:**

- IdP cert rotated upstream → our pinned cert is now invalid.
- Clock drift between SP (us) and IdP (Keycloak) > 5min → assertion expired.
- IdP misconfigured `<Audience>` → assertion not for us.

**Resolve:**

```bash
# Cert rotation: pull new IdP metadata, replace SAML_IDP_CERT in env.
# Quick test from a clean shell:
docker compose exec api node -e "
  console.log(process.env.SAML_IDP_CERT?.slice(0, 100));
"

# Update env, then:
docker compose restart api

# Clock drift: NTP sync the host:
sudo systemctl restart systemd-timesyncd     # or chronyd / ntpd
```

**Escalate:** if Keycloak unreachable from the API container → IdP team /
network. If SP metadata mismatch → Keycloak admin needs to re-import our
SP metadata.

---

## 7. PDF export job stuck

**Symptoms:** user clicks "Export PDF" → spinner forever → no toast. Bull
Board shows job in `active` state for >5 min.

**Detect:**

```bash
# Worker still alive?
docker compose exec api ps aux | grep -i playwright

# Browser binaries present?
docker compose exec api ls /ms-playwright/
```

**Triage:**

- Chromium browser process died → worker stuck waiting on it.
- Disk full in PDF_OUTPUT_DIR → write fails.
- Source HTML route 500-ing → Playwright timeout.

**Resolve:**

```bash
# Kill stuck job from Bull Board, OR:
docker compose exec api node -e "
  const { Queue } = require('bullmq');
  const q = new Queue('pdf-export', { connection: { host: 'redis', port: 6379 } });
  q.getActive().then(jobs => Promise.all(jobs.map(j => j.moveToFailed(new Error('stuck >5min'), j.token))));
"

# Restart API (worker re-spawns):
docker compose restart api

# Check disk:
docker compose exec api df -h /var/customreport/pdfs
```

**Escalate:** if `pdf-export` queue keeps stuck → likely a bug in PDF route.
Page on-call dev with a sample failing reportId.

---

## 8. Disk full on host

**Symptoms:** Postgres / Redis / API healthchecks all flapping; `pg_dump`
fails; PDF export fails on write.

**Detect:**

```bash
df -h
du -sh /var/lib/docker /var/customreport/pdfs ./apps/api/.logs
docker system df
```

**Triage:**

- Log files filled `LOG_DIR` (rotate misconfigured).
- Old PDF exports never cleaned up (no retention policy yet).
- Docker image cache + dangling volumes.

**Resolve:**

```bash
# Quick wins:
docker system prune -af --volumes        # deletes UNUSED only; safe
find /var/customreport/pdfs -mtime +30 -delete    # PDFs >30d old
# Log rotation should auto-handle but verify:
ls -la apps/api/.logs/      # should see app.log.1.gz, app.log.2.gz, etc.
```

**Escalate:** if disk fills again within 24h → underlying log/PDF retention
policy needs tuning. File an issue.

---

## 9. 5xx spike

**Symptoms:** alerts firing on `cr_http_status_5xx_total` rate; users report
errors broadly across the app.

**Detect:**

```bash
# Recent error logs:
docker compose logs api --since 15m | grep -E '"level":"error"|" 5\d\d "'
# Endpoint hot spot:
docker compose logs api --since 15m | grep ' 5\d\d ' | awk '{print $7}' | sort | uniq -c | sort -rn | head
```

**Triage:**

- Single endpoint hot — probably a recent deploy regression.
- Spread across endpoints — DB / Redis underlying issue (see 1 + 2).
- Memory creep — `docker stats` shows api near limit.

**Resolve:**

```bash
# Quickest restoration: rollback last deploy
git tag --sort=-creatordate | head     # find previous tag
git checkout <PREV_TAG>
docker compose build api web
docker compose up -d api web
# OR via prebuilt images if registry tagging is set up.
```

**Escalate:** can't identify the regressed endpoint → roll back regardless,
investigate offline. Do not let a 5xx spike linger past 15 min.

---

## 10. TLS certificate expired

**Symptoms:** browser shows "NET::ERR_CERT_DATE_INVALID"; caddy logs show
ACME renewal failures.

**Detect:**

```bash
# Cert validity:
echo | openssl s_client -connect customreport.example.com:443 2>/dev/null \
  | openssl x509 -noout -dates
docker compose logs caddy --tail=100 | grep -i acme
```

**Triage:**

- Let's Encrypt rate limit hit (5 dupes/week) — too many failed renewals.
- DNS challenge failing — TXT record not propagated.
- HTTP-01 challenge failing — caddy not on :80, or :80 not exposed.

**Resolve:**

```bash
# Force renewal via caddy admin API:
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
docker compose exec caddy curl -X POST localhost:2019/load \
  -H 'Content-Type: application/json' --data @/etc/caddy/Caddyfile.json

# If LE rate-limit hit: switch to LE staging temporarily (not trusted but
# unblocks renewal logic), or use the local CA fallback documented in
# Phase 38-02.
```

**Escalate:** if renewal won't complete → infra/network team to verify
ACME ports. Manually issue + install a 90-day cert if needed.

---

## See also

- `INCIDENT-PLAYBOOK.md` — rollback procedure + on-call rotation template.
- `.planning/INTERACTION-INVENTORY-2026-05-05.md` — operational mutations + their consumers.
- `apps/api/src/lib/audit-logger.ts` — audit trail surface (auth events today; will cover all mutations after Phase 36-02).
- Bull Board: `https://<host>/admin/queues` (head/admin session required).
- Prometheus + Grafana: `https://<host>/grafana` (Phase 37-03 once landed).
