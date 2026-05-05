---
name: Always do full visual mockup audit before claiming UI done
description: Functional tests + screenshots aren't enough; user catches mockup deltas (dashed borders, copy, spacing) that automated tests miss
type: feedback
---

After the v7.0 mockup parity round, user pushed back: "Я нажал — у нас же ячейки для следующей недели, граница пунктирная. Почему ты это упустил? И сколько ты таких вещей ещё упустил???"

Triggered an audit that found 39 deltas I'd missed. Functional tests + screenshot-snapshot tests passed; the visual-vs-mockup audit was the gap.

**Rule:** when shipping UI work that's supposed to match a mockup, run a structured mockup-vs-impl audit pass BEFORE declaring done — not after the user catches mistakes.

**Why:** screenshot-snapshot tests confirm "page renders" but don't validate "page matches design". Mockups have explicit CSS rules (border-style, font-weight, letter-spacing, color hex codes, animation keyframes) that functional tests don't read.

**How to apply:**
- After UI work that's mockup-driven, spawn a general-purpose agent with the mockup HTML + impl source paths and ask it to produce a deltas list (severity-tagged).
- Pattern to follow: `.planning/MOCKUP-AUDIT-2026-05-05.md` — sections per screen, fields {Mockup says, Impl does, Severity, Fix sketch}.
- The audit task should explicitly look for: borders (dashed vs solid, color), spacing, typography (size/weight/tracking), colors not matching CSS-variable references, hover/focus/active states, mobile breakpoints, status badges, animations.
- Tier the fixes (one PR per screen) and let user pick scope.

**Avoid:** declaring "mockup parity done" based only on screenshots looking similar at a glance — every project has at least 30+ subtle deltas a designer would flag.
