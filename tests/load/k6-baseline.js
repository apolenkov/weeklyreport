// 39-04 — k6 load-test baseline for CustomReport.
//
// Scenario: 50 concurrent leads exercising the read-heavy 80/20 mix observed
// in real dev traffic (PERF-AUDIT-2026-05.md):
//   - 80% reads:   weeklyReport.get + reports.myHistory + reports.getActive
//                  (the three procedures that account for 6.6% of total
//                   tRPC traffic on the lead path).
//   - 20% writes:  reports.saveDraft (the only mutation a lead repeats
//                  multiple times per session).
//
// Targets (calibrated from PERF-AUDIT-2026-05 latency table):
//   - p95 read       <  300 ms
//   - p95 saveDraft  <  800 ms
//   - http_req_failed < 0.01 (1% — most failures are 401 from session expiry)
//
// Auth: AUTH_DEV_MODE must be 'true' on the target API. Each VU calls
// GET /auth/dev-login?role=lead&email=lead<n>@customreport.local on iter 1
// and reuses the session cookie via k6's CookieJar.
//
// Run:
//   # Local stack (default targets http://localhost:3002 + http://localhost:3000)
//   docker compose up -d
//   k6 run tests/load/k6-baseline.js
//
//   # Custom target (e.g. staging)
//   k6 run -e API_URL=https://staging-api.example.com \
//          -e WEB_URL=https://staging.example.com \
//          -e VUS=50 -e DURATION=5m \
//          tests/load/k6-baseline.js
//
// Output: writes summary to .planning/LOAD-TEST-RESULTS-<date>.json via
// k6's --summary-export flag (see ../../.planning/LOAD-TEST-2026-05.md).

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const API_URL = __ENV.API_URL || 'http://localhost:3002';
const VUS = parseInt(__ENV.VUS || '50', 10);
const DURATION = __ENV.DURATION || '2m';

const readLatency = new Trend('cr_read_latency_ms', true);
const writeLatency = new Trend('cr_write_latency_ms', true);
const trpcErrors = new Rate('cr_trpc_errors');

export const options = {
  scenarios: {
    leads: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: VUS },
        { duration: DURATION, target: VUS },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    cr_read_latency_ms: ['p(95)<300'],
    cr_write_latency_ms: ['p(95)<800'],
    cr_trpc_errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

function login(vu) {
  // dev-login issues a session cookie + redirects; we don't follow redirects
  // to keep the request count tight, but k6 captures the Set-Cookie header.
  const email = `lead${(vu % 6) + 1}@customreport.local`;
  const url = `${API_URL}/auth/dev-login?role=lead&email=${encodeURIComponent(email)}&redirect=/lead/report`;
  const res = http.get(url, { redirects: 0, tags: { name: 'auth.dev-login' } });
  check(res, {
    'dev-login: 302 redirect': (r) => r.status === 302 || r.status === 200,
  });
  return res;
}

function trpc(procedure, input, isWrite = false) {
  // tRPC v11 batched query format: GET /trpc/<procedure>?input=...
  // Single-procedure call avoids batching latency for cleaner per-proc trends.
  const isMutation = isWrite;
  const url = `${API_URL}/trpc/${procedure}${isMutation ? '' : `?input=${encodeURIComponent(JSON.stringify(input || {}))}`}`;
  const params = {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: `trpc.${procedure}` },
  };
  const res = isMutation
    ? http.post(url, JSON.stringify(input || {}), params)
    : http.get(url, params);

  const ok = check(res, {
    [`${procedure}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  trpcErrors.add(!ok);

  const ms = res.timings.duration;
  if (isWrite) writeLatency.add(ms);
  else readLatency.add(ms);

  return res;
}

export default function () {
  // VU iteration 1 logs in once — cookie persists across iterations.
  if (__ITER === 0) {
    login(__VU);
    sleep(0.5);
  }

  group('lead read path', () => {
    // 80% of work: weeklyReport.get (lead-form initial load) + sidebar history
    trpc('reports.getActive', undefined);
    sleep(Math.random() * 0.5 + 0.2);

    trpc('reports.myHistory', { limit: 20 });
    sleep(Math.random() * 0.5 + 0.2);

    // weeklyReport.get needs a reportId; getActive returned one. In a real
    // scenario we'd thread it through. For baseline, we just hit the lead's
    // current report via the no-arg shortcut path (server falls back to
    // current period for the authed lead).
    trpc('weeklyReport.get', { reportId: null });
    sleep(Math.random() * 0.8 + 0.3);
  });

  // 20% of iterations: saveDraft (the only repeated mutation in lead flow)
  if (Math.random() < 0.2) {
    group('lead write path', () => {
      trpc(
        'reports.saveDraft',
        {
          // Realistic shape: a single item edit. The actual schema is enforced
          // server-side via Zod; mismatches here will surface as 400 in
          // cr_trpc_errors and we'll know to tighten the script.
          patches: [
            {
              type: 'item',
              op: 'upsert',
              data: { text: `k6 vu=${__VU} iter=${__ITER}`, status: 'green' },
            },
          ],
        },
        true,
      );
      sleep(0.3);
    });
  }

  sleep(Math.random() * 1 + 0.5); // think-time
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
    '.planning/LOAD-TEST-LAST-RUN.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const fmt = (key, suffix = 'ms') => {
    const v = m[key]?.values;
    if (!v) return `${key}: (no data)`;
    return `${key.padEnd(28)} avg=${v.avg?.toFixed(1)}${suffix}  p95=${v['p(95)']?.toFixed(1)}${suffix}  max=${v.max?.toFixed(1)}${suffix}`;
  };
  const passed = (key) => (m[key]?.thresholds && Object.values(m[key].thresholds).every((t) => t.ok) ? 'PASS' : 'FAIL');
  return [
    '',
    '=== CustomReport k6 baseline ===',
    fmt('cr_read_latency_ms'),
    fmt('cr_write_latency_ms'),
    fmt('http_req_duration'),
    `cr_trpc_errors            rate=${(m.cr_trpc_errors?.values?.rate ?? 0).toFixed(4)}`,
    `http_req_failed           rate=${(m.http_req_failed?.values?.rate ?? 0).toFixed(4)}`,
    '',
    `Thresholds: read ${passed('cr_read_latency_ms')} | write ${passed('cr_write_latency_ms')} | errors ${passed('cr_trpc_errors')}`,
    '',
  ].join('\n');
}
