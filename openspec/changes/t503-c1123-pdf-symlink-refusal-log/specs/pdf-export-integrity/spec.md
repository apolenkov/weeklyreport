## MODIFIED Requirements

### Requirement: PDF artifact download resolves the completed generation's file

The authenticated download handler MUST keep the public URL
`/pdfs/{jobId}.pdf` and MUST resolve the physical file
`${jobId}-g${generation}.pdf` from the completed row's persisted generation.
It MUST serve bytes only when the row is `completed`, the stored artifact URL
is the canonical public one, and the caller is the immutable requester. It
MUST NOT serve a file whose generation differs from the completed row's
generation, and a missing generation file MUST answer 404. Generation
resolution is mandatory: the handler MUST NOT fall back to the legacy
un-suffixed `${jobId}.pdf` filename. Files left behind
by older generations are inert residue: they MUST NOT be served, adopted, or
deleted by the download or publication paths.

The artifact MUST be opened without following a symlink at the artifact path.
A symlink there MUST answer the same empty 404 as a missing file and MUST emit
one warning log, distinct from the missing-file case, carrying only the job id
and the errno code. Any other artifact open failure MUST answer 500 with an
error log carrying only the job id and the errno code.

#### Scenario: A completed export serves its own generation's bytes

- **GIVEN** a row `completed` at generation g
- **WHEN** the owner requests `/pdfs/{jobId}.pdf`
- **THEN** the handler streams `${jobId}-g${g}.pdf` after the ownership check

#### Scenario: An old generation file is never served

- **GIVEN** files for generations g and g+1 both on disk while the row
  completed at g+1
- **WHEN** the owner downloads the artifact
- **THEN** only the g+1 file is served
- **AND** the g file is never selected by path or fallback

#### Scenario: A missing generation file fails closed

- **WHEN** the completed row's generation file is absent from the artifact
  directory — including when only a legacy un-suffixed `${jobId}.pdf` exists
- **THEN** the download responds 404 rather than serving any other file

#### Scenario: A symlinked artifact is refused opaquely and logged

- **GIVEN** a completed row whose generation artifact path is a symlink
- **WHEN** the owner requests `/pdfs/{jobId}.pdf`
- **THEN** the response is an empty 404
- **AND** exactly one warning log names the job id and the code `ELOOP`
- **AND** no error log is emitted and no file path is logged

#### Scenario: A missing artifact stays silent

- **WHEN** the completed row's generation file is absent
- **THEN** the response is 404
- **AND** no warning or error log is emitted
