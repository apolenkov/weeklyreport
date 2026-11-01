# ui-crawl-evidence Specification

## Purpose

Defines how the tester-kit crawler keeps diagnostic causes, confirmed screenshot and video references and response statistics honest in its report.

## Requirements

### Requirement: Crawler diagnostic failures retain their cause

The crawler MUST allow environment-only secrets only when the file is absent; other read failures MUST retain path and cause without revealing contents. CLI bootstrap MUST obey configured time/output limits. Failed CLI output MUST be recovered only when complete valid batch results are available; invalid output MUST retain the original exit and stderr.

#### Scenario: Secret file exists but cannot be read

- **WHEN** secret-file reading fails for a reason other than absence
- **THEN** configuration reports its path and original cause even if environment credentials exist

#### Scenario: CLI bootstrap stalls or batch output is truncated

- **WHEN** bootstrap exceeds its timeout or failed batch output is incomplete
- **THEN** the original bounded CLI failure remains observable

### Requirement: Login and page retries preserve diagnostic ownership

Crawler login MUST keep four bounded attempts and back off only between attempts. Terminal failure MUST retain the final cause and attempt count without exposing credentials. Quick and full page retries MUST retain distinct page and sign-in failures when all attempts fail, while discarding abandoned findings after a successful retry.

#### Scenario: All four login attempts fail

- **WHEN** authentication fails four times
- **THEN** exactly three backoffs occur and the final cause remains attached

#### Scenario: Page retry cannot sign in

- **WHEN** page loading and secondary sign-in both fail
- **THEN** both failures are distinguishable in the terminal diagnostic

### Requirement: Log draining clears only confirmed observations

The crawler MUST read each log source before clearing it. A failed read MUST remain explicit and its source MUST NOT be cleared. Successfully read sources MUST remain reportable even when another source fails. Clear failures MUST be reported after delivering read evidence.

#### Scenario: A log read or clear fails

- **WHEN** one source cannot be read or cleared
- **THEN** its failure is reported and other successfully read evidence is preserved
- **AND** unread sources remain uncleared

### Requirement: Screenshot references represent confirmed evidence

Crawler page and step screenshots MUST be null when unavailable. A filename MUST be returned only after successful capture. Aborted pages, worker output and merged reports MUST preserve null rather than linking a directory. Capture failures MUST remain explicit, and required restoration of a changed surface MUST still be attempted after a failed capture.

#### Scenario: Step screenshot fails

- **WHEN** screenshot capture after a changed press fails
- **THEN** the step has null screenshot and an explicit capture diagnostic
- **AND** surface restoration is still attempted

#### Scenario: Page aborts or its screenshot fails

- **WHEN** a page has no confirmed screenshot
- **THEN** direct, relativized and merged records preserve null

#### Scenario: Capture succeeds

- **WHEN** screenshot capture succeeds
- **THEN** the generated relative filename remains available in the record

### Requirement: Video references represent successful recording

Crawler video references MUST be null when disabled or when recording start/stop fails. A path MUST represent a started and successfully finished recording. Recording failures MUST be explicit, and merged JSON and Markdown reports MUST preserve unavailable evidence without inventing links.

#### Scenario: Recording is disabled or fails

- **WHEN** video is disabled or recording start/stop fails
- **THEN** the run has null video and the report has no video link
- **AND** failed commands produce recording diagnostics

#### Scenario: Recording succeeds

- **WHEN** recording starts and finishes successfully
- **THEN** the run retains the generated relative video path

### Requirement: Response statistics distinguish measurements from absence

Crawler reports MUST calculate p95 using nearest rank and display its measured sample count. Null response times MUST be excluded, actual zero MUST remain a measurement, and empty observations MUST be reported as not measured.

#### Scenario: Twenty measured responses

- **WHEN** responses are the integers 1 through 20 milliseconds
- **THEN** p95 is 19 milliseconds and the sample count is 20

#### Scenario: No data or an actual zero

- **WHEN** no non-null responses exist or the only measured response is zero
- **THEN** the report distinguishes not measured with zero samples from zero milliseconds with one sample

### Requirement: Role cleanup preserves failures

The crawler MUST attempt profile persistence and browser shutdown independently. Every crawl and cleanup failure MUST remain observable. Failed shutdown MUST identify its browser session and preserve its cause. An otherwise successful crawl with failed cleanup MUST exit unsuccessfully.

#### Scenario: Profile persistence fails

- **WHEN** writing the role profile fails
- **THEN** browser shutdown is still attempted
- **AND** the write failure remains observable

#### Scenario: Crawl and cleanup both fail

- **WHEN** traversal, profile persistence and browser shutdown fail
- **THEN** all three failures remain observable
- **AND** the crawl does not report success

#### Scenario: Shutdown fails after successful traversal

- **WHEN** traversal succeeds but browser shutdown fails
- **THEN** the role exits unsuccessfully with the session and shutdown cause

### Requirement: Missing crawl outputs are reported, not dropped

The crawler MUST list every requested role whose output is missing,
unreadable, not valid JSON or not a role result, with the role and the
reason, in `report.json` and as a warning in `report.md`, and MUST exit
non-zero. The full-walk merge MUST list every pass directory whose
`report.json` is missing or unreadable, MUST carry each pass report's missing
entries into the merged report, MUST still write the partial result and MUST
exit non-zero when anything is missing. Raw role and pass outputs MUST be
left as found.

#### Scenario: A role output is corrupt

- **WHEN** one requested role's output file is truncated
- **THEN** the report lists that role as missing with the reason and still
  contains the other roles
- **AND** the run exits non-zero and the truncated file is left in place

#### Scenario: A full-walk pass left no report

- **WHEN** a state pass directory has no `report.json` and another pass
  report lists a missing role
- **THEN** the merged report lists both, keeps the results it could read and
  the merge exits non-zero
