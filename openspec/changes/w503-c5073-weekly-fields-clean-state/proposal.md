# Proposal

## Why

C5073: the Activity weekly-fields editor marks its draft dirty on every keystroke
and never compares it with the authoritative values. Typing back to the original
text, or entering whitespace over an empty (null) field, still enables Save,
reports a pending edit to the parent and arms the unsaved-edit unload guard.

Backlog: TASK-503.37 (wave11, C5073). Evidence: `task-503/portfolio-37/`
(CONTRACT-503-37.md, C5073-red-raw.log, ROOT-C5073-RED-ADMISSION.json).

## What Changes

- The weekly-fields draft is dirty only while its normalized title/description
  pair differs from the authoritative pair the draft was opened (or last
  reseeded) against. Normalization is the existing trim-to-null rule.
- Stale-server detection, Reset to catalogue name, Cancel and validation are
  unchanged. The native navigation prompt is not part of this change.
