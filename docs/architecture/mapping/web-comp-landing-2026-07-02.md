# Mapping — web-comp-landing (2026-07-02)

Source catalog: `docs/architecture/catalog/web-comp-landing-2026-07-02.md` (4 files).
Target structure: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md` (apps/web FSD-lite:
`app/` = routing only, `features/<domain>/{ui,model,api}` = slices, `shared/` = agnostic).

`landing` is its own canonical domain (see Grouping rules table, "+ … landing as their own").
All four files are `component`/`config` layer → `ui/` segment of the `landing` slice; none
is a tRPC wrapper (`api/`) or a client hook/mapper (`model/`), and none is shared by a second
slice, so nothing graduates to `shared/` under the rule-of-2 (web).

| Current path                                              | Target path                                                | Layer          | Domain  | Move? | Note                                                                                                                                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------- | -------------- | ------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/web/src/components/landing/landing-page.constants.ts | apps/web/src/features/landing/ui/landing-page.constants.ts | config → ui    | landing | yes   | Static tagline list consumed only by tagline-cycler; no second consumer, stays in `ui/` beside its component rather than promoted to `model/` (not a hook/mapper/type, just data). |
| apps/web/src/components/landing/pulse-background.tsx      | apps/web/src/features/landing/ui/pulse-background.tsx      | component → ui | landing | yes   | Static decorative component, zero-JS; pure `ui/` leaf.                                                                                                                             |
| apps/web/src/components/landing/pulse-mark.tsx            | apps/web/src/features/landing/ui/pulse-mark.tsx            | component → ui | landing | yes   | Static wordmark component; pure `ui/` leaf.                                                                                                                                        |
| apps/web/src/components/landing/tagline-cycler.tsx        | apps/web/src/features/landing/ui/tagline-cycler.tsx        | component → ui | landing | yes   | Client component with local useState/useEffect/useRef; state is view-local (fade cycle timer), not a reusable hook extracted to `model/` — stays `ui/`.                            |

Notes:

- No file in this catalog crosses into `model/` or `api/` — the landing slice, per the
  migration-slices list, is a candidate "ONE self-contained leaf slice" precisely because
  it has no hooks-to-extract or tRPC calls, only static/decorative UI plus one data constant.
- All 4 rows require relocation (`components/landing/` → `features/landing/ui/`); this
  mapping is planning-only per the doc's "PLANS, not scheduled work" caveat — no files moved.
- A `features/landing/index.ts` barrel is expected per the FSD-lite pattern but is not itself
  a catalog entry (net-new file), so it is not listed as a mapping row.
