---
name: mass-review
description: Whole-repo per-file review with verdict per file — Opus batches, adversarial verification of every major finding (Opus, with raw-codex fallback when Claude limits bite), council synthesis, and an interactive verdict artifact. Use when the user wants every file reviewed/graded, a repo-wide quality audit with per-file verdicts, or to re-run the 2026-07-17 mass review on a newer tree.
---

# Mass per-file review

Reviews EVERY production source file, gives each a verdict (`exemplary | good | needs-attention | defect`), adversarially verifies every major finding, and ships an interactive artifact plus an action plan. Validated end-to-end on 2026-07-17 (1165 files, ~16M tokens; results in `~/work/customreport-archive/2026-07-17-mass-review/`) — check that archive and the `mass-review-2026-07-17-results-and-recipe` memory before re-running: don't rescan a tree that hasn't materially changed.

## Procedure

1. **Clean tree first.** The run snapshots the working tree; commit or stash everything. Record `git rev-parse HEAD` — cached Workflow resume is only valid while the tree is unchanged.
2. **Generate batches** (~6 files each, grouped by directory) and splice into the template:

   ```bash
   git ls-files 'apps/*/src/**/*.ts' 'apps/*/src/**/*.tsx' 'packages/*/src/**/*.ts' 'packages/*/src/**/*.tsx' 'prisma/*.ts' 'scripts/*.mjs' 'e2e/**/*.ts' | grep -vE '__snapshots__|\.d\.ts$' | sort > files.txt
   ```

   Then group per directory into `{label, files[]}` chunks of ≤6 and replace `__BATCHES__` in `scripts/mass-review.template.js.txt` (JSON literal). Write the spliced script to the session scratchpad and `node --check` it.

3. **Launch** via the Workflow tool with `scriptPath`. Phases: Review (one Opus agent per batch, per-file verdicts via StructuredOutput) → Verify (one Opus refuter per major/blocker finding). ~270 batches ≈ 35–50 min.
4. **On session-limit or classifier failures**: resume with `resumeFromRunId` (cached prefix replays instantly). If Opus verify stays blocked, route the unverified majors through raw Codex: batches of ~7 findings, `codex exec -s read-only` **from the repo root** (stdin prompt, manual watchdog `(sleep 480; kill $PID)`); Codex's answer lands on **stderr** — parse the trailing JSON array.
5. **Council** (after all verification): frozen brief with the confirmed findings → independent seats: raw `codex exec` + `grok -p` in parallel, plus the orchestrator's own opinion as a distinct third voice. Then a **completeness audit**: each external seat re-reviews 6–10 `good/exemplary` files in assigned risk areas hunting for misses; arbiter-verify every claimed miss before accepting.
6. **Artifact**: run `scripts/build-artifact.py` (expects `review-data.json`, optional `codex-verdicts.json`, `council.json` beside it) and publish via the Artifact tool. The generator downgrades a `defect` verdict ONLY when every major finding is explicitly refuted — never on unverified ones.
7. **Archive** the raw JSONs + council outputs to `~/work/customreport-archive/<date>-mass-review/` and update its INDEX.md; write/refresh the results memory so future sessions don't rescan.

## Hard rules

- Models explicit on every `agent()` call: review/verify = `opus`; never Fable in the fan-out.
- Reviewers judge what linters can't see (bugs, depth, duplication, dead surface, vacuous tests, comment hygiene) — never line counts/formatting; honest verdicts, zero-finding `good` is a valid answer.
- Verifiers default to `refuted=true`; a finding survives only with an articulated concrete defect.
- 100%-coverage check is mechanical: every planned file must appear in the result set; log missed batches loudly.
- Findings → OpenSpec: group by seam into changes (not one per finding), validate `--strict`, and mechanically re-check that every confirmed finding is mentioned in some change artifact.
