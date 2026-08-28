## Context

The first CAS repair already makes Prisma terminal updates conditional on a
pending row, but the processor still writes and removes one shared canonical
path before and after that CAS. The existing download handler authorizes only a
completed row whose path is exactly `/pdfs/{jobId}.pdf` and opens that path with
`O_NOFOLLOW`; the repair must preserve that URL and authorization contract.

## Goals / Non-Goals

**Goals:**

- Make artifact publication first-writer-wins on the same filesystem.
- Make retries after publish-before-CAS crash safe and make all checksums come
  from the bytes that remain at the canonical path.
- Keep terminal database transitions coherent and fail closed without a schema
  or queue change.
- Provide a small overridable filesystem seam so causal interleavings can be
  tested without Redis, a database reset, or timing-dependent real files.

**Non-Goals:**

- Change the public `/pdfs/{jobId}.pdf` URL, download authorization, schema, or
  retention policy.
- Make failed/orphaned bytes directly downloadable; the existing database-row
  gate remains authoritative.

## Decisions

### 1. Validate completion before Prisma

`saveExportJob` first requires `status === "completed"`, the canonical
`artifactUrl` `/pdfs/{jobId}.pdf`, and a non-blank `checksum`. It
throws `PdfExportDomainError` before `updateMany` for every invalid shape.
`markExportFailed` keeps its
pending predicate; when the count is zero it reads the row, treats an existing
completed/failed terminal row as an idempotent no-op, and throws only when the
row is absent.

### 2. Publish through an attempt-owned same-directory file

The processor will use a small `PdfArtifactStore` seam. The default store:

1. creates a unique dot-prefixed temporary file with exclusive creation in
   `PDF_OUTPUT_DIR`;
2. writes the captured bytes, calls `FileHandle.sync()`, and closes it;
3. publishes with same-filesystem `link(temp, canonical)`, never replacing an
   existing canonical entry;
4. treats `EEXIST` as adoption, but rejects a symlink or non-regular canonical
   entry; and
5. opens the canonical file with `O_RDONLY | O_NOFOLLOW`, verifies it is a
   regular file, hashes the bytes read from that handle, and fsyncs the
   containing directory before returning the checksum.

The temporary name is unique per attempt and the cleanup callback owns only
that temporary path. After a successful link or valid adoption, removing the
temporary hard link cannot remove the canonical inode. The canonical path is
never passed to cleanup.

### 3. Keep publication and CAS failure-safe

The processor publishes and verifies the canonical artifact before calling
`markExportCompleted`. If that call loses a terminal race, it propagates the
conflict but leaves the canonical file intact. If failure wins after
publication, the database row is failed and the existing download handler
returns 404 before opening the orphaned canonical bytes. A retry can adopt and
rehash a regular canonical file, then complete only if the row is still
pending.

Before:

```text
PDF bytes -> write jobId.pdf -> mark completed
                         \-> any persistence error deletes jobId.pdf
```

After:

```text
PDF bytes -> exclusive temp -> fsync temp -> link(no-replace) -> verify/hash
                                                        |
                                        fsync directory -+-> terminal CAS
                                                        |
                         cleanup owns temp only <------+-> canonical survives
```

### 4. Preserve load-bearing invariants and deployment shape

This repair changes no period dual-state writer, role-coverage chain,
destructive database target, or deferred feature. It adds no dependency and
requires no migration or feature flag. Existing API workers and the download
handler use the same directory and URL, but deployment requires a controlled
worker handoff; a process crash leaves either a durable canonical orphan (not
servable without a completed row) or an attempt temp that can be cleaned by a
later bounded reaper outside this change.

## Risks / Trade-offs

- [Risk] A process can leave a canonical orphan after a crash or failed CAS →
  the DB status/path gate makes it unservable; cleanup policy is intentionally
  not expanded here.
- [Risk] Hard-link publication requires the temp and canonical paths to share
  a filesystem → both are created under the same configured output directory,
  and a non-`EXDEV` publication error fails the attempt rather than copying.
- [Risk] `O_NOFOLLOW`/directory fsync are platform-sensitive → keep the default
  primitive wrapper small and cover success, EEXIST adoption, symlink rejection,
  and cleanup ownership through injected causal tests.

## Migration Plan

No data migration. Drain or quiesce the `pdf-export` worker queue, deploy the
processor and repository code together, and only then resume workers. The
worker rollout MUST avoid overlap between old workers (which can overwrite or
delete the canonical path) and new workers. Monitor terminal export failures
and orphaned temp files. Rollback is code-only after the queue is drained;
rows written by the CAS repair remain compatible with the existing download
handler and URL.
