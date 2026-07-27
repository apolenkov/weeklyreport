---
name: exemplary-audit
description: Measure, ratchet and land a codebase-quality gate without producing fake numbers. Use when asked to "tighten lint", "add a rule", "audit code quality", "find remaining debt", "raise the standard", or when proposing any new mechanical check.
metadata:
  author: customreport
  version: "1.0.0"
  argument-hint: <rule-or-area>
---

# Exemplary Audit

A candidate check is not a finding until it has been measured, and a measurement
is not trustworthy until the harness has been proven able to fail. This skill is
the procedure that gets from "we could enable X" to "X is enabled on a green
tree", plus the ratchet that keeps it there.

Research backing: `~/work/customreport-archive/2026-07-27-exemplary-research/RESEARCH.md`.

## The Six Laws

Every one of these was learned by getting it wrong. Violating any of them
produces a number that looks like evidence and is not.

1. **No count, no finding.** A candidate rule without a MEASURED firing count on
   this repo is a suggestion, not a finding. Never report "this rule would
   probably catch things".
2. **Zero is worthless until the harness is proven.** A measurement of 0 means
   nothing until you have planted a violation and watched it get caught. Prove
   the harness can see, then trust what it does not see.
3. **Default options lie, usually by orders of magnitude.** One rule measured
   8888 at defaults and 6 at shippable settings. Measure at the settings you
   would actually ship, and report both numbers when they differ.
4. **Resolver misconfiguration masquerades as defects.** 16 "architecture
   violations" and 4 "unresolvable imports" were both config, not code. Before
   reporting an architecture or import finding, confirm the tool resolved the
   module graph it claims to have resolved.
5. **Vacuous coverage is not health.** A rule that measures 0 because nothing in
   this repo can ever trigger it must be labelled `VACUOUS`, not `clean`.
6. **Enable in the same commit as the fixes.** A rule landing before its fixes
   is a red tree, which is forbidden here. One commit: config change + fixes, or
   config change + baseline entry.

## Procedure

### Step 1 — Capture the exit code, same shell

Exit codes are the primary signal and the easiest thing to lose.

```bash
pnpm exec eslint <paths> --max-warnings 0; ec=$?; echo "exit=$ec"
```

- `$?` must be read in the SAME shell command as the run. Never through a pipe:
  `cmd | tee log` gives you `tee`'s exit code, not `cmd`'s.
- If you must capture output, use `cmd > out.txt 2>&1; ec=$?` or
  `set -o pipefail`.
- Exit codes wrap at 256. A script that returns a violation count as its exit
  status reports 0 for exactly 256 violations. Never encode a count in an exit
  code, and never read one as a count.
- Some tools exit 0 with violations on stdout. Verify each tool's contract
  before believing its exit code. ESLint's own contract (verified in
  `node_modules/eslint/lib/cli.js`): `1` = errors or `--max-warnings` exceeded;
  `2` = fatal error, formatter failure, missing suppressions file, or unpruned
  suppressions; `0` = clean.

**Known trap in this repo.** `pnpm lint` is an `&&` chain — eslint, stylelint,
three tsc projects, the SSOT gate, the runtime-node check, depcruise, knip. A
failure in any link means every later link **never runs**. "The tree is green"
and "all nine checks passed" are different claims. When you need a specific
tool's state, invoke that tool directly; do not infer it from `pnpm lint`.

### Step 2 — Plant a violation before believing a zero

Mandatory whenever a measurement comes back 0.

```bash
# 1. write the smallest construct that must trip the rule, inside the linted glob
cat > apps/web/src/__harness-probe.ts <<'EOF'
<the violating construct>
EOF

# 2. confirm the rule is actually ON for this exact path (catches `files:` overrides)
pnpm exec eslint --print-config apps/web/src/__harness-probe.ts \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.stringify(JSON.parse(d).rules["<rule-id>"])))'

# 3. run the EXACT invocation you will report — no --rule, no explicit path
pnpm exec eslint . --max-warnings 0 > /tmp/probe.txt 2>&1; ec=$?
grep -c '<rule-id>' /tmp/probe.txt; echo "exit=$ec"

# 4. REQUIRED: step 2 shows the rule at "error", step 3 gives nonzero exit AND >0 matches
# 5. delete the probe
rm apps/web/src/__harness-probe.ts
```

**Never probe with `--rule`.** `--rule` overrides severity from config, and
naming the file explicitly sidesteps whether the reported run would have
_selected_ it at all. Both are exactly what the probe exists to test: a rule
switched off by one of the 26 `files:` override blocks, or a path dropped by
`ignores`, will still light up under `--rule` and hand you a false "caught".
`--rule` belongs in Step 3, which measures a hypothetical; Step 2 validates the
real harness and must use the real invocation.

If the probe is not caught, the zero is meaningless — say so and stop; do not
report the rule as clean.

Same discipline applies to dependency-cruiser: add a temporary module with the
forbidden import and confirm the rule names it. Architecture rules in
particular have schema traps (see Step 5) that make them silently match nothing.

### Step 3 — Measure at shippable settings, report both

```bash
# defaults
pnpm exec eslint <paths> --rule '{"<rule-id>":"error"}' -f json > /tmp/a.json; echo "exit=$?"
# shippable options
pnpm exec eslint <paths> --rule '{"<rule-id>":["error",{<options>}]}' -f json > /tmp/b.json; echo "exit=$?"
```

Count from the JSON, not by eye:

```bash
node -e 'const r=require("/tmp/b.json");const m=r.flatMap(x=>x.messages);
console.log("total",m.length,"files",new Set(r.filter(x=>x.messages.length).map(x=>x.filePath)).size)'
```

Report as: `<rule> — N occurrences across F files at <options>; M at defaults.`
A single number with no options attached is not a measurement.

### Step 4 — Classify before proposing

| Verdict   | Meaning                                                  | Action                                      |
| --------- | -------------------------------------------------------- | ------------------------------------------- |
| `REAL`    | fires, harness proven, fixes are genuine improvements    | propose, with count                         |
| `VACUOUS` | measures 0 because the construct cannot occur here       | record as vacuous; do NOT count as coverage |
| `CONFIG`  | firings trace to resolver/tsconfig/glob misconfiguration | fix the config; not a code finding          |
| `NOISE`   | fires, but the fixes make the code worse                 | reject, with an example                     |

`VACUOUS` and `CONFIG` are the two verdicts that get skipped under time
pressure, and they are the two that corrupt a report.

### Step 5 — Architecture rules: schema first

dependency-cruiser 18.1.0 has three structurally different `forbidden` shapes.
Using the wrong keys yields a rule that matches nothing and reads as passing.

- Layering / cycles: `{ from: {path, pathNot, orphan?}, to: {path, pathNot,
circular?, via?, viaOnly?, moreUnstable?, ancestor?, ...}, scope? }`
- Reachability: `{ from: {path, pathNot}, to: {path, pathNot, reachable} }`
  — `reachable` is **required** here. `reachable: false` finds modules
  unreachable from an entry point.
- Fan-in: `{ module: {path, pathNot, numberOfDependentsLessThan?,
numberOfDependentsMoreThan?}, from: {path, pathNot} }` — takes `module` and
  `from`, and has **no `to` key at all**. Only works alongside `path`/`pathNot`;
  other conditions are ignored.
- Must-depend-on: `required: [{ module: {path, pathNot}, to: {path, reachable?} }]`
  — `module` + `to`, and here `reachable` is optional and means "transitive too".
- `scope: "folder"` honours **only** `to.moreUnstable`, `to.circular` and
  `path`. Any other attribute on a folder-scoped rule silently does nothing.

Full schema with quoted type docs: §4 of `RESEARCH.md`.

Before reporting any architecture count, confirm resolution:

```bash
pnpm exec depcruise <paths> --config .dependency-cruiser.cjs --output-type err-long; ec=$?; echo "exit=$ec"
```

`not-to-unresolvable` firings are a resolver claim, not a code claim, until you
have checked `enhancedResolveOptions` / `tsConfig` in `.dependency-cruiser.cjs`.

### Step 6 — Land it: fixes or baseline, same commit

Two legal landings. Both keep the tree green.

**A. Fix and enable.** Rule + all fixes in one commit. Correct when the count is
small. Verify with a targeted run before committing — never push a red tree.

**B. Enable and baseline.** Correct when the count is large. ESLint 10.8.0 ships
a first-party ratchet:

```bash
# rule must be declared "error" in eslint.config.ts first — see the warning below
pnpm exec eslint . --suppress-rule <rule-id> --fix; echo "exit=$?"

# REQUIRED before committing: the real gate must now pass on its own
pnpm exec eslint . --max-warnings 0; ec=$?; echo "gate exit=$ec"   # must be 0
git add eslint-suppressions.json eslint.config.ts
```

Do not skip the re-run. Promoting a rule from `warn` to `error` can flip
existing inline `eslint-disable` lines from unused to used, which changes the
counts the baseline just recorded — and `reportUnusedDisableDirectives` is at
`error` here, so the shift is itself a failure. A commit that satisfies
`--suppress-rule` but fails `eslint . --max-warnings 0` is a red tree.

Thereafter the rule blocks all NEW violations while the recorded ones stay
silent. The suppressions file is `Record<file, Record<rule, {count}>>` — counts,
not line numbers, so it does not churn when code moves. As violations are fixed:

```bash
pnpm exec eslint . --prune-suppressions; echo "exit=$?"
```

Pruning is not optional. Fixing violations without pruning makes ESLint exit
`2` with "There are suppressions left that do not occur anymore" — that failure
IS the ratchet, and the baseline can therefore only move downward.

> **Only `error` is suppressible.** `countViolationsByRule` counts
> `severity === 2` exclusively
> (`node_modules/eslint/lib/services/suppressions-service.js:253`). A rule left
> at `warn` cannot be baselined, and under this repo's `--max-warnings 0` it
> will simply redden the tree. Declare `error`, then suppress.

dependency-cruiser has the equivalent:

```bash
pnpm exec depcruise-baseline <paths>         # writes .dependency-cruiser-known-violations.json
pnpm exec depcruise <paths> --ignore-known   # enforce against that baseline
```

**Prefer a suppression entry over an `eslint.config.ts` override block.** An
override is permanent, unmeasured and invisible; a suppression entry is counted,
committed, and monotonically decreasing. Same argument for inline
`eslint-disable`: 606 of them are 606 exemptions nobody can enumerate.

## Reporting Format

One line per candidate. Anything missing a field is not ready to report.

```
<tool>/<rule-id>  <REAL|VACUOUS|CONFIG|NOISE>  N occ / F files  @<options>  probe:<caught|not-run>  exit:<code>
```

Then, for each `REAL`: proposed landing (A or B), and the commit that carries it.

## What Not To Do

- Do not report a rule you have not run.
- Do not report a 0 without a planted-probe result.
- Do not report a count without the options it was measured at.
- Do not count `VACUOUS` rules toward "N rules clean".
- Do not enable a rule in one commit and fix it in the next.
- Do not read a tool's health out of `pnpm lint`'s single exit code.
- Do not add a `files:` override to make a number go away.
