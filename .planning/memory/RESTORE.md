# Restoring Claude Memory After git pull

Files in this directory mirror the per-project Claude auto-memory at
`~/.claude/projects/-Users-ap-my-customreport/memory/`. They travel via
git so context survives across machines.

## On a fresh clone (other machine)

```bash
mkdir -p ~/.claude/projects/-Users-ap-my-customreport
cp -r .planning/memory ~/.claude/projects/-Users-ap-my-customreport/
```

After this, Claude Code's auto-injected `MEMORY.md` will load the index
and resume-work skills will see prior session context.

## Saving new memory

When you (or Claude) add new memory files via `cp-handoff` or manual
edits to `~/.claude/projects/-Users-ap-my-customreport/memory/`, mirror
them back to this directory and commit so the next machine gets them:

```bash
cp -r ~/.claude/projects/-Users-ap-my-customreport/memory/. .planning/memory/
git add .planning/memory && git commit -m "chore(memory): sync session handoffs"
```

## Why not symlink?

Symlinks across machines are fragile when Claude rewrites files (replace
vs. in-place write breaks the link). Plain copy is simpler and the
content doesn't change frequently.
