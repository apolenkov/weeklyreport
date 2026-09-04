## 1. Feedback contract and evidence

- [x] 1.1 Re-read feedback `cmtmkcxgi00003dw0xod1c64h`, preserve its 3/5
      evaluation, and research the Overview and SitePing failures against current
      source.
- [x] 1.2 Add executable acceptance for rendered popup measurement, visible
      Send, long names, grouping, and per-unit quick entry.

## 2. Overview quick entry

- [x] 2.1 Add Product/Activity group boundaries and complete reporting-unit
      labels without changing canonical ordering or temporal sources.
- [x] 2.2 Add Current/Next create targets and contextual `Add update` controls;
      keep Previously planned and read-only states inert.
- [x] 2.3 Reuse `ItemEditDialog` and the canonical `week-items` draft patch for
      Product and Activity creation; verify live projection and autosave.

## 3. SitePing composer containment

- [x] 3.1 Add a source-derived pnpm patch for the exact pinned SitePing runtime
      so placement measures the rendered popup and clamps its actual dimensions.
- [x] 3.2 Cover the patch with a compatibility test and a real-browser tall
      region check that keeps explicit Send visible and clickable.

## 4. Acceptance and closure

- [x] 4.1 Browser-test 1280x900 and 1728x962 for grouping, complete names,
      Product/Activity Current/Next dialog seeding, no document overflow, and
      zero console/network failures; prove save/autosave through the integration
      test without mutating the seeded report.
- [x] 4.2 Run focused tests and repository gates proportionate to the changed
      surfaces, then delete exact feedback `cmtmkcxgi00003dw0xod1c64h` and prove it
      is absent.
