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
  const { artifactsRoot, body, repo, runId } = runFullMode({ runId: "e2e-full-mode" });
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
  assert.equal(body.build.verdict, "APPROVED");
  assert.equal(readFileSync(join(repo, "built.txt"), "utf8"), "built by e2e\n");
  assert.equal(existsSync(join(runDir, "task.md")), true);
  assert.equal(existsSync(join(runDir, "config.resolved.json")), true);
  assert.equal(existsSync(join(runDir, "council.initial.json")), true);
  assert.equal(existsSync(join(runDir, "build-report.json")), true);
  assert.equal(existsSync(join(runDir, "parent-synthesis-prompt.md")), true);
  assert.match(readFileSync(join(runDir, "parent-synthesis-prompt.md"), "utf8"), /Build Phase/);
});

test("the reviewer sees untracked files the builder created", () => {
  const { body } = runFullMode({ runId: "e2e-untracked" });
  const reviewer = body.build.results.find((entry) => entry.name === "reviewer");

  assert.match(reviewer.stdout, /SAW_BUILT_FILE:true/);
  assert.match(reviewer.stdout, /SAW_BUILT_CONTENT:true/);
});

test("the reviewer sees changes a builder committed, not just an untracked worktree", () => {
  const { body } = runFullMode({ builder: committingBuilderCommand(), runId: "e2e-committed" });
  const reviewer = body.build.results.find((entry) => entry.name === "reviewer");

  // The builder committed built.txt, so nothing is untracked or staged; only a diff
  // against the pinned pre-build baseline can surface it.
  assert.match(reviewer.stdout, /SAW_BUILT_FILE:true/);
  assert.match(reviewer.stdout, /SAW_BUILT_CONTENT:true/);
});

test("the parent prompt carries the builder's own report, not just its extracted sections", () => {
  const { body } = runFullMode({ runId: "e2e-builder-report" });

  assert.match(body.advisorPrompt, /BUILD: COMPLETE/);
  // thread.started appears only in the builder's raw stdout, never in extracted sections.
  assert.match(body.advisorPrompt, /thread\.started/);
  assert.match(body.advisorPrompt, /- verdict: APPROVED/);
});

test("the verdict is read from the last VERDICT line even when the CLI appends trailing output", () => {
  const { body } = runFullMode({
    runId: "e2e-trailing-verdict",
    reviewer: reviewerCommand({ trailer: '{"type":"turn.completed"}', verdict: "REVISE" }),
  });

  assert.deepEqual(
    body.build.results.map((entry) => entry.name),
    ["builder", "reviewer", "builder:fix-1", "reviewer"],
  );
  assert.equal(body.build.verdict, "REVISE");
  assert.equal(body.build.proofs.length, 2);
});

test("a hanging proof command is killed by the proof timeout", () => {
  const { body, result } = runFullMode({
    extraArgs: ["--proof-timeout-ms", "500"],
    proofCmd: 'node -e "setTimeout(() => {}, 60000)"',
    runId: "e2e-proof-timeout",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(body.build.proof.timedOut, true);
  assert.notEqual(body.build.proof.exitCode, 0);
});

function runFullMode({
  runId,
  builder = builderCommand(),
  reviewer = reviewerCommand({ verdict: "APPROVED" }),
  proofCmd = "node -e \"process.exit(require('fs').existsSync('built.txt') ? 0 : 1)\"",
  extraArgs = [],
}) {
  const repo = mkdtempSync(join(tmpdir(), "agent-council-e2e-repo-"));
  const configDir = mkdtempSync(join(tmpdir(), "agent-council-e2e-config-"));
  const artifactsRoot = join(repo, ".agent-council", "runs");
  const configPath = join(configDir, "agent-council.yaml");

  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.email", "e2e@example.com"]);
  git(repo, ["config", "user.name", "e2e"]);
  writeFileSync(configPath, e2eConfig(artifactsRoot, builder, reviewer));

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
      proofCmd,
      ...extraArgs,
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
  return { artifactsRoot, body: JSON.parse(result.stdout), repo, result, runId };
}

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function e2eConfig(artifactsRoot, builder, reviewer) {
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
    command: ${commandYaml(builder)}
    resume_command: ${commandYaml(builderFixCommand())}
  reviewer:
    provider: custom
    write_mode: false
    command: ${commandYaml(reviewer)}
`;
}

function headingCommand(position, confidence) {
  return [
    "node",
    "-e",
    `console.log(${JSON.stringify(headings(position, confidence).join("\n"))})`,
  ];
}

function headings(position, confidence) {
  return [
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
        [...headings("Built the requested file", "High"), "", "BUILD: COMPLETE"].join("\n"),
      )});`,
      "});",
    ].join(" "),
  ];
}

function committingBuilderCommand() {
  return [
    "node",
    "-e",
    [
      "let input = '';",
      "process.stdin.on('data', (chunk) => { input += chunk; });",
      "process.stdin.on('end', () => {",
      "  const cp = require('child_process');",
      "  require('fs').writeFileSync('built.txt', 'built by e2e\\n');",
      "  cp.execFileSync('git', ['add', 'built.txt']);",
      "  cp.execFileSync('git', ['commit', '-q', '-m', 'built']);",
      "  console.log('{\"type\":\"thread.started\",\"thread_id\":\"e2e-thread\"}');",
      `  console.log(${JSON.stringify(
        [...headings("Built and committed the requested file", "High"), "", "BUILD: COMPLETE"].join("\n"),
      )});`,
      "});",
    ].join(" "),
  ];
}

function builderFixCommand() {
  return [
    "node",
    "-e",
    [
      "let input = '';",
      "process.stdin.on('data', (chunk) => { input += chunk; });",
      "process.stdin.on('end', () => {",
      "  console.log('resumed thread ' + process.argv[1]);",
      `  console.log(${JSON.stringify(
        [...headings("Applied the reviewer fixes", "High"), "", "BUILD: COMPLETE"].join("\n"),
      )});`,
      "});",
    ].join(" "),
    "{thread_id}",
  ];
}

function reviewerCommand({ verdict = "APPROVED", trailer = "" } = {}) {
  const report = [...headings("Reviewed the build", "High"), "", `VERDICT: ${verdict}`].join("\n");

  return [
    "node",
    "-e",
    [
      "const prompt = process.argv[1] || '';",
      "console.log('SAW_BUILT_FILE:' + String(prompt.includes('built.txt')));",
      "console.log('SAW_BUILT_CONTENT:' + String(prompt.includes('built by e2e')));",
      `console.log(${JSON.stringify(report)});`,
      trailer ? `console.log(${JSON.stringify(trailer)});` : "",
    ]
      .filter(Boolean)
      .join(" "),
  ];
}

function commandYaml(parts) {
  return `[${parts.map((part) => JSON.stringify(part)).join(", ")}]`;
}

function escapeYaml(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
