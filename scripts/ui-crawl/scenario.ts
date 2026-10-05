import { mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { loadPasswords } from "./config.ts";
import { adminScenario } from "./scenario-admin.ts";
import { type Api, type CallRecord, createApi } from "./scenario-api.ts";
import { reportScenario } from "./scenario-reports.ts";

const SECRETS = join(homedir(), ".local/state/wr-tester/secrets.env");
const GROUPS: Readonly<Record<string, (api: Api) => void>> = {
  admin: adminScenario,
  reports: reportScenario,
};
const COLUMN = { role: 6, path: 34 } as const;

function line(call: CallRecord): string {
  const result = call.ok ? "" : ` -> ${String(call.status)} ${call.code}`;
  return `${call.ok === (call.expected === "ok") ? "ok  " : "FAIL"} ${call.role.padEnd(COLUMN.role)} ${call.path.padEnd(COLUMN.path)} ${call.step}${result}`;
}

/** Runs the groups; a group that throws is recorded and the next one still runs. */
function runGroups(api: Api, names: readonly string[]): readonly string[] {
  const crashes: string[] = [];
  for (const name of names) {
    const group = GROUPS[name];
    if (!group) throw new Error(`Unknown scenario group ${name}`);
    try {
      group(api);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : "failed";
      crashes.push(`${name}: ${reason}`);
    }
  }
  return crashes;
}

/**
 * Synthetic API scenario for the tester stand: the handlers the crawler leaves alone as dangerous are called
 * as the signed-in role, in an order that keeps each step valid. Usage:
 *   scenario.ts --url http://localhost:8080 --out <dir> [--only admin,reports]
 * The stand must be freshly reset; run reset.sh afterwards. Exit 1 when a call did not end as the step expected.
 */
function main(): number {
  const { values } = parseArgs({
    options: {
      url: { type: "string", default: "http://localhost:8080" },
      out: { type: "string" },
      secrets: { type: "string", default: SECRETS },
      only: { type: "string" },
    },
  });
  if (!values.out) throw new Error("--out is required");
  mkdirSync(values.out, { recursive: true });
  const api = createApi(values.url, loadPasswords(values.secrets), tmpdir());
  let crashes: readonly string[];
  try {
    crashes = runGroups(
      api,
      values.only ? values.only.split(",") : Object.keys(GROUPS),
    );
  } finally {
    api.close();
  }
  const unexpected = api.calls.filter(
    (call) => call.ok !== (call.expected === "ok"),
  );
  writeFileSync(
    join(values.out, "scenarios.json"),
    JSON.stringify({ calls: api.calls, crashes }, null, 2),
  );
  for (const call of api.calls) console.log(line(call));
  for (const crash of crashes) console.log(`CRASH ${crash}`);
  console.log(
    `${String(api.calls.length)} calls, ${String(unexpected.length)} unexpected, ${String(crashes.length)} crashed group(s)`,
  );
  return unexpected.length + crashes.length === 0 ? 0 : 1;
}

process.exitCode = main();
