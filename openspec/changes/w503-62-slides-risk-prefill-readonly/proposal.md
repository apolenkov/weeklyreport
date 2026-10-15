# Proposal

## Why

C4817 host-orchestration hardening: SlidesQuickAddRiskDialog stores a prefill
before read-only-sensitive openCreate can refuse it. A later manual Add can
inherit severity/stages from that refused command. Root approved consuming and
dropping the refused signal before storing payload, preserving accepted seeds.
The existing harness can demonstrate the host boundary; a current public Slides
producer of that exact sequence has not been admitted. No native/AT/DB failure
or whole C4817 closure is claimed.

## What Changes

- Consume a new prefill signal while read-only, then return before storing it.
- Becoming editable must not replay that old signal or seed a later manual Add.
- Accepted product/activity seeds and stage/severity values remain intact;
  ordinary manual Add is unchanged. Keep existing mutable/save/read-only guards.
- Reuse old d25 host RED/plain-Add test and add accepted-parent controls; mocked
  RiskEditDialog observes forwarded props, not visible editor selection/save.

## Remaining scope

The other seven TASK-503.62 IDs (C4737/C4816/C4819/C4822/C4836/C4837/C4853)
remain DEFERRED with their existing mixed/rejected/native limits. C4817's separate
normal-add-without-close wording is not automatically proved by a refused-request
fix; keep its actual producer/expectation for Root. Do not broaden effects, replay
signals across views, change global dialog/schema APIs or claim native closure.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-dialog-lifecycle`: consume and drop prefill refused while read-only.
