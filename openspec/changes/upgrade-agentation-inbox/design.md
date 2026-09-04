## Context

Agentation's published MCP/API contract provides acknowledge, resolve,
dismiss, reply, edit, and context identifiers, but it does not provide a
ready-made authenticated WeeklyReport admin inbox. The product therefore owns
the workbench around the unpatched Agentation capture component. The existing
server adapter remains the authority for identity, visibility, and mutation.

## Decisions

### `/feedback` is a workbench, not a record dump

Every visible row exposes its current lifecycle state, who submitted it, when
it changed, and the next useful action. Selecting a row opens a detail view
without losing the inbox context. The workbench does not expose an `Open
context` action; recorded page and annotation identifiers remain available in
the detail view.

The detail view separates original content from operational evidence:
annotation target/selector, normalized URL, screenshot/console/network
evidence when present, and append-only thread messages. The original content
is visibly labeled with its author and cannot be rewritten by a reviewer.

### Lifecycle and permissions

The visible lifecycle is:

```text
New -> Acknowledged -> Resolved
                    \-> Dismissed (reason required)
```

The author may edit their own original annotation and reply to its thread while
it is editable under the existing domain rules. An admin/head may acknowledge,
resolve, dismiss, and reply for records in their server-authorized scope. An
admin may additionally delete one visible item from either source after an
explicit confirmation; Agentation keeps its session while stored annotation
events are removed explicitly and annotation/thread children cascade, and
legacy ProductFeedback children cascade. There is no bulk delete. No role may
rewrite a foreign original. Dismiss confirms the
action and requires a short reason; it changes status and appends evidence but
retains the record, thread, and captures.

### Compact prototype

Desktop (inbox + detail):

```text
+--------------------------------------------------------------------------+
| Feedback                         [All v] [Status v]       [Refresh]       |
| 12 open  · 4 acknowledged  · 8 resolved                                 |
+------------------------------+-------------------------------------------+
| OPEN                          | Original annotation                     |
| [NEW] Fix spacing     2m      | [NEW] Fix spacing                       |
| Lead · Report / Overview      | by Anna · Sep 04, 10:42                 |
| [Ack] [Reply] [Dismiss]       | “The card is too dense on mobile.”      |
|------------------------------|-------------------------------------------|
| [ACK] Wrong label     1h      | Evidence                                 |
| Head · Report / Lead          | URL · selector · screenshot · logs       |
| [Resolve] [Delete]           |                                           |
|------------------------------| Thread                                   |
| [DISMISSED] duplicate        | Anna: Can we keep the action visible?   |
| Admin · Settings             | Admin: Yes, moving it to the header.    |
|                              | [Reply…                         ] [Send] |
|                              |                                           |
|                              | [Resolve] [Dismiss…]                     |
+------------------------------+-------------------------------------------+
```

Mobile (single-column detail):

```text
+----------------------------------+
| < Feedback                 [...] |
| [NEW] Fix spacing                |
| Lead · 2m · Report / Overview    |
| “The card is too dense on mobile.”|
| [Reply] [Dismiss]                 |
| Status [New v]                   |
|                                  |
| Evidence                         |
| selector · screenshot · logs     |
|                                  |
| Thread                           |
| [Reply…                    ]     |
| [Send] [Acknowledge]             |
| [Resolve] [Delete]               |
+----------------------------------+
```

The exact visual tokens remain the incumbent WeeklyReport design system. The
prototype changes hierarchy, labels, and actions rather than introducing a
new global style.

## Data and safety

All commands use the existing authenticated adapter and domain predicates.
Status, reply, edit, and dismiss responses are current and non-cacheable.
Dismiss reason and actor are append-only evidence. The UI must surface server
errors without optimistically implying a transition that was rejected.

## Research basis

See `docs/research/agentation-v3-weeklyreport-implementation-2026-09-04.md`:
the official operation matrix recommends prominent acknowledge/resolve,
secondary reply, reasoned dismiss, explicit admin-only single-item deletion,
and a focused inbox-management pass.
