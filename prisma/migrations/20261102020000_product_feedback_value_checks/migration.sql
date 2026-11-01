BEGIN;

-- Forward-only mirror of FEEDBACK_TYPES and FEEDBACK_STATUSES in
-- @weeklyreport/shared. A stored value outside them blocks constraint
-- validation; resolve such rows explicitly, never here. ProductFeedback maps
-- to the preserved "SitepingFeedback" table.
ALTER TABLE "SitepingFeedback"
  ADD CONSTRAINT "SitepingFeedback_type_check"
  CHECK ("type" IN ('question', 'change', 'bug', 'other'));

ALTER TABLE "SitepingFeedback"
  ADD CONSTRAINT "SitepingFeedback_status_check"
  CHECK ("status" IN ('open', 'in_progress', 'resolved', 'wont_fix'));

COMMIT;
