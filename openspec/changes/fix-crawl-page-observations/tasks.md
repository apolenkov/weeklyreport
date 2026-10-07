## Page observations

- [x] Demonstrate C4125 current long-task, C4167 live values, C4160 offscreen obstruction and C4161 clipping regressions before fixes.
- [x] Fix observations and verify native browser outcomes, including password, fast handler, actual obstruction and intentional truncation boundaries.
- [x] Sync ui-crawl contract, run all six required checks and deliver a separate MR.

Original native browser regressions: exit 1, 7 failures covering all four tickets. Final observations plus select/repress browser regressions: 24 tests, exit 0. Evidence: ~/work/handoffs/287-crawl/observations/.

All six mandatory gates exit 0 with CRAWL_BROWSER_TESTS=1. Commit, push and separate MR follow normal hooks; merge requires the owner.
