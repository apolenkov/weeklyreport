---
name: Visuals match structure, not surface
description: If content describes structure (sequence/hierarchy/dependency/comparison/priority/state), pair prose with matching visualisation — independent of where it lands (chat, .md file, commit body, prompt, comment, README, ADR, postmortem).
type: feedback
originSessionId: bba7038f-3313-48a3-895f-09a1520a7c56
---

**Rule:** structure in content → visual in output. The medium does not matter. Chat reply, repo `.md`, commit body, agent prompt, code comment, README, ADR, RUNBOOK, postmortem, slack DM — all use the same trigger: "is there structure?" → pair the prose with the matching visual.

**Why:** earlier the rule was applied only to chat replies + status summaries. Repo planning artefacts (ROADMAP/PRD/SPEC) shipped pure-prose with hidden structure that a reader had to mentally reconstruct. User flagged the mistake 2026-05-06 ("такие вещи нужно тоже визуально правильно прописывать"). Surface-coupled rules drift.

**How to apply — structure → diagram mapping:**

```
structure type        →  visual pattern
─────────────────────    ─────────────────────────────────
sequence / pipeline   →  arrows: [A] → [B] → [C]
branching flow        →  decision tree with yes/no paths
hierarchy / tree      →  ASCII tree (root / └── / ├──)
parallel vs serial    →  boxes side-by-side + dependency lines
comparison ≤3 items   →  side-by-side columns (≤10 words/cell)
comparison >3 items   →  table
status of >5 items    →  frame block ┌─ ─┐
priority / severity   →  ▲ high / ▼ low scale
state machine         →  states + labelled transitions
relations / mapping   →  pairs grid before → after
```

**Trigger before publishing ANY content:**

1. Does the content describe structure? (sequence, hierarchy, dependency, parallel/serial, comparison, priority, state, mapping)
2. If yes → include the matching visual pattern from the table above.
3. Pair every diagram with 1-2 prose lines so it reads cold.
4. If no structure → no diagram. Visuals that add no clarity are absent.

**Defect to fix:** any artefact that contains structure but ships without visualisation. Catch it on the next edit.

**Boundaries:**

- Single fact / direct answer (1-2 sentences) → no diagram
- Pure code block → no diagram
- Plain list or table that already captures structure → no extra diagram
- User asked for prose/narrative explicitly → respect that
