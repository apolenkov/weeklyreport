## ADDED Requirements

### Requirement: Visual Acceptance Reviews the Entire Enumerated Frame Set

A visual acceptance run MUST derive its pre-capture inventory from every changed or affected presentation, interaction, status variant, responsive breakpoint boundary, and owner requirement, then enumerate every resulting page, state, and viewport before capture. Any exclusion MUST be located, justified, and explicitly accepted by the owner before the run. The run MUST produce fresh evidence for every enumerated item after the last rendered-source edit and assign a verdict to every full frame. A narrower behavioral assertion MAY pass independently, but any visible product defect anywhere in an enumerated frame MUST block the overall visual acceptance verdict until it is repaired and recaptured or the owner explicitly accepts the located debt. Reviewers MUST distinguish a product defect from an evidence-capture defect; neither type may be silently relabelled as out of scope after it appears in an enumerated frame.

Two fresh independent read-only reviewers MUST open every enumerated frame at original resolution without receiving an upstream PASS narrative first. Each reviewer MUST return separate verdicts for the scoped behavior, the whole captured surface, and evidence validity. One reviewer, a sample of frames, or model agreement without the deterministic evidence cannot close the gate.

#### Scenario: Unrelated defect appears in a scoped repair screenshot

- **WHEN** the intended focus behavior passes but the same captured frame visibly clips a navigation destination or overflows the document
- **THEN** the focus assertion MAY be recorded as passing
- **AND** the overall visual acceptance verdict remains blocked by the located product defect
- **AND** the evidence ledger names the affected frame, severity, owner, next action, and recapture required for closure

#### Scenario: Every affected viewport and state receives an independent full-frame verdict

- **WHEN** a responsive navigation change affects compact/wide presentations, active and focused states, non-zero operational counts, and the 1024 CSS px activation boundary
- **THEN** the inventory includes representative widths plus both sides of the boundary, every affected interaction/state, and the maximum-display count variant
- **AND** every resulting frame is captured fresh and opened directly by both visual reviewers
- **AND** each frame receives an explicit whole-frame inspection trace covering layout, clipping, overflow, content reachability, active state, and focus presentation
- **AND** a sample or aggregate PASS cannot substitute for a missing per-frame verdict

#### Scenario: Convenient pre-enumeration cannot hide an affected state

- **WHEN** a changed navigation has a compact variant, a wide variant, operational badges, a disabled destination, and a breakpoint boundary
- **THEN** the inventory is incomplete until all those affected variants and boundary states are covered or an owner-approved exclusion names the omitted state
- **AND** the run cannot declare visual PASS by preselecting only the direct-URL resting frame

#### Scenario: Capture defect does not trigger a product edit

- **WHEN** an image has the wrong dimensions, stale source identity, partial compositing, or an invalid file signature
- **THEN** the run classifies it as an evidence defect and recaptures it
- **AND** the product source is not changed solely to compensate for the defective evidence artifact
