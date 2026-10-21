# Design

Use the current YAML, Lefthook, package scripts and executable contract tests as primary evidence. Compare build-images and deploy-production objects before and after: script, images, artifacts, rules and resource groups must match. There is no build-images dependency on production-build.

Before: GitLab performs checks, image build and deployment. After: local pre-push performs format/lint/typecheck/test/spec/audit/secrets, explicit commands perform expensive checks, GitLab builds four images and offers manual deployment. Keep existing hook skip conditions; validation must execute the complete commands explicitly so an agent skip is never PASS evidence.

Reuse the existing scanners and test commands. No repository semaphore exists; use the host lockf around the local verification run. Preserve all destructive database guards and require coordinated synthetic targets for optional database checks. No product, role-builder or lifecycle invariant changes.

PASS requires glab CI lint, all six repository gates, full pre-push command execution and unchanged build/deploy objects. Any failed or skipped check is not PASS. Independent review is requested from the coordinator with exact SHA evidence. No merge is authorized.
