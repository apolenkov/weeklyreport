# ADR 0002: Use Configured Multi-Phase Council Profiles

## Status

Accepted

## Context

The first council harness ran a fixed one-pass council: Codex, Claude Code, and two OpenCode Go advisors. That was useful for read-only synthesis, but it could not express different cost/rigor levels, per-task model mixes, or role-flipped build/review workflows without editing the script.

The desired workflow needs three levels:

- quick one-pass advice
- self-grilled and adversarial plan review
- optional build delegation where one model writes and another reviews

The same skill should work when invoked from Codex or Claude Code, so the parent orchestrator must be the current host agent rather than a hardcoded child model.

## Decision

Make `agent-council` config-required. A restricted YAML file defines profiles and seats. Profiles choose the mode and seat roles; seats define provider commands, timeouts, prompt mode, concurrency group, and whether a seat may write.

The script remains a zero-dependency Node CLI. It implements only schema-oriented YAML features so the skill is portable and does not require installing `yaml` or `js-yaml`.

Full mode requires:

- explicit `--allow-writes`
- clean git tree before the writable builder starts
- explicit proof command
- explicit builder and reviewer seats
- builder and reviewer must be different
- builder must set `write_mode: true`
- reviewer must not set `write_mode: true`
- resume commands must use `{thread_id}`, never `--last`

## Consequences

Positive:

- Model count and providers are not hardcoded.
- Soft, hard, and full workflows share one runner.
- Host-agent choice is flexible: Codex and Claude Code can both be the parent.
- Build mode has explicit safety gates.
- The package stays dependency-free.

Negative:

- Existing one-command default runs now require a config file.
- The restricted YAML parser intentionally rejects valid but complex YAML.
- The script is more complex than the original one-pass harness.
