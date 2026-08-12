/**
 * Public preflight journal boundary.  The journal records whole-state
 * attempts; it never starts a browser, finalizes MATRIX, or publishes PASS.
 */
export {
  assertPreflightAssignmentMatchesSource,
  createPreflightAssignment,
  parsePreflightAssignment,
  PREFLIGHT_ASSIGNMENT_ARTIFACT,
  PREFLIGHT_ASSIGNMENT_VERSION,
  type PreflightAssignment,
  PreflightAssignmentError,
  type PreflightAssignmentState,
  preflightAssignmentStateFor,
  readOrCreatePreflightAssignment,
  readPreflightAssignment,
  serializePreflightAssignment,
  writePreflightAssignment,
} from "./preflight-assignment.ts";
export {
  createPreflightSegmentArtifact,
  parsePreflightSegmentArtifact,
  type PreflightSegmentArtifact,
  preflightSegmentForArtifact,
  readPreflightSegmentArtifact,
  writePreflightSegmentArtifact,
} from "./preflight-journal-artifact.ts";
export {
  journalIdentitySchema,
  journalStateIdentitySchema,
  journalStateSchema,
  parsePreflightJournalRecord,
  PREFLIGHT_JOURNAL_ARTIFACT,
  PREFLIGHT_JOURNAL_VERSION,
  PreflightJournalError,
  preflightJournalIdentityFor,
  type PreflightJournalPassRecord,
  type PreflightJournalRecord,
  preflightJournalRecordBody,
  preflightJournalRecordSchema,
  type PreflightJournalState,
  preflightJournalStateDigest,
  type PreflightJournalStateIdentity,
  type PreflightJournalStatus,
  PreflightJournalValidationError,
} from "./preflight-journal-contract.ts";
export {
  appendPreflightJournalStarted,
  appendPreflightJournalTerminal,
  parsePreflightJournalText,
  readPreflightJournal,
} from "./preflight-journal-io.ts";
export {
  artifactReaderForFiles,
  assembleCanonicalPreflightSegments,
  type PreflightJournalArtifactReader,
  type PreflightResumePlan,
  resolvePreflightResume,
  type RevalidatedPreflightPass,
  revalidatePreflightJournal,
} from "./preflight-journal-resume.ts";
export {
  type JournaledPreflightInput,
  type JournaledPreflightResult,
  PreflightJournalRunnerError,
  PreflightStateAmbiguousError,
  type PreflightStateRunner,
  runJournaledPreflight,
} from "./preflight-journal-runner.ts";
export type { PreflightJournalValidation } from "./preflight-journal-validation.ts";
export { validatePreflightJournal } from "./preflight-journal-validation.ts";
export {
  createPreflightJournalWriter,
  type PreflightJournalWriter,
} from "./preflight-journal-writer.ts";
