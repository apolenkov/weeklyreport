/**
 * collect-env-feedback.mjs
 *
 * Post-drive environment-feedback collector for the AI UI Driver skill
 * (Phase 2.5, driver-env-feedback-stage). Sweeps four channels for signal
 * that occurred during the drive window, correlates hits to routes via the
 * timeline, and returns structured results for Phase 3 candidates.
 *
 * Usage (Node 18+, no package installs):
 *   node collect-env-feedback.mjs '{"role":"viewer","timeline":{...}}'
 *
 * Or as an ES module import:
 *   import { collectEnvFeedback } from './collect-env-feedback.mjs';
 *   const result = await collectEnvFeedback({ role, timeline });
 *
 * Channel liveness contract: each channel reports one of:
 *   "reachable"  — reached and has in-window data
 *   "hasStreams"  — reached but no matching entries in the window
 *   "blind"      — could not be reached or is unwired
 * An empty result from a "blind" channel is NOT reported as clean.
 *
 * Output shape (feeds Phase 3 candidates):
 *   {
 *     role: string,
 *     window: { startedAt, endedAt },
 *     channels: {
 *       console: ChannelResult,
 *       apiLog: ChannelResult,
 *       bugsink: ChannelResult,
 *       loki: ChannelResult,
 *     },
 *     hits: Candidate[],       // kind:"env", no intentId
 *     report: string,          // markdown section for <role>-driver.md
 *   }
 *
 * ChannelResult: { liveness, entries: HitEntry[] }
 * Candidate: { route, kind:"env", observed, expected:"", evidence, severity }
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Named constants — no magic numbers or bare paths
// ---------------------------------------------------------------------------

const REPO_ROOT = join(import.meta.dirname, "../../../..");

// Browser console
const PLAYWRIGHT_MCP_DIR = join(REPO_ROOT, ".playwright-mcp");
const CONSOLE_LOG_PATTERN = /^console-.*\.log$/;
// The canary string injected by the drive to prove console capture is live.
const DRIVER_CANARY = "DRIVER_CANARY_42";

// API log — LOG_DIR=.logs/driver is the sweep start-command convention
const API_LOG_DIR = join(REPO_ROOT, "apps/api/.logs/driver");
const API_LOG_ROTATION_PATTERN = /^app\.log/; // matches app.log, app.log.1, …
const API_LOG_LEVELS = new Set(["error", "warn"]);

// Bugsink — Sentry-compatible error tracker, single-user mode (no auth)
const BUGSINK_BASE_URL = "http://localhost:8000";
const BUGSINK_PROJECTS_PATH = "/api/0/projects/";
const BUGSINK_TIMEOUT_MS = 5000;
const BUGSINK_ISSUES_LIMIT = 100;

// Loki via Grafana datasource proxy (uid confirmed in provisioning/datasources/loki.yml)
// Node 18+ global fetch does NOT use HTTP_PROXY, so loopback calls are safe without
// --noproxy. No curl needed; no PATH dependency.
const GRAFANA_BASE_URL = "http://localhost:3003";
const GRAFANA_USER = "admin";
const GRAFANA_PASS = "admin";
const LOKI_DATASOURCE_UID = "loki";
const LOKI_PROXY_PATH = `/api/datasources/proxy/uid/${LOKI_DATASOURCE_UID}/loki/api/v1/query_range`;
const LOKI_QUERY = '{job=~".+"}'; // broad query; window filters the results
const LOKI_LIMIT = 200; // max log lines to fetch per Loki call
const LOKI_TIMEOUT_MS = 5000;

// Severity heuristic: error-level hits are high, warn-level are medium.
const SEVERITY_BY_LEVEL = { error: "high", warn: "medium" };

// Max hits to render per channel in the markdown report (avoid huge reports).
const REPORT_MAX_HITS_PER_CHANNEL = 20;

// ---------------------------------------------------------------------------
// Liveness constants
// ---------------------------------------------------------------------------

const LIVENESS = /** @type {const} */ ({
  REACHABLE: "reachable", // reached, has in-window data
  HAS_STREAMS: "hasStreams", // reached, no in-window data
  BLIND: "blind", // unreachable or unwired
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse an ISO 8601 string to a Date, returning null on failure.
 * @param {string} s
 * @returns {Date | null}
 */
const parseDate = (s) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Return true if `ts` (Date or ISO string) is within [start, end].
 * @param {string | Date} ts
 * @param {Date} start
 * @param {Date} end
 * @returns {boolean}
 */
const inWindow = (ts, start, end) => {
  const d = ts instanceof Date ? ts : parseDate(ts);
  return d !== null && d >= start && d <= end;
};

/**
 * Find the route name from the timeline whose window contains the timestamp.
 * Returns null when no route matches (before first route or after last).
 * @param {{ route: string; enteredAt: string; leftAt: string }[]} routes
 * @param {Date} ts
 * @returns {string | null}
 */
const routeAt = (routes, ts) => {
  const match = routes.find((r) => {
    const entered = parseDate(r.enteredAt);
    const left = parseDate(r.leftAt);
    return entered && left && ts >= entered && ts <= left;
  });
  return match ? match.route : null;
};

/**
 * Fetch a URL with HTTP Basic auth and a timeout.
 * Uses Node 18+ global fetch, which does NOT honour HTTP_PROXY, so loopback
 * calls bypass any corporate proxy without needing --noproxy.
 * Returns the response text, or null on network error / non-2xx status.
 * @param {string} url
 * @param {{ user: string; pass: string; timeoutMs: number }} opts
 * @returns {Promise<string | null>}
 */
const fetchWithAuth = async (url, { user, pass, timeoutMs }) => {
  try {
    const credentials = Buffer.from(`${user}:${pass}`).toString("base64");
    const resp = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) return null;
    return resp.text();
  } catch {
    return null;
  }
};

/**
 * Parse a JSON string, returning null on failure.
 * @param {string} text
 * @returns {unknown}
 */
const tryParseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * Derive liveness from the entries array.
 * @param {object[]} entries
 * @returns {string}
 */
const livenessFrom = (entries) =>
  entries.length > 0 ? LIVENESS.REACHABLE : LIVENESS.HAS_STREAMS;

// ---------------------------------------------------------------------------
// Channel: Browser console — helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Playwright-MCP console filename to a session-start Date.
 * Filenames follow the pattern: console-<ISO>.log where the ISO timestamp
 * uses dashes instead of colons and dots:
 *   console-2026-06-14T00-08-37-899Z.log → 2026-06-14T00:08:37.899Z
 * @param {string} filename
 * @returns {Date | null}
 */
const parseConsoleFilename = (filename) => {
  const raw = filename.slice("console-".length, -".log".length);
  const colonRestored = raw.replace(
    /T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/,
    "T$1:$2:$3.$4Z",
  );
  return parseDate(colonRestored);
};

/**
 * Process one console log file and accumulate entries + canary detection.
 * @param {string} filePath
 * @param {Date} sessionStart
 * @param {Date} start
 * @param {Date} end
 * @param {{ route: string; enteredAt: string; leftAt: string }[]} routes
 * @returns {{ entries: object[]; canaryDetected: boolean }}
 */
const processConsoleFile = (filePath, sessionStart, start, end, routes) => {
  const content = readFileSync(filePath, "utf8");
  const errorWarnRe = /^\[\s*(\d+)ms\] \[(ERROR|WARN)\] (.+)$/;
  const entries = [];
  let canaryDetected = false;

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    if (line.includes(DRIVER_CANARY)) {
      // Mark canary seen but never record it as an error hit.
      canaryDetected = true;
      continue;
    }

    const m = errorWarnRe.exec(line);
    if (!m) continue;

    const [, elapsedStr, level, message] = m;
    const wallClock = new Date(sessionStart.getTime() + Number(elapsedStr));
    if (!inWindow(wallClock, start, end)) continue;

    entries.push({
      channel: "console",
      level: level.toLowerCase(),
      timestamp: wallClock.toISOString(),
      route: routeAt(routes, wallClock),
      excerpt: message.slice(0, 300),
    });
  }

  return { entries, canaryDetected };
};

// ---------------------------------------------------------------------------
// Channel: Browser console
// ---------------------------------------------------------------------------

/**
 * Read .playwright-mcp/console-*.log files that overlap the run window.
 * Files accumulate across sessions — filter by filename timestamp, then scan
 * each file. Wall-clock time is estimated as sessionStart + elapsed_ms.
 *
 * @param {Date} start
 * @param {Date} end
 * @param {{ route: string; enteredAt: string; leftAt: string }[]} routes
 * @returns {{ liveness: string; entries: object[]; canaryDetected: boolean }}
 */
const collectConsole = (start, end, routes) => {
  const blind = {
    liveness: LIVENESS.BLIND,
    entries: [],
    canaryDetected: false,
  };

  if (!existsSync(PLAYWRIGHT_MCP_DIR)) return blind;

  const relevantFiles = readdirSync(PLAYWRIGHT_MCP_DIR)
    .filter((f) => CONSOLE_LOG_PATTERN.test(f))
    .map((f) => ({ name: f, sessionStart: parseConsoleFilename(f) }))
    .filter((f) => f.sessionStart !== null && f.sessionStart <= end);

  if (relevantFiles.length === 0) return blind;

  const allEntries = [];
  let canaryDetected = false;

  for (const { name, sessionStart } of relevantFiles) {
    const { entries, canaryDetected: found } = processConsoleFile(
      join(PLAYWRIGHT_MCP_DIR, name),
      sessionStart,
      start,
      end,
      routes,
    );
    allEntries.push(...entries);
    if (found) canaryDetected = true;
  }

  return {
    liveness: livenessFrom(allEntries),
    entries: allEntries,
    canaryDetected,
  };
};

// ---------------------------------------------------------------------------
// Channel: API log — helpers
// ---------------------------------------------------------------------------

/**
 * Process one JSON-line API log file and return in-window error/warn entries.
 * Never bare-grep "error" — SQL column names in debug lines false-positive.
 * @param {string} filePath
 * @param {Date} start
 * @param {Date} end
 * @param {{ route: string; enteredAt: string; leftAt: string }[]} routes
 * @returns {object[]}
 */
const processApiLogFile = (filePath, start, end, routes) => {
  const content = readFileSync(filePath, "utf8");
  const entries = [];

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;

    const parsed = tryParseJson(line);
    // Skip non-JSON lines (startup banners, etc.)
    if (!parsed || typeof parsed !== "object") continue;

    if (!API_LOG_LEVELS.has(parsed.level)) continue;
    // Logger writes "timestamp"; accept "time" as a fallback for rotated logs.
    const rawTime = parsed.timestamp ?? parsed.time;
    if (!rawTime || !inWindow(rawTime, start, end)) continue;

    const ts = parseDate(rawTime);
    entries.push({
      channel: "apiLog",
      level: parsed.level,
      timestamp: rawTime,
      route: ts ? routeAt(routes, ts) : null,
      excerpt: String(parsed.msg ?? parsed.message ?? "").slice(0, 300),
    });
  }

  return entries;
};

// ---------------------------------------------------------------------------
// Channel: API log
// ---------------------------------------------------------------------------

/**
 * Read apps/api/.logs/driver/app.log (and rotated variants app.log.1, …),
 * filter by JSON `timestamp` field (with `time` as a fallback) within the
 * window and level in {error, warn}.
 *
 * @param {Date} start
 * @param {Date} end
 * @param {{ route: string; enteredAt: string; leftAt: string }[]} routes
 * @returns {{ liveness: string; entries: object[] }}
 */
const collectApiLog = (start, end, routes) => {
  const blind = { liveness: LIVENESS.BLIND, entries: [] };

  if (!existsSync(API_LOG_DIR)) return blind;

  const logFiles = readdirSync(API_LOG_DIR)
    .filter((f) => API_LOG_ROTATION_PATTERN.test(f))
    .map((f) => join(API_LOG_DIR, f));

  if (logFiles.length === 0) return blind;

  const entries = logFiles.flatMap((f) =>
    processApiLogFile(f, start, end, routes),
  );
  return { liveness: livenessFrom(entries), entries };
};

// ---------------------------------------------------------------------------
// Channel: Bugsink — helpers
// ---------------------------------------------------------------------------

/**
 * Fetch and parse Bugsink projects list. Returns null when unreachable or invalid.
 * @returns {Promise<object[] | null>}
 */
const fetchBugsinkProjects = async () => {
  try {
    const resp = await fetch(`${BUGSINK_BASE_URL}${BUGSINK_PROJECTS_PATH}`, {
      signal: AbortSignal.timeout(BUGSINK_TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    const parsed = tryParseJson(await resp.text());
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Fetch issues for one Bugsink project and return in-window entries.
 * Returns { entries, failed } so callers can distinguish an unreachable
 * issues endpoint (failed=true → channel must be BLIND) from a genuinely
 * empty window (failed=false, entries=[]).
 * @param {object} project
 * @param {Date} start
 * @param {Date} end
 * @param {{ route: string; enteredAt: string; leftAt: string }[]} routes
 * @returns {Promise<{ entries: object[]; failed: boolean }>}
 */
const fetchBugsinkProjectIssues = async (project, start, end, routes) => {
  const orgSlug = project.organization?.slug ?? project.slug ?? "default";
  const projectSlug = project.slug;
  if (!projectSlug) return { entries: [], failed: false };

  const url =
    `${BUGSINK_BASE_URL}/api/0/projects/${orgSlug}/${projectSlug}/issues/` +
    `?start=${start.toISOString()}&end=${end.toISOString()}&limit=${BUGSINK_ISSUES_LIMIT}`;

  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(BUGSINK_TIMEOUT_MS),
    });
    if (!resp.ok) return { entries: [], failed: true };

    const issues = tryParseJson(await resp.text());
    if (!Array.isArray(issues)) return { entries: [], failed: true };

    const entries = issues.flatMap((issue) => {
      const ts = parseDate(issue.firstSeen ?? issue.lastSeen);
      if (!ts || !inWindow(ts, start, end)) return [];
      return [
        {
          channel: "bugsink",
          level: "error",
          timestamp: ts.toISOString(),
          route: routeAt(routes, ts),
          excerpt: String(issue.title ?? issue.culprit ?? "").slice(0, 300),
        },
      ];
    });
    return { entries, failed: false };
  } catch {
    return { entries: [], failed: true };
  }
};

// ---------------------------------------------------------------------------
// Channel: Bugsink
// ---------------------------------------------------------------------------

/**
 * Query Bugsink for error events created in the run window.
 * Access method: Bugsink HTTP API (Sentry-compatible REST, single-user mode).
 * The `bugsink-manage` CLI is an alternative but requires docker exec and
 * is not needed when the HTTP API is reachable.
 *
 * @param {Date} start
 * @param {Date} end
 * @param {{ route: string; enteredAt: string; leftAt: string }[]} routes
 * @returns {Promise<{ liveness: string; entries: object[] }>}
 */
const collectBugsink = async (start, end, routes) => {
  const projects = await fetchBugsinkProjects();
  if (!projects) return { liveness: LIVENESS.BLIND, entries: [] };

  const results = await Promise.all(
    projects.map((p) => fetchBugsinkProjectIssues(p, start, end, routes)),
  );

  // If ANY project's issues endpoint was unreachable, treat the whole channel as
  // BLIND — a false-empty result is worse than admitting we don't know.
  const anyFailed = results.some((r) => r.failed);
  if (anyFailed) return { liveness: LIVENESS.BLIND, entries: [] };

  const allEntries = results.flatMap((r) => r.entries);
  return { liveness: livenessFrom(allEntries), entries: allEntries };
};

// ---------------------------------------------------------------------------
// Channel: Loki — helpers
// ---------------------------------------------------------------------------

/**
 * Extract the level from a Loki log line (JSON or plain text).
 * Returns null if the line should be skipped (not error/warn).
 * @param {string} logLine
 * @returns {{ level: string; msgText: string } | null}
 */
const parseLokiLine = (logLine) => {
  const parsed = tryParseJson(logLine);
  if (parsed && typeof parsed === "object") {
    const level = parsed.level ?? "info";
    if (!API_LOG_LEVELS.has(level)) return null;
    return { level, msgText: String(parsed.msg ?? parsed.message ?? logLine) };
  }
  // Non-JSON: include only if it looks like an error or warn.
  if (!/error|warn/i.test(logLine)) return null;
  const level = /error/i.test(logLine) ? "error" : "warn";
  return { level, msgText: logLine };
};

/**
 * Convert Loki stream values to HitEntry objects.
 * @param {[string, string][]} values  Loki [tsNs, logLine] pairs.
 * @param {Date} start
 * @param {Date} end
 * @param {{ route: string; enteredAt: string; leftAt: string }[]} routes
 * @returns {object[]}
 */
const lokiValuesToEntries = (values, start, end, routes) =>
  values.flatMap(([tsNsStr, logLine]) => {
    const ts = new Date(Number(tsNsStr) / 1_000_000);
    if (!inWindow(ts, start, end)) return [];

    const parsed = parseLokiLine(logLine);
    if (!parsed) return [];

    return [
      {
        channel: "loki",
        level: parsed.level,
        timestamp: ts.toISOString(),
        route: routeAt(routes, ts),
        excerpt: parsed.msgText.slice(0, 300),
      },
    ];
  });

// ---------------------------------------------------------------------------
// Channel: Loki (via Grafana datasource proxy)
// ---------------------------------------------------------------------------

/**
 * Query Loki via Grafana's datasource proxy. Uses Node 18+ global fetch
 * (no curl, no PATH dependency) with HTTP Basic auth. Node's fetch does not
 * honour HTTP_PROXY, so loopback calls are safe without --noproxy.
 *
 * Datasource UID "loki" confirmed in deploy/grafana/provisioning/datasources/loki.yml.
 *
 * @param {Date} start
 * @param {Date} end
 * @param {{ route: string; enteredAt: string; leftAt: string }[]} routes
 * @returns {Promise<{ liveness: string; entries: object[] }>}
 */
const collectLoki = async (start, end, routes) => {
  const blind = { liveness: LIVENESS.BLIND, entries: [] };

  // Convert to nanoseconds for Loki's time range params.
  const startNs = String(start.getTime() * 1_000_000);
  const endNs = String(end.getTime() * 1_000_000);
  const url =
    `${GRAFANA_BASE_URL}${LOKI_PROXY_PATH}` +
    `?query=${encodeURIComponent(LOKI_QUERY)}` +
    `&start=${startNs}&end=${endNs}&limit=${LOKI_LIMIT}`;

  const raw = await fetchWithAuth(url, {
    user: GRAFANA_USER,
    pass: GRAFANA_PASS,
    timeoutMs: LOKI_TIMEOUT_MS,
  });
  if (!raw) return blind;

  const parsed = tryParseJson(raw);
  if (!parsed || parsed.status !== "success") return blind;

  const resultArr = parsed.data?.result ?? [];
  if (resultArr.length === 0)
    return { liveness: LIVENESS.HAS_STREAMS, entries: [] };

  const entries = resultArr.flatMap((stream) =>
    lokiValuesToEntries(stream.values ?? [], start, end, routes),
  );

  return { liveness: livenessFrom(entries), entries };
};

// ---------------------------------------------------------------------------
// Candidate builder
// ---------------------------------------------------------------------------

/**
 * Convert a channel hit into a Phase-3-compatible candidate.
 * kind:"env", no intentId (oracle-free path in verify.workflow.mjs).
 * @param {{ channel: string; level: string; timestamp: string; route: string | null; excerpt: string }} hit
 * @returns {object}
 */
const hitToCandidate = (hit) => ({
  route: hit.route ?? "(unknown — outside catalog routes)",
  kind: "env",
  observed: `[${hit.channel}] ${hit.level}: ${hit.excerpt}`,
  expected: "",
  evidence: `channel=${hit.channel} ts=${hit.timestamp}`,
  severity: SEVERITY_BY_LEVEL[hit.level] ?? "low",
});

// ---------------------------------------------------------------------------
// Report builder — helpers
// ---------------------------------------------------------------------------

/**
 * Render the hits section for one channel in the markdown report.
 * @param {string} name
 * @param {{ liveness: string; entries: object[] }} channel
 * @returns {string[]}
 */
const renderChannelSection = (name, { liveness, entries }) => {
  if (liveness === LIVENESS.BLIND) {
    return [
      `**${name}** — BLIND (unreachable or unwired; empty result is not clean)`,
      ``,
    ];
  }

  if (entries.length === 0) {
    return [`**${name}** — no hits in window`, ``];
  }

  const lines = [`**${name}** (${entries.length} hits)`, ``];
  for (const entry of entries.slice(0, REPORT_MAX_HITS_PER_CHANNEL)) {
    const routePart = entry.route ? ` on \`${entry.route}\`` : "";
    lines.push(
      `- \`${entry.timestamp}\` [${entry.level}]${routePart}: ${entry.excerpt}`,
    );
  }
  if (entries.length > REPORT_MAX_HITS_PER_CHANNEL) {
    lines.push(
      `  *(${entries.length - REPORT_MAX_HITS_PER_CHANNEL} more — see raw channel)*`,
    );
  }
  lines.push(``);
  return lines;
};

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

/**
 * Build the "Environment feedback" markdown section for the per-role report.
 * @param {string} role
 * @param {{ startedAt: string; endedAt: string }} window
 * @param {Record<string, { liveness: string; entries: object[] }>} channels
 * @param {boolean} canaryDetected
 * @returns {string}
 */
const buildReport = (role, window, channels, canaryDetected) => {
  const canaryStatus = canaryDetected
    ? "detected ✓"
    : "NOT DETECTED — console channel was blind during the drive";

  const livenessRows = Object.entries(channels)
    .map(
      ([name, { liveness, entries }]) =>
        `| ${name} | ${liveness} | ${entries.length} |`,
    )
    .join("\n");

  const hitSections = Object.entries(channels)
    .flatMap(([name, ch]) => renderChannelSection(name, ch))
    .join("\n");

  return [
    `## Environment feedback (Phase 2.5)`,
    ``,
    `**Role:** ${role}  `,
    `**Window:** ${window.startedAt} → ${window.endedAt}  `,
    `**Console canary (DRIVER_CANARY_42):** ${canaryStatus}`,
    ``,
    `### Channel liveness`,
    ``,
    `| Channel | Liveness | Hits |`,
    `|---------|----------|------|`,
    livenessRows,
    ``,
    `### Hits by channel`,
    ``,
    hitSections,
  ].join("\n");
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Derive a fallback time window from the mtime of console log files when the
 * drive timeline is absent or partial (e.g. after a crash mid-run).
 * Returns null when no console files are present.
 * @returns {{ start: Date; end: Date } | null}
 */
const windowFromConsoleFiles = () => {
  if (!existsSync(PLAYWRIGHT_MCP_DIR)) return null;

  const files = readdirSync(PLAYWRIGHT_MCP_DIR).filter((f) =>
    CONSOLE_LOG_PATTERN.test(f),
  );
  if (files.length === 0) return null;

  const mtimes = files.map(
    (f) => statSync(join(PLAYWRIGHT_MCP_DIR, f)).mtimeMs,
  );
  const end = new Date(Math.max(...mtimes));
  // Assume at most 2-hour drive window when we have no better data.
  const start = new Date(end.getTime() - 2 * 60 * 60 * 1000);
  return { start, end };
};

/**
 * Collect environment feedback for a completed drive run.
 *
 * When `timeline` is absent or lacks valid `startedAt`/`endedAt` (e.g. a
 * crashed drive that emitted no JSON), the collector falls back to a
 * wall-clock window derived from console-file mtimes so on-disk logs are
 * still swept. If no fallback is possible the function throws.
 *
 * @param {{ role: string; timeline?: { startedAt?: string; endedAt?: string; routes?: Array<{ route: string; enteredAt: string; leftAt: string }> } }} params
 * @returns {Promise<{ role: string; window: object; channels: object; hits: object[]; report: string }>}
 */
/**
 * Resolve the time window from the timeline, falling back to console-file
 * mtimes when the timeline is absent or partial (e.g. a crashed drive).
 * Throws when neither source can produce a valid window.
 * @param {{ startedAt?: string; endedAt?: string } | undefined} timeline
 * @returns {{ start: Date; end: Date }}
 */
const resolveWindow = (timeline) => {
  const start = parseDate(timeline?.startedAt ?? "");
  const end = parseDate(timeline?.endedAt ?? "");
  if (start && end) return { start, end };

  const fallback = windowFromConsoleFiles();
  if (fallback) return fallback;

  throw new Error(
    `Invalid timeline (startedAt=${timeline?.startedAt}, endedAt=${timeline?.endedAt}) and no console files found for fallback window.`,
  );
};

export async function collectEnvFeedback({ role, timeline }) {
  const { start, end } = resolveWindow(timeline);
  const routes = timeline?.routes ?? [];

  const [consoleResult, apiLogResult, lokiResult, bugsinkResult] =
    await Promise.all([
      Promise.resolve(collectConsole(start, end, routes)),
      Promise.resolve(collectApiLog(start, end, routes)),
      collectLoki(start, end, routes),
      collectBugsink(start, end, routes),
    ]);

  const channels = {
    console: consoleResult,
    apiLog: apiLogResult,
    bugsink: bugsinkResult,
    loki: lokiResult,
  };

  const hits = Object.values(channels)
    .flatMap(({ entries }) => entries)
    .map(hitToCandidate);

  const windowStr = {
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
  };

  const report = buildReport(
    role,
    windowStr,
    channels,
    consoleResult.canaryDetected ?? false,
  );

  return {
    role,
    window: windowStr,
    channels,
    hits,
    report,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], "file://").href
) {
  const rawArg = process.argv[2];

  if (!rawArg) {
    process.stderr.write(
      'Usage: node collect-env-feedback.mjs \'{"role":"viewer","timeline":{"startedAt":"...","endedAt":"...","routes":[...]}}\'\n',
    );
    process.exit(1);
  }

  const parsedArg = tryParseJson(rawArg);
  if (!parsedArg) {
    process.stderr.write("Failed to parse argument as JSON\n");
    process.exit(1);
  }

  collectEnvFeedback(parsedArg)
    .then((result) => {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    })
    .catch((err) => {
      process.stderr.write(`collect-env-feedback error: ${err.message}\n`);
      process.exit(1);
    });
}
