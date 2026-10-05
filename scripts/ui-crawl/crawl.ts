import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type Cli, loadPasswords, parseCli } from "./config.ts";
import { renderMarkdown } from "./report.ts";
import { type RoleResult, ROLES } from "./types.ts";
import { crawlRole, writeJson } from "./worker.ts";

function runChild(cli: Cli, name: string): Promise<void> {
  const { config } = cli;
  const args = [
    "--experimental-strip-types",
    import.meta.filename,
    ...["--role", name, "--url", config.url, "--out", config.out],
    ...["--widths", config.widths.join(","), "--secrets", cli.secrets],
    ...["--max-controls", String(config.maxControls)],
    ...["--max-pages", String(config.maxPages)],
    ...(config.video ? [] : ["--no-video"]),
  ];
  return new Promise((resolve, reject) => {
    spawn(process.execPath, args, { stdio: "inherit" }).on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`role ${name} exited with ${String(code)}`));
    });
  });
}

/** Runs the roles with at most `limit` children at once; the stand throttles by IP. */
async function runPool(
  cli: Cli,
): Promise<readonly PromiseSettledResult<void>[]> {
  const queue = [...cli.roles];
  const results: PromiseSettledResult<void>[] = [];
  const lane = async (): Promise<void> => {
    for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
      results.push(...(await Promise.allSettled([runChild(cli, name)])));
    }
  };
  await Promise.all(Array.from({ length: cli.parallel }, lane));
  return results;
}

function readRole(out: string, name: string): readonly RoleResult[] {
  try {
    return [
      JSON.parse(
        readFileSync(join(out, `role-${name}.json`), "utf8"),
      ) as RoleResult,
    ];
  } catch {
    return [];
  }
}

function childMode(cli: Cli, roleName: string): void {
  const role = ROLES.find((r) => r.name === roleName);
  const password = role
    ? loadPasswords(cli.secrets)[role.passwordKey]
    : undefined;
  if (!role || !password)
    throw new Error(`No role or password for ${roleName}`);
  const start = performance.now();
  const runs = crawlRole(cli.config, role, password);
  const result: RoleResult = {
    role: role.name,
    ms: Math.round(performance.now() - start),
    runs,
  };
  writeJson(join(cli.config.out, `role-${role.name}.json`), result);
}

async function parentMode(cli: Cli): Promise<void> {
  const { config } = cli;
  const started = new Date().toISOString();
  const start = performance.now();
  const settled = await runPool(cli);
  const wallMs = Math.round(performance.now() - start);
  // Every role file in the output directory counts, so a failed role can be re-run into the same report.
  const results = ROLES.flatMap((role) => readRole(config.out, role.name));
  const meta = { url: config.url, started, wallMs, parallel: cli.parallel };
  writeJson(join(config.out, "report.json"), { ...meta, results });
  writeFileSync(join(config.out, "report.md"), renderMarkdown(meta, results));
  console.log(`Report: ${join(config.out, "report.md")} (${wallMs} ms)`);
  const failed = settled.filter((s) => s.status === "rejected");
  if (failed.length > 0) throw new Error(`${failed.length} role run(s) failed`);
}

const cli = parseCli(process.argv.slice(2));
mkdirSync(cli.config.out, { recursive: true });
if (cli.role) childMode(cli, cli.role);
else await parentMode(cli);
