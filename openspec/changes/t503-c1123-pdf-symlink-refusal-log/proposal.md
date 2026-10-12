# Proposal

## Why

C1123: opening the PDF artifact with `O_NOFOLLOW` rejects a planted symlink
with `ELOOP`, but the handler maps that to the same silent 404 as a missing
file. A tampering attempt is indistinguishable from an ordinary missing
artifact in the logs.

## What Changes

- The open reports `ELOOP` separately from `ENOENT`; on `ELOOP` the handler
  logs one `pdf artifact symlink refused` warning with only the job id and the
  code, then answers the unchanged empty 404.
- `ENOENT` stays silent; other open errors keep the 500 and error log.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pdf-export-integrity`: the artifact download requirement gains the symlink refusal contract.

## Impact

`pdf-export.download-handler.ts` and its colocated test.

## Non-goals

- The response stays opaque; no `readlink` and no path in the log.
- No rate limiting of the warning: requests are owner-authenticated per job.
- An `ELOOP` from a looping intermediate directory is logged the same way.
