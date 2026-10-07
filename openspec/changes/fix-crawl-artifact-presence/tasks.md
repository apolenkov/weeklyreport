## Screenshot evidence

- [x] Demonstrate failed capture and aborted/direct/worker/merged page regressions before implementation.
- [x] Preserve nullable availability, report failures and verify required restoration plus confirmed-success paths.
- [x] Sync the ui-crawl contract, pass all six gates and publish a separate MR.

Original page/worker/merge regressions exit 1. Step regression with valid URL signature exits 1 against the original press implementation. Final 7 artifact + 18 adjacent tests exit 0; capture failure still restores the surface. Logs: ~/work/handoffs/287-crawl/artifacts/.

Final six required gates exit 0. Earlier full test exposed a CLI fixture startup flake, fixed separately in MR !79; this branch advances to that fix with identical tested source bytes. Logs: ~/work/handoffs/287-crawl/artifacts/final-*.log. Commit/push/MR follow normal hooks; merge requires the owner.
