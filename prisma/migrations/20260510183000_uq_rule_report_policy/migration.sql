-- UFB-036 (Phase 44-03): unique constraint on (reportId, policyId) so
-- the PolicyApplicator upsert is safe to retry. Postgres treats NULL as
-- distinct, so legacy rules with NULL policyId remain allowed in
-- arbitrary cardinality (one rule per legacy reportId is the de-facto
-- pre-44 invariant).

CREATE UNIQUE INDEX "uq_rule_report_policy"
  ON "ReminderRule" ("reportId", "policyId");
