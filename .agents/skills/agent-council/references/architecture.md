# Agent Council Architecture

## Purpose

`agent-council` automates the narrow part that is hard to do by hand: launch independent CLI advisors in parallel, prevent interactive hangs, capture their stdout/stderr, and assemble a stable synthesis prompt for the parent Advisor.

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
2. Skill invokes `scripts/agent-council.mjs`.
3. Orchestrator builds a child prompt that:
   - marks the user request as data
   - requires read-only analysis
   - asks for assumptions, plan, risks, implementation notes, and confidence
4. Orchestrator starts Codex and Claude Code concurrently with an OpenCode Go advisor chain.
5. Each child process gets:
   - a per-process timeout
   - an optional whole-council deadline
   - stdout/stderr buffering with a character cap
   - process-group termination on timeout where the platform supports it
6. OpenCode Go advisors run sequentially inside the chain to avoid local OpenCode session database locks.
7. Orchestrator extracts standard child headings into machine-readable `extracted` fields and prints a `Council Summary`.
8. Orchestrator prints the Advisor Prompt.
9. Parent Advisor compares the outputs and writes the final answer or code.

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

Environment variables:

| Variable | Purpose |
| --- | --- |
| `AGENT_COUNCIL_CODEX_CMD` | Replace the Codex adapter command. Accepts a shell-like string or JSON array. |
| `AGENT_COUNCIL_CODEX_TIMEOUT_MS` | Timeout for the Codex advisor. Default: `90000`. |
| `AGENT_COUNCIL_CLAUDE_CMD` | Replace the Claude Code adapter command. Accepts a shell-like string or JSON array. Use `{model}` and `{effort}` placeholders if the adapter supports them. |
| `AGENT_COUNCIL_CLAUDE_MODEL` | Claude Code model alias or full model name. Default: `opus`. |
| `AGENT_COUNCIL_CLAUDE_EFFORT` | Claude Code effort level for the default CLI adapter. Default: `high`. |
| `AGENT_COUNCIL_CLAUDE_TIMEOUT_MS` | Timeout for the Claude Code advisor. Default: `90000`. |
| `AGENT_COUNCIL_DISABLE_CLAUDE` | Set to `1` to remove the Claude Code advisor. |
| `AGENT_COUNCIL_OPENCODE_CMD` | Replace the OpenCode adapter command. Accepts a shell-like string or JSON array. Use `{model}` to run it once per configured model. |
| `AGENT_COUNCIL_OPENCODE_MODELS` | Comma-separated or JSON array of OpenCode Go model ids. Default: `opencode-go/deepseek-v4-pro,opencode-go/glm-5.2`. |
| `AGENT_COUNCIL_OPENCODE_MODEL` | Backward-compatible single model override when `AGENT_COUNCIL_OPENCODE_MODELS` is unset. |
| `AGENT_COUNCIL_OPENCODE_VARIANT` | OpenCode provider-specific reasoning effort / model variant. Default: `max`. |
| `AGENT_COUNCIL_OPENCODE_TIMEOUT_MS` | Timeout for each OpenCode advisor. Default: `180000`. |
| `AGENT_COUNCIL_TIMEOUT_MS` | Global timeout override in milliseconds, applied to all advisors unless a per-seat timeout is set. |
| `AGENT_COUNCIL_DEADLINE_MS` | Whole-council wall-clock deadline in milliseconds. Disabled by default. |
| `AGENT_COUNCIL_MAX_OUTPUT_CHARS` | Per-stream capture cap. |
| `AGENT_COUNCIL_STRICT_OPENCODE_PERMISSIONS` | Set to `0` to avoid injecting strict OpenCode permissions. |
| `AGENT_COUNCIL_TRUST_OPENCODE_PERMISSION_ENV` | Set to `1` to keep an inherited `OPENCODE_PERMISSION`; by default strict permissions override it. |

CLI flags:

```bash
node scripts/agent-council.mjs \
  --cwd /path/to/repo \
  --codex-timeout-ms 120000 \
  --claude-timeout-ms 120000 \
  --opencode-timeout-ms 240000 \
  --deadline-ms 600000 \
  --max-output-chars 200000 \
  --claude-model opus \
  --claude-effort high \
  --opencode-models opencode-go/deepseek-v4-pro,opencode-go/glm-5.2 \
  --opencode-variant max \
  -- "Design the migration plan"
```

Use `--json` when another script needs machine-readable output.

JSON output includes `health` counters and one `extracted` object per advisor. `extracted` is derived from the required child headings: `Position`, `Assumptions`, `Evidence`, `Risks`, `Implementation Notes`, and `Confidence`. The raw stdout/stderr are still preserved and fenced in the parent prompt.

Fast plumbing smoke test with real OpenCode and no tools:

```bash
env AGENT_COUNCIL_TRUST_OPENCODE_PERMISSION_ENV=1 \
  OPENCODE_PERMISSION='{"skill":{"*":"deny"},"read":"deny","grep":"deny","glob":"deny","edit":"deny","bash":"deny","webfetch":"deny","websearch":"deny","task":"deny","question":"deny"}' \
  node scripts/agent-council.mjs \
  --codex-cmd 'node -e "console.log(\"CODEX_STUB_OK\")"' \
  --claude-cmd 'node -e "console.log(\"CLAUDE_STUB_OK\")"' \
  --opencode-models opencode-go/deepseek-v4-pro,opencode-go/glm-5.2 \
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

- a declarative seat registry (`name`, `provider`, `command`, `model`, `variant`, `timeoutMs`, `concurrencyGroup`)
- a scheduler with a global deadline and per-group concurrency
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
