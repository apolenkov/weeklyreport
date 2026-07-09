import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

const scriptPath = fileURLToPath(new URL("./agent-council.mjs", import.meta.url));
const skillRoot = resolve(dirname(scriptPath), "..");

test("full mode runs builder, proof, reviewer, and writes artifacts through the public CLI", () => {
  const repo = mkdtempSync(join(tmpdir(), "agent-council-e2e-repo-"));
  const configDir = mkdtempSync(join(tmpdir(), "agent-council-e2e-config-"));
  const artifactsRoot = join(repo, ".agent-council", "runs");
  const configPath = join(configDir, "agent-council.yaml");
  const runId = "e2e-full-mode";

  git(repo, ["init", "-q"]);
  writeFileSync(configPath, e2eConfig(artifactsRoot));

  const result = spawnSync(
    process.execPath,
    [
      scriptPath,
      "--json",
      "--config",
      configPath,
      "--profile",
      "full",
      "--cwd",
      repo,
      "--run-id",
      runId,
      "--allow-writes",
      "--proof-cmd",
      "node -e \"process.exit(require('fs').existsSync('built.txt') ? 0 : 1)\"",
      "--",
      "Build the council-approved file",
    ],
    {
      cwd: skillRoot,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 8,
    },
  );

  assert.equal(result.status, 0, result.stderr);

  const body = JSON.parse(result.stdout);
  const runDir = join(artifactsRoot, runId);

  assert.equal(body.mode, "full");
  assert.deepEqual(
    body.phases.map((phase) => phase.kind),
    ["initial", "build"],
  );
  assert.deepEqual(
    body.build.results.map((entry) => entry.name),
    ["builder", "reviewer"],
  );
  assert.equal(body.build.proof.exitCode, 0);
  assert.equal(body.build.threadId, "e2e-thread");
  assert.equal(readFileSync(join(repo, "built.txt"), "utf8"), "built by e2e\n");
  assert.equal(existsSync(join(runDir, "task.md")), true);
  assert.equal(existsSync(join(runDir, "config.resolved.json")), true);
  assert.equal(existsSync(join(runDir, "council.initial.json")), true);
  assert.equal(existsSync(join(runDir, "build-report.json")), true);
  assert.equal(existsSync(join(runDir, "parent-synthesis-prompt.md")), true);
  assert.match(readFileSync(join(runDir, "parent-synthesis-prompt.md"), "utf8"), /Build Phase/);
});

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function e2eConfig(artifactsRoot) {
  return `version: 1
default_profile: full
profiles:
  full:
    mode: full
    advisors: [advisor]
    self_grill_rounds: 0
    adversarial_rounds: 0
    builder: builder
    reviewer: reviewer
    max_fix_rounds: 1
    artifacts_dir: "${escapeYaml(artifactsRoot)}"
seats:
  advisor:
    provider: custom
    command: ${commandYaml(headingCommand("Use the builder", "High"))}
  builder:
    provider: custom
    write_mode: true
    prompt_mode: stdin
    command: ${commandYaml(builderCommand())}
    resume_command: ${commandYaml(headingCommand("No fix needed", "High"))}
  reviewer:
    provider: custom
    write_mode: false
    command: ${commandYaml(reviewerCommand())}
`;
}

function headingCommand(position, confidence) {
  return [
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
        "E2E fixture",
        "",
        "## Risks",
        "None",
        "",
        "## Implementation Notes",
        "Keep going",
        "",
        "## Confidence",
        confidence,
      ].join("\n"),
    )})`,
  ];
}

function builderCommand() {
  return [
    "node",
    "-e",
    [
      "let input = '';",
      "process.stdin.on('data', (chunk) => { input += chunk; });",
      "process.stdin.on('end', () => {",
      "  require('fs').writeFileSync('built.txt', 'built by e2e\\n');",
      "  console.log('{\"type\":\"thread.started\",\"thread_id\":\"e2e-thread\"}');",
      `  console.log(${JSON.stringify(
        [
          "## Position",
          "Built the requested file",
          "",
          "## Assumptions",
          "The stdin prompt is the build contract",
          "",
          "## Evidence",
          "built.txt was written",
          "",
          "## Risks",
          "None",
          "",
          "## Implementation Notes",
          "No deviations",
          "",
          "## Confidence",
          "High",
          "",
          "BUILD: COMPLETE",
        ].join("\n"),
      )});`,
      "});",
    ].join(" "),
  ];
}

function reviewerCommand() {
  return [
    "node",
    "-e",
    `console.log(${JSON.stringify(
      [
        "## Position",
        "Approve the build",
        "",
        "## Assumptions",
        "Proof passed",
        "",
        "## Evidence",
        "Diff and proof were provided in the review prompt",
        "",
        "## Risks",
        "None",
        "",
        "## Implementation Notes",
        "No fix needed",
        "",
        "## Confidence",
        "High",
        "",
        "VERDICT: APPROVED",
      ].join("\n"),
    )})`,
  ];
}

function commandYaml(parts) {
  return `[${parts.map((part) => JSON.stringify(part)).join(", ")}]`;
}

function escapeYaml(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
