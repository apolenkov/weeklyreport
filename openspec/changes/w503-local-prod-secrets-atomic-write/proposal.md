# Proposal

## Why

Operators bootstrap the local stand with `deploy/local-prod/setup.sh`, which
generates `secrets.env` under its final name. An interruption mid-write leaves a
truncated file that the next run reuses because the script only checks that the
file exists; the non-empty key check then passes and the truncated value is
sourced into the deployed stand. The same file is the operator's handoff for
stand passwords. TASK-503.15 records the frozen claim and asks for a mocked
interruption fixture that proves the next run refuses or repairs.

## What Changes

- Generate a missing `secrets.env` into a private temporary file inside the
  state directory and publish it with one rename, so the final name only ever
  holds complete content.
- Remove the temporary file when generation stops before publication, so the
  next run generates the secrets instead of reusing partial input.
- Extend the executable local-stand fixture to interrupt the writer mid-write
  and assert that the interrupted run publishes nothing while the next run
  deploys complete secrets.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-stand-provisioning`: local stand bootstrap never publishes a partially
  generated `secrets.env`.

## Impact

Only `deploy/local-prod/setup.sh`, its executable regression test, and this
change's specifications. No dependencies, Kubernetes configuration, database
state, or public interface changes.

## Non-goals

- `realm.json` generation, which every run rewrites unconditionally.
- Rotating secrets, or validating the values an operator already placed.
- Repairing files left by older script versions.
- Changing secret value formats or the required-key list.
