---
name: Haiku for mechanical agent work
description: Default to Haiku (`model: "haiku"`) when dispatching subagents for regression tests, navigation/screenshot specs, mutation audits, inventory rerun, and other mechanical/data-pull tasks. Escalate to Sonnet/Opus only when complex code synthesis or judgement required.
type: feedback
originSessionId: bba7038f-3313-48a3-895f-09a1520a7c56
---

User explicitly asked 2026-05-06: "постарайся запускать дешёвыми моделями. По максимуму Haiku использовал, тот же самый для регресс-тестирования."

**Default model selection:**

```
task type                     | model
──────────────────────────────|────────
regression test execution     | haiku
DOM walker / inventory rerun  | haiku
mutation audit rerun          | haiku
log scraping / status check   | haiku
data aggregation / coverage   | haiku
arbitrary file reads          | haiku
codemod / mechanical refactor | haiku
─────────────────────────────────────
multi-file feature impl       | sonnet
schema/migration design       | sonnet
debugging non-obvious bug     | sonnet
prompt engineering            | sonnet
─────────────────────────────────────
critical production fix       | opus
ambiguous architecture call   | opus
multi-system coordination     | opus
```

**How to apply:**

- When dispatching `Agent` subagent_type: `general-purpose`, set `model: "haiku"` for mechanical work.
- For multi-step Playwright specs: try Haiku first; if it stalls or produces broken syntax, escalate to Sonnet.
- For critical commit decisions or architectural choices: keep Opus.

**Why:** user hit usage limit during regression sweep with default models. Haiku 4.5 is plenty for navigation + screenshot + assertion specs. Reserve Opus/Sonnet for tasks where capability matters more than cost.
