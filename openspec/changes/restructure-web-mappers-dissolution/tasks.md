## 1. Dissolve lib/mappers/ across three model homes (behavior-neutral)

- [x] 1.1 `git mv` the 28 files (18 source + 10 test siblings) from
      `lib/mappers/` into `features/admin/model`, `features/dashboard/model`
      (created here), and `features/report-sections/model` per the mapping (with
      the weekly-report → report-sections correction); delete the `index.ts`
      barrel and remove the emptied `lib/mappers/` tree.
- [x] 1.2 Reroute all imports src-relative (resolve each specifier against the
      file's old dir, remap moved-mapper targets, recompute from the new dir):
      the 21 barrel consumers split per-symbol to the owning `model/` file, the
      29 specific-file consumers, and every relocated file's own relative imports
      (incl. the two `dashboard → report-sections` cross-slice mapper edges and
      the stray `lib/stage-status.ts` → `traffic-light` ref).
- [x] 1.3 Rewire the 3 `vi.mock("…/lib/mappers", …)` doubles to the concrete
      `model/` module the component under test imports; merge the resulting
      duplicate `lead-form` import in `report-sections/ui/lead-form.tsx`.
- [x] 1.4 Repoint the `lead-form.ts` `max-lines` exemption to
      `features/report-sections/model/`; add `report-sections` to the `dashboard`
      zone-5 `except` allowlist (grandfather the pre-existing coupling).

## 2. Verify (behavior-neutral)

- [x] 2.1 Cold `tsc --noEmit` 0 errors (`pnpm typecheck` 5/5).
- [x] 2.2 Full `pnpm lint` clean (eslint `--max-warnings 0`, stylelint, prisma).
- [x] 2.3 Full unit suite green (web 1567 + api + shared).
- [x] 2.4 Live-verify from source (`:3100`): `/`, `/reports`, `/head/dashboard`,
      `/admin`, `/lead/report/[id]`, `/head/report/[id]` all HTTP 200,
      `/print/[id]` 307 (PDF-worker auth gate) — no module-resolution 500.
- [x] 2.5 `openspec validate restructure-web-mappers-dissolution --strict` green.
