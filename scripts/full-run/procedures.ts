import { execFileSync } from "node:child_process";

import {
  AUTH_ROUTE_PREFIX,
  SCREENS_PER_PROCEDURE,
  TOP_N,
} from "./constants.ts";
import {
  httpCalls,
  mappedRoutes,
  parseApiLine,
  type ProcedureUse,
  text,
} from "./logs.ts";
import { PROCEDURE_REASONS } from "./reasons.ts";

const GREP = process.env.GREP_BIN ?? "grep";

export interface Procedure {
  path: string;
  type: string;
}
export interface ProcedureRow extends Procedure {
  /** At least one call reached the api, even if it was rejected. */
  called: boolean;
  /** At least one call finished successfully: only these count as exercised. */
  exercised: boolean;
  calls: number;
  roles: string[];
  screens: string[];
  /** Where the successful calls came from: the interface, the synthetic scenario, or both. */
  via: "ui" | "scenario" | "ui+scenario" | "";
  reason: string;
}
export interface RouteRow {
  route: string;
  calls: number;
}

/** Web source files that call the procedure (the screen it belongs to). */
function webSources(path: string): string[] {
  const dotted = path.replaceAll(".", String.raw`\.`);
  try {
    return execFileSync(
      GREP,
      ["-rlE", String.raw`\.${dotted}\b`, "apps/web/src"].concat([
        "--include=*.ts",
        "--include=*.tsx",
        "--exclude=*.test.*",
      ]),
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean)
      .map((f) => f.replace("apps/web/src/", ""));
  } catch {
    return [];
  }
}

function reason(p: Procedure, called: boolean): string {
  const known = PROCEDURE_REASONS[p.path];
  if (known) return `${known.kind}: ${known.why}`;
  return called
    ? "unclassified: called, but every call failed"
    : "unclassified: never called";
}

function via(ok: number, scenarioOk: number): ProcedureRow["via"] {
  if (ok === 0) return "";
  if (scenarioOk === 0) return "ui";
  return scenarioOk >= ok ? "scenario" : "ui+scenario";
}

/** `scenarioOk` is the number of successful calls the synthetic scenario made per procedure. */
export function procedureRows(
  procedures: readonly Procedure[],
  used: ReadonlyMap<string, ProcedureUse>,
  scenarioOk: ReadonlyMap<string, number> = new Map(),
): ProcedureRow[] {
  return procedures.map((p) => {
    const use = used.get(p.path);
    const ok = use?.ok ?? 0;
    return {
      ...p,
      called: use !== undefined,
      exercised: ok > 0,
      calls: use?.calls ?? 0,
      roles: [...(use?.roles ?? [])].toSorted((a, b) => a.localeCompare(b)),
      screens: webSources(p.path).slice(0, SCREENS_PER_PROCEDURE),
      via: via(ok, scenarioOk.get(p.path) ?? 0),
      reason: ok > 0 ? "" : reason(p, use !== undefined),
    };
  });
}

const EXPRESS_ROUTES = [
  "GET /auth/saml/login",
  "POST /auth/saml/callback",
  "GET /admin/queues",
];

function routeHits(
  seen: ReadonlyMap<string, number>,
  method: string,
  path: string,
): number {
  let hits = 0;
  for (const [key, count] of seen) {
    const [m, p = ""] = key.split(" ");
    const sharedAuth = p === "/auth/*" && path.startsWith(AUTH_ROUTE_PREFIX);
    if (m === method && (p.startsWith(path) || sharedAuth)) hits += count;
  }
  return hits;
}

/** HTTP routes: mapped by Nest at startup plus the Express-level ones; counters from Prometheus and the access log. */
export function routeRows(
  apiLines: readonly string[],
  metrics: ReadonlyMap<string, number>,
): RouteRow[] {
  const seen = new Map(httpCalls(apiLines));
  for (const [k, v] of metrics) seen.set(k, Math.max(seen.get(k) ?? 0, v));
  const routes = new Set([...mappedRoutes(apiLines), ...EXPRESS_ROUTES]);
  return [...routes].map((route) => {
    const [method = "", path = ""] = route.split(" ");
    return { route, calls: routeHits(seen, method, path) };
  });
}

const ID = /[0-9a-f]{8}-[0-9a-f-]{27}/g;

/** Warnings and errors grouped by message with the error text, most frequent first. */
export function errorSummary(apiLines: readonly string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const line of apiLines) {
    const e = parseApiLine(line);
    if (e?.level !== "warn" && e?.level !== "error") continue;
    const err = e.error as { message?: string } | undefined;
    const head = text(e.message).split(" {")[0] ?? "";
    const detail = err?.message ? `: ${err.message}` : "";
    const key = `${text(e.level)} ${text(e.phase)} ${head}${detail}`.replaceAll(
      ID,
      "<id>",
    );
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].toSorted((a, b) => b[1] - a[1]).slice(0, TOP_N);
}
