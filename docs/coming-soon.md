# Coming soon

This is the canonical register of product work that is intentionally deferred
from the current WeeklyReport MVP. It contains only deduplicated, actionable
product intents. Completed, superseded, history-only, and process-only entries
are not retained here.

Nothing in this register is an implementation instruction. An item may move
to an OpenSpec change or implementation only after the owner gives a direct
instruction. Until then, its status is `deferred`.

## Current register

| ID                                 | Product intent                                                                                                                                                                             | Surface          | Status     | Activation trigger                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ---------- | ---------------------------------------------------------------------------- |
| `activate-telegram-bot`            | Enable Telegram delivery and interaction for weekly reports.                                                                                                                               | Integrations     | `deferred` | Direct owner instruction with channel and operational requirements.          |
| `add-head-period-bar-parity`       | Bring the head view's period navigation and context bar to parity with the supported report surfaces.                                                                                      | Head report      | `deferred` | Direct owner instruction after the target interaction is agreed.             |
| `add-holidays-calendar`            | Add a holiday calendar so planning and reporting can account for non-working days.                                                                                                         | Planning         | `deferred` | Direct owner instruction with the source and ownership of holiday data.      |
| `add-jira-linkage`                 | Link report items to Jira work and preserve the intended traceability.                                                                                                                     | Integrations     | `deferred` | Direct owner instruction with Jira scope and data contract.                  |
| `add-period-delete-action`         | Provide a deliberate, guarded way to delete an unneeded period.                                                                                                                            | Period lifecycle | `deferred` | Direct owner instruction after deletion and recovery rules are approved.     |
| `add-slide-template-selection`     | Let a publisher choose the slide template used for an exported report.                                                                                                                     | Export           | `deferred` | Direct owner instruction with the supported template set.                    |
| `design-mobile-report-entry`       | Design a deliberate mobile report-entry flow for dense weekly-report content instead of shrinking the desktop layout.                                                                      | Lead report      | `deferred` | Direct owner instruction after the mobile information hierarchy is approved. |
| `enable-i18n`                      | Support localized product copy with an explicit locale model.                                                                                                                              | Product shell    | `deferred` | Direct owner instruction naming the first supported locales.                 |
| `enable-theme-switch`              | Let a user select a supported visual theme.                                                                                                                                                | Product shell    | `deferred` | Direct owner instruction with the theme and accessibility contract.          |
| `merge-admin-head-roles`           | Consolidate administrative and head capabilities where the product model requires one role boundary.                                                                                       | Authorization    | `deferred` | Direct owner instruction after the role policy is approved.                  |
| `redesign-product-status-entry`    | Make SDLC status editing compact, scannable, and visually engaging through hierarchy and live states while keeping every stage label, blocker, owner, and completion state understandable. | Lead report      | `deferred` | Direct owner instruction after the compact status interaction is approved.   |
| `streamline-lead-quick-entry`      | Reduce lead reporting to the fastest supported desktop flow; evaluate a three-column previous/current/next-week layout grouped by product or project without sacrificing visual character. | Lead report      | `deferred` | Direct owner instruction after the target desktop flow is agreed.            |
| `support-multi-org`                | Support more than one organization with explicit tenant isolation.                                                                                                                         | Tenancy          | `deferred` | Direct owner instruction with tenancy and migration boundaries.              |
| `refine-activity-escalation`       | Define deliberate activity escalation and deferral behavior.                                                                                                                               | Activities       | `deferred` | Direct owner instruction after the desired escalation policy is specified.   |
| `improve-version-restore-fidelity` | Improve version restore fidelity for the supported versioning model.                                                                                                                       | Versioning       | `deferred` | Direct owner instruction with the restore contract and acceptance evidence.  |
| `wire-agent-review`                | Connect the agent-review workflow to the supported product review path.                                                                                                                    | Review workflow  | `deferred` | Direct owner instruction naming the reviewer, evidence, and approval flow.   |

## Register rules

- The AI provider, prompt-management, assistant, and semantic-search work from
  PR #70 is current MVP functionality, not a deferred register item.
- Historical deferred trees, duplicate entries, research notes, and temporary
  review artifacts do not belong in this file or under `openspec/`.
- When an owner activates an item, first create or update the corresponding
  OpenSpec specification, then implement and verify it against the current
  main SHA. Re-evaluate this register after completion so it does not retain
  delivered functionality.
