import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { FULL_MAX_CONTROLS, STAMP_LENGTH } from "./constants.ts";
import {
  CRAWL_STATES,
  type CrawlState,
  type CrawlStateManifest,
  parseCrawlState,
  readStateManifest,
  stateEntryPaths,
} from "./states.ts";
import { type Config, ROLES } from "./types.ts";

const SECRETS = join(homedir(), ".local/state/wr-tester/secrets.env");
const OUT_ROOT = join(
  homedir(),
  ".local/state/session-review/weeklyreport-20260929/kit-crawler-20261004",
);
const SYNTHETIC_ORIGIN = "http://localhost:8080";
const OPTIONS = {
  quick: { type: "boolean", default: false },
  full: { type: "boolean", default: false },
  "admin-state-tabs": { type: "boolean", default: false },
  synthetic: { type: "boolean", default: false },
  url: { type: "string", default: SYNTHETIC_ORIGIN },
  out: { type: "string" },
  roles: { type: "string", default: "lead,head,viewer,admin" },
  role: { type: "string" },
  states: { type: "string" },
  widths: { type: "string", default: "1280,375" },
  "max-controls": { type: "string" },
  "max-pages": { type: "string" },
  "max-depth": { type: "string", default: "3" },
  "fixture-manifest": { type: "string" },
  "no-video": { type: "boolean", default: false },
  parallel: { type: "string", default: "4" },
  secrets: { type: "string", default: SECRETS },
} as const;

export type Cli = Readonly<{
  config: Config;
  roles: readonly string[];
  role: string | null;
  states: readonly CrawlState[];
  parallel: number;
  secrets: string;
  fixtureManifest: string | null;
  /** Walk only the admin tabs that follow the report lifecycle. */
  adminStateTabs: boolean;
}>;

function argumentsFor(argv: readonly string[]) {
  return parseArgs({ args: [...argv], options: OPTIONS }).values;
}

type CliValues = ReturnType<typeof argumentsFor>;

function positive(value: string, flag: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0)
    throw new Error(`${flag} must be a positive integer`);
  return number;
}

function origin(value: string): string {
  const url = new URL(value);
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("url must be an HTTP(S) origin without credentials");
  return url.origin;
}

function roleNames(value: string): readonly string[] {
  const names = value.split(",");
  if (names.some((name) => !ROLES.some((role) => role.name === name)))
    throw new Error("roles must be lead, head, viewer or admin");
  return [...new Set(names)];
}

function childRole(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (value.includes(",")) throw new Error("--role must name exactly one role");
  roleNames(value);
  return value;
}

function stateNames(value: string | undefined): readonly CrawlState[] {
  return value === undefined
    ? CRAWL_STATES
    : [...new Set(value.split(",").map(parseCrawlState))];
}

function limits(values: CliValues) {
  return {
    maxDepth: positive(values["max-depth"], "max-depth"),
    widths: [
      ...new Set(
        values.widths.split(",").map((value) => positive(value, "widths")),
      ),
    ],
    maxControls: positive(
      values["max-controls"] ??
        (values.full ? String(FULL_MAX_CONTROLS) : "40"),
      "max-controls",
    ),
    maxPages: positive(
      values["max-pages"] ??
        (values.full ? String(Number.MAX_SAFE_INTEGER) : "20"),
      "max-pages",
    ),
  };
}

function fixture(
  values: CliValues,
  url: string,
  states: readonly CrawlState[],
): CrawlStateManifest | null {
  const file = values["fixture-manifest"];
  if (file === undefined) {
    if (values.synthetic)
      throw new Error("--synthetic needs --fixture-manifest");
    return null;
  }
  if (
    !values.full ||
    url !== SYNTHETIC_ORIGIN ||
    process.env.CRAWL_SYNTHETIC_ORIGIN !== url
  )
    throw new Error(
      "Synthetic fixtures require the guarded canonical tester stand; use walk.sh --full",
    );
  const manifest = readStateManifest(
    JSON.parse(readFileSync(file, "utf8")) as unknown,
  );
  if (!states.includes(manifest.state))
    throw new Error("Fixture manifest state must be included in --states");
  return manifest;
}

export function parseCli(argv: readonly string[]): Cli {
  const values = argumentsFor(argv);
  if (values.quick && values.full) throw new Error("Choose --quick or --full");
  const url = origin(values.url);
  const roles = roleNames(values.roles);
  const role = childRole(values.role);
  const parallel = positive(values.parallel, "parallel");
  const states = stateNames(values.states);
  const bounds = limits(values);
  const manifest = fixture(values, url, states);
  const stamp = new Date()
    .toISOString()
    .replaceAll(/[:.]/g, "-")
    .slice(0, STAMP_LENGTH);
  return {
    config: {
      ...bounds,
      mode: values.full ? "full" : "quick",
      state: manifest
        ? `${manifest.state}${values.synthetic ? "+synthetic" : ""}`
        : "observed",
      allowSynthetic: manifest !== null && values.synthetic,
      fixtureReportId: manifest?.reportId ?? null,
      entrypoints: manifest
        ? stateEntryPaths(
            role ?? roles[0] ?? "lead",
            manifest.state,
            values["admin-state-tabs"],
          )
        : [],
      url,
      out: values.out ?? join(OUT_ROOT, `crawl-${stamp}`),
      video: !values["no-video"],
    },
    roles,
    role,
    states,
    parallel: values.synthetic ? 1 : parallel,
    secrets: values.secrets,
    fixtureManifest: values["fixture-manifest"] ?? null,
    adminStateTabs: values["admin-state-tabs"],
  };
}

/** Passwords come from the environment first, then from a KEY=VALUE file kept outside Git. */
export function loadPasswords(file: string): Readonly<Record<string, string>> {
  const fromFile: Record<string, string> = {};
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = /^(?:export\s+)?(PW_[A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match?.[1] && match[2] !== undefined)
        fromFile[match[1]] = match[2].replaceAll(/^['"]|['"]$/g, "");
    }
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw new Error(`Cannot read crawler secrets file: ${file}`, {
        cause: error,
      });
  }
  return {
    ...fromFile,
    ...Object.fromEntries(
      Object.entries(process.env).filter(([k]) => k.startsWith("PW_")),
    ),
  } as Record<string, string>;
}
