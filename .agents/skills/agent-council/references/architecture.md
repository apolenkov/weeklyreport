# Agent Council Architecture

## Purpose

`agent-council` automates the narrow part that is hard to do by hand: launch independent CLI advisors in parallel, prevent interactive hangs, capture their stdout/stderr, and assemble a stable synthesis prompt for the parent Advisor.

The parent Advisor still owns judgment and code changes.

## Research Summary

No exact drop-in package was found for "Codex + OpenCode + parent agent cross-CLI council". Existing options split into two groups:

- Native CLI automation:
  - Codex supports non-interactive automation through `codex exec`.
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
4. Orchestrator starts Codex concurrently with an OpenCode Go advisor chain.
5. Each child process gets:
   - a per-process timeout
   - stdout/stderr buffering with a character cap
   - process-group termination on timeout where the platform supports it
6. OpenCode Go advisors run sequentially inside the chain to avoid local OpenCode session database locks.
7. Orchestrator prints the Advisor Prompt.
8. Parent Advisor compares the outputs and writes the final answer or code.

## Default Adapters

Codex:

```bash
codex exec --ephemeral --sandbox read-only --color never "<prompt>"
```

OpenCode Go:

```bash
opencode run --pure --model opencode-go/deepseek-v4-flash "<prompt>"
opencode run --pure --model opencode-go/glm-5.2 "<prompt>"
```

`codex rescue` is not the default because the current Codex CLI exposes `codex exec` as the supported non-interactive command and the local installation tested for this package does not have a `rescue` subcommand.

## Context Isolation

The skill isolates advisors by policy and process boundary:

- Codex runs in a read-only sandbox with no approval prompts.
- OpenCode runs without plugins by default through `--pure`.
- The orchestrator injects strict `OPENCODE_PERMISSION` unless disabled, denying skills, edits, subagents, user questions, web tools, and shell commands while allowing read/search tools.
- The orchestrator sets `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1` for child OpenCode runs so advisor prompts do not recursively invoke this or other Claude-compatible skills.
- Child outputs are fenced and treated as untrusted data.

This is not a security sandbox for hostile code. Run the council only in a trusted local workspace.

OpenCode stores session state locally. Multiple live `opencode run` processes against the same workspace can fail with `database is locked`, so this harness runs configured OpenCode models sequentially while Codex runs in parallel.

## Configuration

Environment variables:

| Variable | Purpose |
| --- | --- |
| `AGENT_COUNCIL_CODEX_CMD` | Replace the Codex adapter command. Accepts a shell-like string or JSON array. |
| `AGENT_COUNCIL_OPENCODE_CMD` | Replace the OpenCode adapter command. Accepts a shell-like string or JSON array. Use `{model}` to run it once per configured model. |
| `AGENT_COUNCIL_OPENCODE_MODELS` | Comma-separated or JSON array of OpenCode Go model ids. Default: `opencode-go/deepseek-v4-flash,opencode-go/glm-5.2`. |
| `AGENT_COUNCIL_OPENCODE_MODEL` | Backward-compatible single model override when `AGENT_COUNCIL_OPENCODE_MODELS` is unset. |
| `AGENT_COUNCIL_TIMEOUT_MS` | Per-advisor timeout in milliseconds. |
| `AGENT_COUNCIL_MAX_OUTPUT_CHARS` | Per-stream capture cap. |
| `AGENT_COUNCIL_STRICT_OPENCODE_PERMISSIONS` | Set to `0` to avoid injecting strict OpenCode permissions. |

CLI flags:

```bash
node scripts/agent-council.mjs \
  --cwd /path/to/repo \
  --timeout-ms 240000 \
  --max-output-chars 200000 \
  --opencode-models opencode-go/deepseek-v4-flash,opencode-go/glm-5.2 \
  -- "Design the migration plan"
```

Use `--json` when another script needs machine-readable output.

Fast plumbing smoke test with real OpenCode and no tools:

```bash
env OPENCODE_PERMISSION='{"skill":{"*":"deny"},"read":"deny","grep":"deny","glob":"deny","edit":"deny","bash":"deny","webfetch":"deny","websearch":"deny","task":"deny","question":"deny"}' \
  node scripts/agent-council.mjs \
  --codex-cmd 'node -e "console.log(\"CODEX_STUB_OK\")"' \
  --opencode-models opencode-go/deepseek-v4-flash,opencode-go/glm-5.2 \
  -- "No tools. Smoke-test the harness only."
```

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
