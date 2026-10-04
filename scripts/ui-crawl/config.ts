import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { STAMP_LENGTH } from "./constants.ts";
import type { Config } from "./types.ts";

const SECRETS = join(homedir(), ".local/state/wr-tester/secrets.env");
const OUT_ROOT = join(
  homedir(),
  ".local/state/session-review/weeklyreport-20260929/kit-crawler-20261004",
);

export type Cli = Readonly<{
  config: Config;
  roles: readonly string[];
  role: string | null;
  parallel: number;
  secrets: string;
}>;

export function parseCli(argv: readonly string[]): Cli {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      url: { type: "string", default: "http://localhost:8080" },
      out: { type: "string" },
      roles: { type: "string", default: "lead,head,viewer,admin" },
      role: { type: "string" },
      widths: { type: "string", default: "1280,375" },
      "max-controls": { type: "string", default: "40" },
      "max-pages": { type: "string", default: "20" },
      "no-video": { type: "boolean", default: false },
      parallel: { type: "string", default: "4" },
      secrets: { type: "string", default: SECRETS },
    },
  });
  const stamp = new Date()
    .toISOString()
    .replaceAll(/[:.]/g, "-")
    .slice(0, STAMP_LENGTH);
  return {
    config: {
      url: values.url.replace(/\/$/, ""),
      out: values.out ?? join(OUT_ROOT, `crawl-${stamp}`),
      widths: values.widths.split(",").map(Number),
      maxControls: Number(values["max-controls"]),
      maxPages: Number(values["max-pages"]),
      video: !values["no-video"],
    },
    roles: values.roles.split(","),
    role: values.role ?? null,
    parallel: Number(values.parallel),
    secrets: values.secrets,
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
  } catch {
    // no secrets file: rely on the environment alone
  }
  return {
    ...fromFile,
    ...Object.fromEntries(
      Object.entries(process.env).filter(([k]) => k.startsWith("PW_")),
    ),
  } as Record<string, string>;
}
