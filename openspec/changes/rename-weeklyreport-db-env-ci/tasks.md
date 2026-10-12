# Tasks

## 1. Old targets

- [x] 1.1 Drop `customreport_e2e`, `customreport_e2e_lane_a_test`, `customreport_e2e_lane_b_test` under the old guard (exact loopback targets, masked URL, no active connections).

## 2. Names

- [x] 2.1 Guard, Redis resolver, bootstrap/reset/seed, env schema/examples, scripts, CI, Dockerfile cache ids, tester-kit and coordination docs use the new names.
- [x] 2.2 Guard and resolver tests pin the new names and reject the old ones.

## 3. New targets and acceptance

- [ ] 3.1 Create `weeklyreport_e2e` and the lane databases under the new guard; guarded reset plus explicit seed on each.
- [ ] 3.2 Local source-start, guarded API integration and full E2E pass on the new names.
