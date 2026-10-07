## Final low-priority evidence

- [x] Demonstrate disabled/failed video and percentile absence/rank regressions before implementation.
- [x] Confirm recording availability, preserve nullable merged paths and report nearest-rank p95 plus sample counts.
- [x] Sync ui-crawl contract, pass six mandatory gates, commit, push and open a separate MR.

Original low-priority regressions exit 1 (6 failures), merged-video regression exits 1 against the original merger. Final 8 video/statistics plus 19 adjacent regressions exit 0. Evidence: ~/work/handoffs/287-crawl/report-evidence/.

Final six mandatory checks exit 0. Recording completion is checked independently of screenshot availability; timing still excludes recording stop. All evidence is in ~/work/handoffs/287-crawl/report-evidence/. Commit/push/MR use normal hooks; merge requires the owner.
