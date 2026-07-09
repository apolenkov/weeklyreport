import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const scriptPath = fileURLToPath(new URL("./agent-council.mjs", import.meta.url));
const repoRoot = resolve(dirname(scriptPath), "../../../..");

test("missing config fails with a sample-config pointer", () => {
  const result = runCouncil(["--json", "--config", "does-not-exist.yaml", "--", "stub"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Config required/);
  assert.match(result.stderr, /--print-sample-config/);
});

test("sample config prints and validates as restricted YAML", () => {
  const printed = runCouncil(["--print-sample-config"]);
  assert.equal(printed.status, 0, printed.stderr);
  assert.match(printed.stdout, /version: 1/);
  assert.match(printed.stdout, /profiles:/);

  const temp = makeTempConfig(printed.stdout);
  const validated = runCouncil(["--config", temp.configPath, "--profile", "soft", "--validate-config"]);

  assert.equal(validated.status, 0, validated.stderr);
  assert.match(validated.stdout, /agent-council config ok: soft \(soft\)/);
});

test("soft mode extracts configured child headings into JSON and summary", () => {
  const temp = makeTempConfig(configWithProfiles({
    profiles: `
  soft:
    mode: soft
    advisors: [codex-stub, opencode-stub]
    artifacts_dir: "${escapeYaml(tempArtifactsDir())}"
`,
    seats: `
  codex-stub:
    provider: codex
    command: ${commandYaml(headingCommand("SHIP", "High"))}
    timeout_ms: 1000

  opencode-stub:
    provider: opencode
    command: ${commandYaml(headingCommand("FIX", "Medium"))}
    concurrency_group: opencode
    timeout_ms: 1000
`,
  }));
  const result = runCouncil(["--json", "--config", temp.configPath, "--profile", "soft", "--", "structured stub"]);

  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);

  assert.equal(body.mode, "soft");
  assert.equal(body.health.total, 2);
  assert.equal(body.health.statuses.ok, 2);
  assert.equal(body.health.incomplete, 0);
  assert.equal(body.results[0].extracted.position, "SHIP");
  assert.equal(body.results[1].extracted.confidence, "Medium");
  assert.match(body.advisorPrompt, /\| codex-stub \| ok \|/);
  assert.match(body.advisorPrompt, /\| opencode-stub \| ok \|/);
});

test("advisor count comes only from config", () => {
  const temp = makeTempConfig(configWithProfiles({
    profiles: `
  soft:
    mode: soft
    advisors: [one, two, three]
    artifacts_dir: "${escapeYaml(tempArtifactsDir())}"
`,
    seats: `
  one:
    provider: custom
    command: ${commandYaml(headingCommand("ONE", "High"))}
  two:
    provider: custom
    command: ${commandYaml(headingCommand("TWO", "High"))}
  three:
    provider: custom
    command: ${commandYaml(headingCommand("THREE", "High"))}
`,
  }));
  const result = runCouncil(["--json", "--config", temp.configPath, "--profile", "soft", "--", "three seats"]);
  const body = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(body.health.total, 3);
  assert.deepEqual(body.results.map((entry) => entry.name), ["one", "two", "three"]);
});

test("cli timeout is the fallback for seats without timeout_ms", () => {
  const temp = makeTempConfig(configWithProfiles({
    profiles: `
  soft:
    mode: soft
    advisors: [one]
    artifacts_dir: "${escapeYaml(tempArtifactsDir())}"
`,
    seats: `
  one:
    provider: custom
    command: ${commandYaml(headingCommand("ONE", "High"))}
`,
  }));
  const result = runCouncil([
    "--json",
    "--dry-run",
    "--timeout-ms",
    "77",
    "--config",
    temp.configPath,
    "--profile",
    "soft",
    "--",
    "timeout fallback",
  ]);
  const body = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(body.results[0].timeoutMs, 77);
});

test("hard mode runs bounded self-grill and adversarial rounds", () => {
  const temp = makeTempConfig(configWithProfiles({
    profiles: `
  hard:
    mode: hard
    advisors: [critic]
    self_grill_rounds: 1
    adversarial_rounds: 2
    artifacts_dir: "${escapeYaml(tempArtifactsDir())}"
`,
    seats: `
  critic:
    provider: custom
    command: ${commandYaml(headingCommand("REVISED", "Medium"))}
    timeout_ms: 1000
`,
  }));
  const result = runCouncil(["--json", "--config", temp.configPath, "--profile", "hard", "--", "hard stub"]);
  const body = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    body.phases.map((phase) => phase.kind),
    ["initial", "self-grill-1", "adversarial-1", "adversarial-2"],
  );
  assert.equal(body.health.total, 4);
});

test("global deadline terminates slow configured advisors", () => {
  const sleeper = command(["node", "-e", "setTimeout(() => {}, 1000)"]);
  const temp = makeTempConfig(configWithProfiles({
    profiles: `
  soft:
    mode: soft
    advisors: [slow-one, slow-two]
    artifacts_dir: "${escapeYaml(tempArtifactsDir())}"
`,
    seats: `
  slow-one:
    provider: custom
    command: ${commandYaml(sleeper)}
    timeout_ms: 1000
  slow-two:
    provider: custom
    command: ${commandYaml(sleeper)}
    timeout_ms: 1000
`,
  }));
  const result = runCouncil([
    "--json",
    "--config",
    temp.configPath,
    "--profile",
    "soft",
    "--deadline-ms",
    "50",
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

test("nested council invocation is refused before config loading", () => {
  const result = runCouncil(["--", "nested stub"], {
    AGENT_COUNCIL_DEPTH: "1",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Nested agent-council invocation refused/);
});

test("strict OpenCode permissions override inherited permissive env by default", () => {
  const temp = makeTempConfig(configWithProfiles({
    profiles: `
  soft:
    mode: soft
    advisors: [opencode-stub]
    artifacts_dir: "${escapeYaml(tempArtifactsDir())}"
`,
    seats: `
  opencode-stub:
    provider: opencode
    command: ${commandYaml(command(["node", "-e", "console.log(process.env.OPENCODE_PERMISSION)"]))}
    concurrency_group: opencode
    timeout_ms: 1000
`,
  }));
  const result = runCouncil(
    ["--json", "--config", temp.configPath, "--profile", "soft", "--", "permission stub"],
    {
      OPENCODE_PERMISSION: JSON.stringify({ bash: "allow" }),
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  const opencodePermission = JSON.parse(body.results[0].stdout);

  assert.equal(opencodePermission.bash, "deny");
  assert.equal(opencodePermission.skill["*"], "deny");
});

test("full mode refuses missing explicit write allowance", () => {
  const temp = makeTempConfig(fullConfig({ builder: "builder", reviewer: "reviewer" }));
  const result = runCouncil([
    "--json",
    "--config",
    temp.configPath,
    "--profile",
    "full",
    "--proof-cmd",
    "node -e 'process.exit(0)'",
    "--",
    "full stub",
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--allow-writes/);
});

test("full mode validates builder and reviewer are different", () => {
  const temp = makeTempConfig(fullConfig({ builder: "builder", reviewer: "builder" }));
  const result = runCouncil(["--config", temp.configPath, "--profile", "full", "--validate-config"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /builder and reviewer must be different/);
});

test("resume commands reject --last", () => {
  const temp = makeTempConfig(fullConfig({
    builder: "builder",
    reviewer: "reviewer",
    resumeCommand: ["node", "-e", "console.log('bad')", "--last"],
  }));
  const result = runCouncil(["--config", temp.configPath, "--profile", "full", "--validate-config"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not --last/);
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
    maxBuffer: 1024 * 1024 * 8,
  });
}

function makeTempConfig(text) {
  const dir = mkdtempSync(join(tmpdir(), "agent-council-test-"));
  const configPath = join(dir, "agent-council.yaml");
  writeFileSync(configPath, text);
  return { configPath, dir };
}

function tempArtifactsDir() {
  const dir = mkdtempSync(join(tmpdir(), "agent-council-artifacts-"));
  mkdirSync(dir, { recursive: true });
  return dir;
}

function configWithProfiles({ profiles, seats }) {
  return `version: 1
default_profile: soft
profiles:
${profiles}
seats:
${seats}`;
}

function fullConfig({ builder, reviewer, resumeCommand = ["node", "-e", "console.log('resume ok')"] }) {
  return configWithProfiles({
    profiles: `
  full:
    mode: full
    advisors: [advisor]
    self_grill_rounds: 0
    adversarial_rounds: 0
    builder: ${builder}
    reviewer: ${reviewer}
    max_fix_rounds: 1
    artifacts_dir: "${escapeYaml(tempArtifactsDir())}"
`,
    seats: `
  advisor:
    provider: custom
    command: ${commandYaml(headingCommand("PLAN", "High"))}
  builder:
    provider: custom
    write_mode: true
    command: ${commandYaml(headingCommand("BUILD", "High"))}
    resume_command: ${commandYaml(command(resumeCommand))}
  reviewer:
    provider: custom
    write_mode: false
    command: ${commandYaml([
      "node",
      "-e",
      `console.log(${JSON.stringify([
        "## Position",
        "Approved",
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
        "None",
        "",
        "## Confidence",
        "High",
        "",
        "VERDICT: APPROVED",
      ].join("\n"))})`,
    ])}
`,
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
  return parts;
}

function commandYaml(parts) {
  return `[${parts.map((part) => JSON.stringify(part)).join(", ")}]`;
}

function escapeYaml(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
