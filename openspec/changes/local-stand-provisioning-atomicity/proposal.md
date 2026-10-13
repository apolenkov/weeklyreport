# Proposal

## Why

A failed local-stand provisioning run can leave a group or changed user roles
without the intended head assignment. TASK-503 C0139 (originally TASK-287) and the current
`deploy/local-prod/provision-users.sql` / `docs/kubernetes.md` stdin workflow
identify three independent statements whose earlier writes survive a late error.

## What Changes

- Apply the local-stand reporting group, four user assignments, and head pointer
  as one transaction, so any statement failure leaves the pre-run graph intact.
- Document the rollback and successful sequential replay contract.

## Capabilities

### New Capabilities

- `local-stand-provisioning`: Atomic application of the local-stand SQL
  provisioning graph through the documented psql stdin workflow.

### Modified Capabilities

None. SAML login provisioning and Helm deployment keep their existing contracts.

## Impact

The only runtime change is in `deploy/local-prod/provision-users.sql`.
Verification uses actual psql stdin on a coordinator-approved synthetic target;
no production or Kubernetes execution is part of author verification.
No migration or dependency change is required.

## Non-goals

- Concurrent provisioning acceptance or a new group conflict policy.
- Identity remapping, foreign user ID adoption, or a new SAML mismatch policy.
- Changes to fixture roles, IDs, existing head pointers, or schema constraints.
