## Context

The current contracts already expose the data needed for a workflow: control
availability, active revision, revision lifecycle, capability-test result,
latest async execution, preparation progress, and retained revisions. The
research file `docs/research/admin-ai-provider-card-ux-2026-09-04.md` maps those
values to honest UI states and records the provider-documentation constraints.

This design changes information architecture and interaction presentation only.
The API remains the sole authority for lifecycle transitions and secret
metadata remains bounded to the existing read model.

## Goals / Non-goals

**Goals:**

- answer “will AI work now?” in the first visible card;
- make the next valid lifecycle action obvious without hiding unavailable steps;
- distinguish active configuration from editable draft work;
- keep diagnostics and retained revisions available without dominating the
  first viewport;
- preserve responsive containment, accessibility, Demo styling, and current
  server semantics.

**Non-goals:**

- inventing free-form status editing or a physical delete action;
- exposing credentials, masked suffixes, or internal endpoint detail in the
  primary summary;
- changing provider capability tests, preparation, activation, or rollback
  behavior.

## Decisions

### Summary-first workflow

The Provider surface begins with one state summary. It derives its badge and
copy from the existing availability, revision lifecycle, execution, and
preparation fields:

| Existing state                 | Summary copy                                        | Primary action     |
| ------------------------------ | --------------------------------------------------- | ------------------ |
| `not_configured` / no revision | No AI provider is configured.                       | Save draft         |
| `draft`                        | Draft saved. Test it before activation.             | Test capabilities  |
| queued/running test            | Provider test is queued/running.                    | disabled Test      |
| `validated`                    | All required capability checks passed.              | Activate           |
| `preparing`                    | Embedding preparation is in progress: X/Y complete. | Resume activation  |
| `active`                       | AI is active for users.                             | Edit configuration |
| `failed`                       | Provider rejected the credential or configuration.  | Save new draft     |
| `superseded`                   | Retained previous configuration.                    | Restore            |

The UI MUST use existing server state, not infer a new lifecycle or offer a
free-form status control. `Disable` remains the action for the active service;
`Discard` remains limited to non-active discardable revisions and requires the
existing confirmation behavior.

### Guided cards and explicit edit mode

The primary flow is ordered as Configure, Test, Activate. The three steps stay
visible; steps that cannot run are disabled and include a short inline reason.
Generation and Embeddings are peer cards. Separate embedding controls appear
only for the existing `separate` mode. Built-in endpoint behavior, credential
retention, model fields, and reasoning controls remain unchanged.

An active revision opens in summary/read mode so the administrator can see the
currently serving configuration without mistaking it for unsaved edits. The
`Edit configuration` action enters the same existing draft form. When no active
revision exists, or when the selected revision is a draft/failed revision, the
form opens in edit mode so setup can continue without an extra empty click.
Cancelling edit mode leaves the active revision untouched.

### Secondary diagnostics and history

Diagnostics is a closed-by-default native disclosure. It retains existing
revision IDs/timestamps, measured embedding dimensions, capability-lane
results, endpoint identity, and masked credential metadata. Retained revisions
are shown in a compact history region (or a count summary when space is tight)
with the existing `Restore` and `Discard` actions. These details do not replace
the primary lifecycle message and do not mutate state merely by opening the
disclosure.

### Compact prototype

Desktop (wide Admin content area):

```text
+-----------------------------------------------------------------------+
| AI Provider                         ACTIVE     AI is active for users |
| OpenAI · generation + embeddings                 [Edit configuration] |
+-----------------------------------------------------------------------+
| 1 Configure                 | 2 Test capabilities | 3 Activate         |
| [Generation card]           | [Run test]          | [Activate]          |
| provider / models / key     | Generation  ✓       | disabled: test first|
|                             | Embeddings  ✓       |                    |
+-----------------------------+---------------------+--------------------+
| Generation                         | Embeddings                       |
| provider · planner · answer         | reuse generation / separate      |
| reasoning · credential              | model + conditional connection   |
+-------------------------------------+---------------------------------+
| Diagnostics (closed)   | History: 3 retained revisions                  |
+-----------------------------------------------------------------------+
```

Mobile (single column, no page-level horizontal scroll):

```text
+----------------------------+
| AI Provider       ACTIVE   |
| AI is active for users     |
| [Edit configuration]       |
+----------------------------+
| 1 Configure                |
| Generation                 |
| Embeddings                 |
+----------------------------+
| 2 Test capabilities        |
| Generation ✓ Embeddings ✓  |
| [Test again]               |
+----------------------------+
| 3 Activate                 |
| [Activate]                 |
+----------------------------+
| Diagnostics (closed)       |
| History: 3 retained        |
+----------------------------+
```

The prototype is illustrative: exact components and spacing should reuse the
existing Admin tokens and primitives.

## Invariants

- Global active configuration remains one atomic revision for generation and
  embeddings.
- Credentials remain server-side encrypted and are never rendered as
  recoverable plaintext.
- Active service continuity during preparation is unchanged.
- Role middleware, endpoint allowlists, capability-test contracts, and
  lifecycle audit behavior are unchanged.

## Risks / Trade-offs

- [A summary can hide editable fields] -> make edit mode explicit and open the
  form by default for unconfigured/draft revisions.
- [A stepper can imply unsupported transitions] -> derive each action from the
  existing mutation eligibility and render its disabled reason inline.
- [History can become another dense card] -> keep it secondary and compact,
  with diagnostics closed by default.

## Migration / Rollback

No migration is required. The UI can be rolled back independently because the
existing API contract and persistence model remain valid. Browser acceptance
verifies the current source-built server state at desktop and narrow widths;
component tests cover the remaining lifecycle states without mutating shared
provider configuration.
