## Select freshness

- [x] Add native browser regressions and demonstrate original failure.
- [x] Implement fresh availability and quick/full assignment policy; verify regressions and consumers.
- [x] Sync ui-crawl spec; run six mandatory gates, commit, push and open a separate MR.

Validation: original native regressions exit 1 (6 failing boundaries), final 16 native browser tests exit 0. All six mandatory gates exit 0. Logs: ~/work/handoffs/287-crawl/select/. Push and MR follow normal hooks; owner merge required.
