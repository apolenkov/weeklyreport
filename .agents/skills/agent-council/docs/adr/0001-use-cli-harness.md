# ADR 0001: Use a Thin CLI Harness for Agent Council

## Status

Accepted

## Context

The desired workflow needs to run existing terminal coding agents, not replace them with a new multi-agent runtime. The required child advisors are Codex and OpenCode/DeepSeek. Both already expose non-interactive CLI entrypoints.

General multi-agent frameworks such as CrewAI, AutoGen, LangGraph, and OpenHands are useful when the agents are modeled inside the framework. They add dependency weight and a second orchestration model when the immediate requirement is subprocess supervision and transcript capture.

## Decision

Implement `agent-council` as a local `SKILL.md` package with one Node.js subprocess orchestrator and no external runtime dependencies.

The harness invokes configurable adapter commands in parallel, captures stdout/stderr, applies timeouts, and prints a parent-Advisor prompt. The parent Advisor remains responsible for synthesis and code edits.

## Consequences

Positive:

- Minimal install surface.
- Works with native Codex and OpenCode authentication/configuration.
- Easy to adapt when CLI flags change.
- Keeps model contexts separate by process boundary.

Negative:

- Does not provide framework-level tracing, memory, retries, or evaluation.
- OpenCode/Codex CLI changes can require adapter updates.
- It is a workflow harness, not a security boundary against malicious repositories.
