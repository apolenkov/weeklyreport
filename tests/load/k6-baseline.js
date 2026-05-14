// 39-04 — k6 load-test baseline for CustomReport.
//
// Scenario: 50 concurrent leads exercising the read-heavy 80/20 mix observed
// in real dev traffic (PERF-AUDIT-2026-05.md):
//   - 80% reads:   weeklyReport.get + reports.myHistory + reports.getActive
//                  (the three procedures that account for 6.6% of total
//                   tRPC traffic on the lead path).
//   - 20% writes:  reports.saveDraft with a draftSaveSchema-compatible
//                  payload built from the current active section.
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
// Output: writes summary to .planning/LOAD-TEST-LAST-RUN.json (see
// ../../.planning/LOAD-TEST-2026-05.md).

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate } from "k6/metrics";

const API_URL = __ENV.API_URL || "http://localhost:3002";
const VUS = parseInt(__ENV.VUS || "50", 10);
const DURATION = __ENV.DURATION || "2m";

const readLatency = new Trend("cr_read_latency_ms", true);
const writeLatency = new Trend("cr_write_latency_ms", true);
const trpcErrors = new Rate("cr_trpc_errors");

let activeSection = null;

export const options = {
  scenarios: {
    leads: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: VUS },
        { duration: DURATION, target: VUS },
        { duration: "15s", target: 0 },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    cr_read_latency_ms: ["p(95)<300"],
    cr_write_latency_ms: ["p(95)<800"],
    cr_trpc_errors: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
  },
};

function login(vu) {
  // dev-login issues a session cookie + redirects; we don't follow redirects
  // to keep the request count tight, but k6 captures the Set-Cookie header.
  const email = `lead${(vu % 6) + 1}@customreport.local`;
  const url = `${API_URL}/auth/dev-login?role=lead&email=${encodeURIComponent(email)}&redirect=/lead/report`;
  const res = http.get(url, { redirects: 0, tags: { name: "auth.dev-login" } });
  check(res, {
    "dev-login: 302 redirect": (r) => r.status === 302 || r.status === 200,
  });
  return res;
}

function encodeInput(input) {
  return encodeURIComponent(
    JSON.stringify({ 0: input === undefined ? {} : { json: input } }),
  );
}

function decodeTrpcData(res) {
  try {
    const body = JSON.parse(res.body || "null");
    const entry = Array.isArray(body) ? body[0] : body;
    if (!entry || entry.error) return null;
    const data = entry.result && entry.result.data;
    if (
      data &&
      typeof data === "object" &&
      Object.prototype.hasOwnProperty.call(data, "json")
    ) {
      return data.json;
    }
    return data || null;
  } catch (_) {
    return null;
  }
}

function trpc(procedure, input, isWrite = false) {
  // tRPC v11 httpBatchLink shape. We keep one procedure per request so k6
  // trends still map cleanly to procedure tags.
  const isMutation = isWrite;
  const url = `${API_URL}/trpc/${procedure}?batch=1${isMutation ? "" : `&input=${encodeInput(input)}`}`;
  const params = {
    headers: { "Content-Type": "application/json" },
    tags: { name: `trpc.${procedure}` },
  };
  const body = JSON.stringify({
    0: input === undefined ? {} : { json: input },
  });
  const res = isMutation ? http.post(url, body, params) : http.get(url, params);

  const ok = check(res, {
    [`${procedure}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  trpcErrors.add(!ok);

  const ms = res.timings.duration;
  if (isWrite) writeLatency.add(ms);
  else readLatency.add(ms);

  return res;
}

function draftFromSection(section, text) {
  if (!section || !section.reportSectionId) return null;
  const projects = section.projects || [];
  const firstProject = projects[0];
  const items = (section.items || []).map((item) => ({
    id: item.id,
    projectId: item.projectId,
    type: item.type,
    text: item.text,
    tag: item.tag,
    workflowStatus: item.workflowStatus,
    carriedOver: item.carriedOver || false,
    completed: item.completed === undefined ? null : item.completed,
    stageName: item.stageName || null,
  }));

  if (items.length > 0) {
    items[0].text = text;
  } else if (firstProject) {
    items.push({
      projectId: firstProject.projectId,
      type: "current",
      text,
      tag: "k6",
      workflowStatus: "in_progress",
      carriedOver: false,
      completed: null,
      stageName: null,
    });
  }

  return {
    reportSectionId: section.reportSectionId,
    status: "draft",
    projectStatuses: projects.map((project) => ({
      projectId: project.projectId,
      status: project.trafficLight || undefined,
    })),
    items,
    risks: (section.risks || []).map((risk) => ({
      id: risk.id,
      projectId: risk.projectId,
      risk: risk.risk,
      impact: risk.impact,
      mitigation: risk.mitigation,
      stageName: risk.stageName || null,
    })),
    decisions: (section.decisions || []).map((decision) => ({
      id: decision.id,
      text: decision.text,
      owner: decision.owner,
      deadline: decision.deadline || null,
      impact: decision.impact,
      resolvedAt: decision.resolvedAt || null,
      stageName: decision.stageName || null,
    })),
    priorities: (section.priorities || []).map((priority) => ({
      id: priority.id,
      rank: priority.rank,
      text: priority.text,
      stageName: priority.stageName || null,
    })),
  };
}

export default function () {
  // VU iteration 1 logs in once — cookie persists across iterations.
  if (__ITER === 0) {
    login(__VU);
    sleep(0.5);
  }

  group("lead read path", () => {
    // 80% of work: weeklyReport.get (lead-form initial load) + sidebar history
    const activeRes = trpc("reports.getActive", undefined);
    const latestSection = decodeTrpcData(activeRes);
    if (latestSection) activeSection = latestSection;
    sleep(Math.random() * 0.5 + 0.2);

    trpc("reports.myHistory", undefined);
    sleep(Math.random() * 0.5 + 0.2);

    // Empty object exercises the current-period shortcut without sending
    // reportId:null, which Zod correctly rejects.
    trpc("weeklyReport.get", {});
    sleep(Math.random() * 0.8 + 0.3);
  });

  // 20% of iterations: saveDraft (the only repeated mutation in lead flow)
  if (Math.random() < 0.2) {
    group("lead write path", () => {
      const payload = draftFromSection(
        activeSection,
        `k6 vu=${__VU} iter=${__ITER}`,
      );
      if (!payload) return;
      const saveRes = trpc("reports.saveDraft", payload, true);
      const savedSection = decodeTrpcData(saveRes);
      if (savedSection) activeSection = savedSection;
      sleep(0.3);
    });
  }

  sleep(Math.random() * 1 + 0.5); // think-time
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
    ".planning/LOAD-TEST-LAST-RUN.json": JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const fmt = (key, suffix = "ms") => {
    const v = m[key]?.values;
    if (!v) return `${key}: (no data)`;
    return `${key.padEnd(28)} avg=${v.avg?.toFixed(1)}${suffix}  p95=${v["p(95)"]?.toFixed(1)}${suffix}  max=${v.max?.toFixed(1)}${suffix}`;
  };
  const passed = (key) =>
    m[key]?.thresholds && Object.values(m[key].thresholds).every((t) => t.ok)
      ? "PASS"
      : "FAIL";
  return [
    "",
    "=== CustomReport k6 baseline ===",
    fmt("cr_read_latency_ms"),
    fmt("cr_write_latency_ms"),
    fmt("http_req_duration"),
    `cr_trpc_errors            rate=${(m.cr_trpc_errors?.values?.rate ?? 0).toFixed(4)}`,
    `http_req_failed           rate=${(m.http_req_failed?.values?.rate ?? 0).toFixed(4)}`,
    "",
    `Thresholds: read ${passed("cr_read_latency_ms")} | write ${passed("cr_write_latency_ms")} | errors ${passed("cr_trpc_errors")}`,
    "",
  ].join("\n");
}
