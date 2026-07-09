# Agent Council Architecture

## Purpose

`agent-council` automates the narrow part that is hard to do by hand: launch independent CLI advisors from a declarative config, prevent interactive hangs, capture stdout/stderr, run bounded challenge phases, and assemble a stable synthesis prompt for the parent Advisor.

The parent Advisor still owns judgment and code changes.

## Research Summary

No exact drop-in package was found for "Codex + Claude + OpenCode + parent agent cross-CLI council". Existing options split into two groups:

- Native CLI automation:
  - Codex supports non-interactive automation through `codex exec`.
  - Claude Code supports non-interactive automation through `claude --print`; the Claude Agent SDK is the library form and can be wrapped behind the same adapter command.
  - OpenCode supports non-interactive automation through `opencode run`.
  - Claude Code, Codex, and OpenCode all support `SKILL.md`-style reusable workflows.
- General multi-agent frameworks:
  - CrewAI, AutoGen, LangGraph, and OpenHands can orchestrate multi-agent systems, but they expect you to build inside their runtimes instead of supervising existing terminal coding agents.

For this use case, a thin CLI harness is lower-risk than adopting a full framework.

## Process Model

1. Parent Advisor receives the user task.
2. Skill invokes `scripts/agent-council.mjs` with a YAML config and profile.
3. Orchestrator validates the profile:
   - `soft` for one-pass council advice
   - `hard` for self-grill plus adversarial planning rounds
   - `full` for hard mode plus configured build/review
4. Orchestrator builds child prompts that:
   - marks the user request as data
   - requires read-only analysis
   - asks for assumptions, evidence, risks, implementation notes, and confidence
5. Orchestrator starts configured non-OpenCode seats concurrently and runs seats sharing a `concurrency_group` serially.
6. Each child process gets:
   - a per-process timeout
   - an optional whole-council deadline
   - stdout/stderr buffering with a character cap
   - process-group termination on timeout where the platform supports it
7. OpenCode Go advisors are normally assigned `concurrency_group: opencode` to avoid local session database locks.
8. Orchestrator extracts standard child headings into machine-readable `extracted` fields and writes run artifacts.
9. Orchestrator prints the parent Advisor prompt.
10. Parent Advisor compares the outputs and writes the final answer or code.

## Modes

`soft` runs the configured advisors once and emits a parent prompt.

`hard` runs the initial council, then `self_grill_rounds`, then `adversarial_rounds`. These rounds are bounded by config. They do not ask the child model to stand in for the human; they challenge the child model's own written position and the other advisor positions.

`full` runs hard mode, then hands the frozen task/council output to the configured builder. The builder is the only child seat allowed to write and only after the parent passed `--allow-writes`. The configured reviewer must be a different non-writable seat. The runner also requires a clean git tree and proof command before the builder starts.

## Default Adapters

Codex:

```bash
codex exec --ephemeral --sandbox read-only --color never -c model_reasoning_effort=xhigh "<prompt>"
```

Claude Code:

```bash
claude --print --output-format text --no-session-persistence --permission-mode dontAsk --disable-slash-commands --allowed-tools Read,Glob,Grep --model opus --effort high "<prompt>"
```

Optional Claude Agent SDK wrapper, when `@anthropic-ai/claude-agent-sdk` is installed in the runtime project:

```bash
AGENT_COUNCIL_CLAUDE_CMD='node .agents/skills/agent-council/scripts/claude-agent-sdk-adapter.mjs --model {model}'
```

The default Claude Code CLI adapter is preferred when reasoning effort matters, because `claude --help` exposes `--effort`; the optional SDK wrapper is model-focused unless the installed SDK version documents an effort option.

OpenCode Go:

```bash
opencode run --pure --model opencode-go/deepseek-v4-pro --variant max "<prompt>"
opencode run --pure --model opencode-go/glm-5.2 --variant max "<prompt>"
```

`codex rescue` is not the default because the current Codex CLI exposes `codex exec` as the supported non-interactive command and the local installation tested for this package does not have a `rescue` subcommand.

## Context Isolation

The skill isolates advisors by policy and process boundary:

- Codex runs in a read-only sandbox with no approval prompts.
- Claude Code runs in non-interactive print mode, without slash-command skills, without session persistence, and with only read/search tools allowed.
- OpenCode runs without plugins by default through `--pure`.
- The orchestrator injects strict `OPENCODE_PERMISSION` unless disabled, denying skills, edits, subagents, user questions, web tools, and shell commands while allowing read/search tools.
- The orchestrator sets `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1` for child OpenCode runs so advisor prompts do not recursively invoke this or other Claude-compatible skills.
- The orchestrator sets `AGENT_COUNCIL_DEPTH=1` and `AGENT_COUNCIL_PARENT_RUN_ID` for every child process and refuses to start if it sees a non-zero depth, preventing nested councils.
- Child outputs are fenced and treated as untrusted data.

This is not a security sandbox for hostile code. Run the council only in a trusted local workspace.

OpenCode stores session state locally. Multiple live `opencode run` processes against the same workspace can fail with `database is locked`, so this harness runs configured OpenCode models sequentially while Codex and Claude Code run in parallel.

## Configuration

Real runs require restricted YAML config. The default path is `.agents/agent-council.yaml`, and a complete sample lives in `references/sample-config.yaml`.

The parser supports maps, arrays, strings, numbers, booleans, and null. It intentionally rejects YAML anchors, merges, tags, and other complex YAML features.

High-level schema:

```yaml
version: 1
default_profile: hard
profiles:
  hard:
    mode: hard
    advisors: [codex-readonly, claude-opus]
    self_grill_rounds: 2
    adversarial_rounds: 5
seats:
  codex-readonly:
    provider: codex
    command: ["codex", "exec", "--ephemeral", "--sandbox", "read-only"]
```

Config fields replace the old hardcoded default seats. Environment variables still control cross-cutting runner behavior such as deadline, max output, and OpenCode permission strictness.

Environment variables:

| Variable | Purpose |
| --- | --- |
| `AGENT_COUNCIL_CONFIG` | Config path override. |
| `AGENT_COUNCIL_PROFILE` | Profile override. |
| `AGENT_COUNCIL_TIMEOUT_MS` | Default timeout for seats without `timeout_ms`. |
| `AGENT_COUNCIL_DEADLINE_MS` | Whole-council wall-clock deadline in milliseconds. Disabled by default. |
| `AGENT_COUNCIL_MAX_OUTPUT_CHARS` | Per-stream capture cap. |
| `AGENT_COUNCIL_STRICT_OPENCODE_PERMISSIONS` | Set to `0` to avoid injecting strict OpenCode permissions. |
| `AGENT_COUNCIL_TRUST_OPENCODE_PERMISSION_ENV` | Set to `1` to keep an inherited `OPENCODE_PERMISSION`; by default strict permissions override it. |

CLI flags:

```bash
node scripts/agent-council.mjs \
  --config .agents/agent-council.yaml \
  --profile hard \
  --cwd /path/to/repo \
  --deadline-ms 600000 \
  --max-output-chars 200000 \
  -- "Design the migration plan"
```

Use `--json` when another script needs machine-readable output.

JSON output includes run-level `health`, phase records, and one `extracted` object per advisor result. `extracted` is derived from the required child headings: `Position`, `Assumptions`, `Evidence`, `Risks`, `Implementation Notes`, and `Confidence`. Raw stdout/stderr are still preserved and fenced in the parent prompt.

Fast plumbing smoke test with real OpenCode and no tools:

```bash
env AGENT_COUNCIL_TRUST_OPENCODE_PERMISSION_ENV=1 \
  OPENCODE_PERMISSION='{"skill":{"*":"deny"},"read":"deny","grep":"deny","glob":"deny","edit":"deny","bash":"deny","webfetch":"deny","websearch":"deny","task":"deny","question":"deny"}' \
node scripts/agent-council.mjs \
  --config /tmp/agent-council.yaml \
  --profile soft \
  -- "No tools. Smoke-test the harness only."
```

SDK adapter availability check:

```bash
node scripts/claude-agent-sdk-adapter.mjs --help
```

Local self-tests without real LLM calls:

```bash
node --test scripts/agent-council.test.mjs
```

## Scaling Direction

For many-model councils, keep the current adapter behavior but move toward:

- richer final reviewer contracts and machine-readable verdict schemas
- OpenCode isolation with per-seat `--dir` or explicit `opencode-local-db` serialization
- a mandatory parent `Council Summary` / `extracted` consolidation pass before reading raw transcripts
- optional spend/token controls where each CLI exposes them

## Packaging

Project-local install:

```bash
mkdir -p .agents/skills
cp -R agent-council .agents/skills/agent-council
```

User-global install for Codex/OpenCode-compatible skill discovery:

```bash
mkdir -p ~/.agents/skills
cp -R .agents/skills/agent-council ~/.agents/skills/agent-council
```

OpenCode also discovers compatible skills from `.opencode/skills`, `.claude/skills`, `.agents/skills`, and global equivalents.
