# Agent Council Glossary

**Agent Council**:
A bounded workflow where the parent Advisor asks multiple independent CLI agents for read-only analysis, then performs the final synthesis and implementation decision.

**Parent Advisor**:
The current agent session that owns the final answer, code edits, and responsibility for rejecting unsafe or unsupported child-agent claims.

**Council Advisor**:
A child CLI agent invoked as a subprocess. In this skill the default advisors are Codex and OpenCode using an OpenCode Go DeepSeek model.

**Adapter Command**:
The exact command used to invoke one council advisor. Adapter commands are configurable because CLI products change their flags and local aliases vary.

**Read-Only Council Run**:
A council run where children may inspect and reason but must not modify repository state. The parent Advisor remains the only writer.

**Advisor Prompt**:
The prompt produced by the orchestrator after collecting child outputs. It is intended for the parent Advisor to read and synthesize, not for automatic execution by another model.

**Timeout Result**:
A normal council outcome where one advisor exceeded its time budget. The timed-out advisor is marked failed, and the remaining advisor output still participates in synthesis.
