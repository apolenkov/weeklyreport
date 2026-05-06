# Backlog

Milestones / phases / plans drafted but not active.

```
backlog
├── v8.1-ROADMAP.md       Visual Identity & AI Maturity (parked 2026-05-06)
└── v8.1-REQUIREMENTS.md
```

## Promote a backlog item

```
[backlog/<item>.md]  --[move]-->  [.planning/milestones/<item>.md]
                                          │
                                          ▼
                                  /gsd-new-milestone <name>
                                          │
                                          ▼
                                  /gsd-plan-phase <NN>
```

## Park rules

- A backlog item carries `**Status:** BACKLOG (parked YYYY-MM-DD — reason)` in its top metadata.
- No phase commits land while in backlog.
- v8.0.0 (or current shipped tag) remains the production reference.
- Move back via `git mv` to preserve file history when promoting.
