# Agent Council Glossary

**Agent Council**:
A bounded workflow where the parent Advisor asks multiple configured CLI agents for advice, challenge rounds, or build/review work, then performs the final synthesis and implementation decision.

**Parent Advisor**:
The current agent session that owns the final answer, code edits, and responsibility for rejecting unsafe or unsupported child-agent claims.

**Council Advisor**:
A child CLI agent invoked as a subprocess from a configured seat.

**Seat**:
A named config entry with provider, command, timeout, prompt mode, concurrency group, and write permission.

**Profile**:
A named config entry selecting mode, advisor seats, round counts, artifacts directory, and optional build roles.

**Soft Mode**:
One-pass configured council advice.

**Hard Mode**:
Soft mode plus bounded self-grill and adversarial challenge rounds.

**Full Mode**:
Hard mode plus a configured writable builder and a different configured read-only reviewer.

**Adapter Command**:
The exact command used to invoke one council advisor. Adapter commands are configurable because CLI products change their flags and local aliases vary.

**Read-Only Council Run**:
A council run where children may inspect and reason but must not modify repository state. Soft and hard modes are read-only by contract.

**Writable Builder**:
The explicit `builder` seat in full mode. It is the only child seat that may write, and only after `--allow-writes`, clean-tree, and proof-command gates pass.

**Advisor Prompt**:
The prompt produced by the orchestrator after collecting child outputs. It is intended for the parent Advisor to read and synthesize, not for automatic execution by another model.

**Timeout Result**:
A normal council outcome where one advisor exceeded its time budget. The timed-out advisor is marked failed, and the remaining advisor output still participates in synthesis.

**Restricted YAML**:
The config subset parsed by the zero-dependency runner: maps, arrays, strings, numbers, booleans, and null. Anchors, merges, tags, and other YAML features are rejected.
