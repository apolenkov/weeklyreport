# Catalog — api-mod-report-escalations.ts (2026-07-02)

1 files. Purpose/layer/domain per file, for the architecture-grouping analysis.

| File                                       | Layer | Domain          | Purpose                                                                                                                                                    | Key exports                      | Deps                                                                                                                     |
| ------------------------------------------ | ----- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| apps/api/src/modules/report-escalations.ts | util  | report-sections | Builds the Escalation[] roll-up (flagged-red, blocked-risk, unresolved-risk) shared identically by both the live and published-snapshot report read paths. | buildEscalationsFromReadSections | published-report-snapshot.ts (effectiveProjectStatus), ReportSectionReadModel/Escalation types from @customreport/shared |
