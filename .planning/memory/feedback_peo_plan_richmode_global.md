---
name: peo-plan rich-mode for all repos
description: Every non-trivial plan (≥3 steps or multi-file) must use peo-plan rich-mode with 15-section template, 3 Mermaid flowchart TB diagrams, callouts, and status marks — applies across ALL repos
type: feedback
---

Every plan of ≥3 steps or touching multiple files must be written in peo-plan rich-mode. Plain/compact plan format is not acceptable for non-trivial work.

**Why:** User explicitly confirmed this rule should apply to all repos, not just customreport. Rich-mode plans with Mermaid TB diagrams (Было/Проблема/Станет) and the 15-section template make plans readable without reading the whole doc.

**How to apply:**

1. When any plan is requested: load skill `peo-plan`, open `templates/phase-plan.md`.
2. TL;DR = 3 Mermaid `flowchart TB` sections: Было / Проблема / Станет.
3. All 15 numbered sections from the template.
4. Callouts: `[!IMPORTANT]` main deliverable, `[!NOTE]` context, `[!WARNING]` real risk, `[!TIP]` default path.
5. Status marks: `✓ done · ✗ blocked · → next · ▲ risk · ? open`.
6. Subagent roadmap: model tier (Haiku/Sonnet/Opus), scope, writes, output.
7. Self-check §11 before ExitPlanMode.

Applies to ALL repos (customreport, core-principles, any other repo).
