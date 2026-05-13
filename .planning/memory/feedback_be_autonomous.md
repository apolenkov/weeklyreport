---
name: User wants autonomous execution by default in this project
description: When user says "go" / "Поехали" / "Будь автономен", they want full autonomous execution with smart defaults. Pause only on destructive ops or genuine ambiguity
type: feedback
originSessionId: 3069f89c-564f-44b5-9a43-9a887bbfa820
---

# Be autonomous when invited

When user says "Поехали" / "go" / "Будь автономен" / similar — they want autonomous execution with smart defaults. Don't ask for routine clarifications.

**Why:** User runs CustomReport as a personal product, makes design decisions quickly, and expects me to pick recommended option (e.g. "B/Hybrid" when I had recommended it earlier) without re-asking. Verified across multiple sessions — Block 2 Save Version policy = "Поехали. Будь автономен." → I picked Option B and shipped without re-confirming.

**How to apply:**

- When my plan offers options and user signals "go" without picking, use my own recommended option.
- Still pause for: destructive DB ops requiring `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`, force-push, branch deletion, anything that affects shared state.
- Still pause for: structural mismatch / blockers that have multiple non-obvious paths (e.g. ROADMAP.md restructure vs canonical /gsd-complete-milestone flow — those are genuine architectural questions, not routine).
- Don't pause for: implementation choices, library subselection, test naming, file placement — pick reasonable defaults and ship.
