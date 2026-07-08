import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const scriptPath = fileURLToPath(new URL("./agent-council.mjs", import.meta.url));
const repoRoot = resolve(dirname(scriptPath), "../../../..");

test("extracts standard child headings into JSON and summary", () => {
  const result = runCouncil([
    "--json",
    "--no-claude",
    "--codex-cmd",
    headingCommand("SHIP", "High"),
    "--opencode-cmd",
    headingCommand("FIX", "Medium"),
    "--",
    "structured stub",
  ]);

  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);

  assert.equal(body.health.total, 2);
  assert.equal(body.health.statuses.ok, 2);
  assert.equal(body.health.incomplete, 0);
  assert.equal(body.results[0].extracted.position, "SHIP");
  assert.equal(body.results[1].extracted.confidence, "Medium");
  assert.match(body.advisorPrompt, /\| codex \| ok \|/);
  assert.match(body.advisorPrompt, /\| opencode-custom \| ok \|/);
});

test("global deadline terminates slow advisors", () => {
  const sleeper = command(["node", "-e", "setTimeout(() => {}, 1000)"]);
  const result = runCouncil([
    "--json",
    "--no-claude",
    "--deadline-ms",
    "50",
    "--codex-cmd",
    sleeper,
    "--opencode-cmd",
    sleeper,
    "--",
    "deadline stub",
  ]);

  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);

  assert.equal(body.health.statuses.deadline, 2);
  assert.deepEqual(
    body.results.map((entry) => entry.status),
    ["deadline", "deadline"],
  );
});

test("nested council invocation is refused", () => {
  const result = runCouncil(["--", "nested stub"], {
    AGENT_COUNCIL_DEPTH: "1",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Nested agent-council invocation refused/);
});

test("strict OpenCode permissions override inherited permissive env by default", () => {
  const result = runCouncil(
    [
      "--json",
      "--no-claude",
      "--codex-cmd",
      headingCommand("SHIP", "High"),
      "--opencode-cmd",
      command(["node", "-e", "console.log(process.env.OPENCODE_PERMISSION)"]),
      "--",
      "permission stub",
    ],
    {
      OPENCODE_PERMISSION: JSON.stringify({ bash: "allow" }),
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  const opencodePermission = JSON.parse(body.results[1].stdout);

  assert.equal(opencodePermission.bash, "deny");
  assert.equal(opencodePermission.skill["*"], "deny");
});

function runCouncil(args, envOverrides = {}) {
  const env = {
    ...process.env,
    ...envOverrides,
  };
  delete env.AGENT_COUNCIL_DEPTH;

  if (envOverrides.AGENT_COUNCIL_DEPTH) {
    env.AGENT_COUNCIL_DEPTH = envOverrides.AGENT_COUNCIL_DEPTH;
  }

  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
}

function headingCommand(position, confidence) {
  return command([
    "node",
    "-e",
    `console.log(${JSON.stringify(
      [
        "## Position",
        position,
        "",
        "## Assumptions",
        "None",
        "",
        "## Evidence",
        "Stub",
        "",
        "## Risks",
        "None",
        "",
        "## Implementation Notes",
        "Keep",
        "",
        "## Confidence",
        confidence,
      ].join("\n"),
    )})`,
  ]);
}

function command(parts) {
  return JSON.stringify(parts);
}
