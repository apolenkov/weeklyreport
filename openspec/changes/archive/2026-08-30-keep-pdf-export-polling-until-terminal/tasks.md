## 1. Regression Test

- [x] 1.1 Add a focused unit test proving that missing and queued PDF status keep the two-second interval while completed and failed status stop it.

## 2. Web Fix

- [x] 2.1 Make PDF status polling terminal-driven without changing the public job lifecycle or artifact delivery.
- [x] 2.2 Preserve the active report-scoped job ID across an in-tab component remount and clear it on every terminal or error outcome.

## 3. Verification

- [x] 3.1 Run the focused PDF export test, strict OpenSpec validation, the complete local gates, production Docker build, and cold real-browser acceptance for head and viewer before archive and final closeout.
