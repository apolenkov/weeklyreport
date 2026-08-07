## Context

See `proposal.md` for motivation. The current period navigator became a growing flex item in `95203545`, so a sibling archive filter moves toward the center of a wide toolbar. The slide row model always enables the owner badge and later only collapses consecutive repeats, even when Mine scope makes the author self-evident. The attached user screenshots and archived runtime screenshots provide evidence, but clean source-bound captures are required because browser inspector overlays can add lines that are not application DOM or CSS.

The change is frontend-only. It preserves the period dual-state invariant, role-coverage gate, destructive database guard, and deferred-feature pattern unchanged.

## Goals / Non-Goals

**Goals:**

- Restore a compact period/archive cluster without weakening narrow-width reachability.
- Make owner badge visibility an explicit input to the pure slide model.
- Produce deterministic screenshot evidence for affected roles, modes, and widths.
- Align the loading skeleton hierarchy with the loaded report and slide DOM so the transition keeps stable landmarks and width allocation.
- Contain wide slide and admin-table content in local scroll owners at compact widths.

**Non-Goals:**

- Change report queries, persisted visibility, snapshots, exports, or authorization.
- Recreate an old layout wholesale or accept a screenshot as the only test oracle.
- Add a visual-regression service or a new runtime dependency.

## Decisions

### Keep responsive ownership in the period navigator

Remove desktop flex growth from the navigator container while retaining its full-basis compact behavior and the flexible selector inside the compact breakpoint. The toolbar parent continues to own the gap between the complete left and right clusters.

Alternative: wrap period navigation and archive in a new fixed-width container. Rejected because the cluster already exists semantically and another wrapper would duplicate responsive policy.

### Pass author-mark context through the pure model

Add an explicit owner-badge visibility option from the lead Mine/Everyone state through the lead deck builder into column finalization. Column finalization suppresses only the selected owner when requested; foreign contributor series keep the existing collapse behavior. Head/viewer and other callers retain current multi-author behavior by default.

Alternative: hide badges with CSS in the lead client. Rejected because it would leave misleading accessible text and make screenshot output diverge from the semantic model.

### Separate screenshot capture from visual adjudication

Capture a source-bound matrix into `customreport-archive` and record route, role, mode, viewport, and source SHA. Compare old and new evidence only after reproducing both in clean browser contexts. Unit tests assert structural contracts; screenshots expose spacing and hierarchy gaps that DOM tests cannot judge.

### Mirror layout ownership in skeletons, not live data volume

Skeletons reuse the loaded surfaces' outer spacing, header split, compact context toolbar, and primary content containers. They intentionally use a bounded placeholder count because loading state cannot know the final data volume. Slide loading uses the current full-width article hierarchy and does not recreate the retired sidebar layout.

Alternative: measure and reserve the exact seeded page height. Rejected because skeleton behavior must remain stable for arbitrary report sizes and must not depend on seed fixtures.

### Make each wide surface own its horizontal overflow

Keep the slide canvas and admin users table at their readable intrinsic widths, but make their immediate local scroll hosts positioned overflow containers. The positioning boundary prevents Chromium from propagating a wide descendant into the document scroll width while preserving keyboard and pointer access to the host's horizontal scroll range.

Alternative: shrink tables and the four-column slide below their readable minimum width. Rejected because it would hide information density instead of assigning overflow to the component that owns it.

## Risks / Trade-offs

- [Risk] Removing flex growth could constrain the selector at intermediate widths. → Mitigation: keep compact full-basis reflow and capture both desktop and compact widths.
- [Risk] Mine/Everyone state could be unavailable while hydration is pending. → Mitigation: use the same effective visibility gate that controls foreign content and default to the privacy-preserving single-author presentation until hydrated.
- [Risk] Old screenshots may come from different data or SHA. → Mitigation: treat them as design references, not pixel baselines; final evidence is bound to the tested SHA.
- [Risk] Visual review expands the runtime-sweep critical path. → Mitigation: capture the small role/viewport matrix in parallel with focused tests and keep artifacts outside git.
- [Risk] A bounded skeleton cannot prevent height changes for unusually large reports. → Mitigation: preserve the first-viewport landmarks and widths, which are the dominant source of perceived layout shift, while avoiding false data-dependent heights.
- [Risk] Local horizontal scrolling can be overlooked on compact screens. → Mitigation: keep every wide surface inside the visible card boundary and verify that document width stays equal to viewport width while the local host retains a larger scroll width.

## Migration Plan

1. Add focused model and toolbar tests, then make the two minimal behavior changes.
2. Capture the role/mode/viewport matrix from the source app and review it against archived references.
3. Run the full repository gates before the final runtime source freeze.
4. Roll back by reverting the frontend-only commit; no data migration or cleanup is required.
