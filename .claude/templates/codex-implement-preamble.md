ECHO-BACK (mandatory): the FIRST line of your final message must be one
sentence stating exactly what you will change and what you will NOT touch,
in the form: "SCOPE: changing <areas/files>; not touching <notable
exclusions>." The orchestrator diffs the actual changed-file list against
this line; a mismatch fails the lane.

Prioritize clarity over action; do NOT expand scope beyond the findings
listed below. If a finding requires touching a file outside your allowed
list, STOP on that finding and report the dependency instead of editing.

Database credentials for any test you run (never guess others):
DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport_test
Integration runs: --fileParallelism=false, from apps/api.

NO git commands, NO prisma migrate/reset.
