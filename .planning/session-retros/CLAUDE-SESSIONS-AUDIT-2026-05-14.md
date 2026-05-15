# Claude Sessions Audit - 2026-05-14

Source scope:

- Runtime directory: `~/.claude/projects/-Users-ap-work-customreport/`
- Raw JSONL is not copied into the repo.
- Goal: preserve what was requested/planned in Claude sessions without committing private transcripts.

## Session Census

| Session JSONL                                | Size | Lines | User msgs | Plan feedback hits | Edit hits | Bash hits |
| -------------------------------------------- | ---: | ----: | --------: | -----------------: | --------: | --------: |
| `bba7038f-3313-48a3-895f-09a1520a7c56.jsonl` | 115M | 36987 |      6883 |                238 |       976 |      3060 |
| `32223757-8778-4d1b-8910-37480c159bf7.jsonl` |  31M | 11215 |      2387 |                177 |       233 |      1354 |
| `4a7bc368-fa56-49f0-9165-2657ff5f73de.jsonl` | 3.9M |  1855 |       437 |                 13 |        47 |       271 |
| `72e8dac0-e77a-4259-b08d-3ec23a411d48.jsonl` | 1.0M |   251 |        52 |                 23 |        17 |        17 |
| `74110ae3-9c0f-4ff9-83c4-2b959789b12a.jsonl` | 668K |   329 |        69 |                  1 |        10 |        39 |
| `d8fd4ba2-1439-46ee-afe2-07c62e51aac6.jsonl` | 228K |   123 |        22 |                  1 |         0 |         9 |
| `d41f4696-75fc-4cac-84d8-318e39452d47.jsonl` | 212K |   112 |        16 |                  1 |         0 |         4 |
| `8357784d-1a7d-42e4-8837-17545186c251.jsonl` |  40K |    13 |         1 |                  1 |         0 |         0 |
| `299d87c3-f6a5-4b60-a9e9-952ef397590c.jsonl` |  24K |     6 |         1 |                  1 |         0 |         0 |
| `3c79c32f-a621-4042-8b21-6071ae0e39f4.jsonl` |  20K |    23 |         1 |                  1 |         0 |         0 |
| `d6bf2f96-7383-49d9-8cca-f0c64520e678.jsonl` |   8K |    10 |         3 |                  0 |         0 |         0 |

## Recovered Threads

```
Claude sessions
├── bba7038f...  main marathon / UAT v7.4 / PR #3-#4 closure
├── 32223757...  PRJ-2 resume / PR #5 / tooling + coverage closure
├── 4a7bc368...  admin/settings/data-invariant planning
├── 72e8dac0...  denied-plan feedback and retries
└── smaller logs   setup/status/plan-feedback fragments
```

## Hard Requirements Recovered

1. Review Claude sessions separately from repo state before planning new work.
2. Treat Plannotator approved/denied plans and annotations as first-class planning sources.
3. Do not paste raw session text into the repo; store sanitized ledgers only.
4. Preserve old plan layers instead of flattening them away.
5. Classify each request as `DONE`, `OPEN`, `DEFERRED`, or `SUPERSEDED` with file/commit evidence.

## Current Closure Signal

The live repo has already absorbed the immediate PRJ-2 closure work:

- CI workflow action versions were corrected in `e4a6bfd` and `ffb3a15`.
- `E-04` reminder failure feedback is covered in `45e1cac`.
- `E-08` and `UFB-024` were already covered before this resume.
- PR #5 is open and mergeable, but cannot merge until CI has a real green check.
