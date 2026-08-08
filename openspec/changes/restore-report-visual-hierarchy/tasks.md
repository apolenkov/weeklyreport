## 1. Web layout and model behavior

- [x] 1.1 Restore compact desktop sizing for period navigation while preserving compact-width reflow and archive-filter adjacency.
- [x] 1.2 Thread explicit owner-badge visibility through the lead slide model so Mine suppresses the selected owner and Everyone preserves every author series mark.
- [x] 1.3 Rebuild lead, weekly-report, and slide skeletons around the loaded surfaces' header, compact toolbar, and content hierarchy without data-dependent placeholder counts.
- [x] 1.4 Contain the wide lead and shared report slide canvases and admin users table in positioned local scroll hosts so compact pages retain viewport width.
- [x] 1.5 Disable only the Next.js on-screen development indicator and expose one stable application-owned navigation accent landmark.
- [x] 1.6 Reserve the compact viewer authority, document-action, and period-navigation rows while form or slide data resolves.

## 2. Focused regression coverage

- [x] 2.1 Add toolbar tests that prove the period navigator does not grow on desktop and remains usable at compact widths.
- [x] 2.2 Add slide-model and rendered-deck tests for Mine owner suppression, Everyone owner/contributor attribution, and unchanged head/viewer multi-author defaults.
- [x] 2.3 Add structural skeleton tests that pin header, toolbar-cluster, and full-width article parity at desktop and compact layouts.
- [x] 2.4 Add regression tests for lead/shared report slides and admin table local overflow ownership.
- [x] 2.5 Add a navigation regression assertion that exactly one application-owned accent landmark is rendered.
- [x] 2.6 Add viewer loading regressions for audience-specific header height and pending slide-chrome geometry.

## 3. Source-bound visual review

- [x] 3.1 Locate and catalogue relevant pre-refactor screenshot references with their source SHA or mark them as design-only evidence when the SHA cannot be proven.
- [ ] 3.2 Capture clean lead, head, admin, and viewer screenshots at desktop and compact widths, including lead edit/slides Mine/Everyone, into `customreport-archive` with a manifest.
- [ ] 3.3 Complete an independent visual review of toolbar hierarchy, navigation stripes, author marks, clipping, spacing, and control consistency; fix confirmed findings and repeat affected captures.

## 4. Verification

- [x] 4.1 Run focused Vitest files for period navigation, report toolbar, slide grid/model, and status slide deck.
- [x] 4.2 Run `pnpm lint:e2e:typecheck`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`, then record exact results in the runtime-sweep report and OpenSpec closeout.
- [x] 4.3 Run `openspec validate restore-report-visual-hierarchy --strict` and verify every completed task against the final source-bound evidence.
