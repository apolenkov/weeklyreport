# Tasks

- [ ] ST-1 — Define the template catalog contract: stable IDs, display names,
      supported slide content, and availability states.
- [ ] ST-2 — Build the Head-only template picker and representative previews;
      keep selection keyboard accessible and inert until a template is chosen.
- [ ] ST-3 — Persist an explicit report/template selection and restore it on
      reload; reject stale or unavailable template IDs.
- [ ] ST-4 — Thread the selected template into the source-bound slide/PDF
      export path without changing report records or density semantics.
- [ ] ST-5 — Replace the single `Slide templates` Coming-Soon control only
      after catalog, preview, persistence, and export acceptance is green.
- [ ] ST-6 — Add focused unit, component, and export-contract tests for
      catalog availability, preview selection, persistence recovery, and
      source-bound output.
- [ ] ST-V — Verification: run the focused web tests, web typecheck, lint,
      build, and source-bound desktop visual acceptance for Head slides in both
      densities and every activated template.
