## MODIFIED Requirements

### Requirement: The dashboard surfaces the pending reopen count

The head dashboard MUST surface pending reopen requests through a SINGLE
consolidated surface — the Reopen Requests card
(`apps/web/src/components/dashboard/reopen-requests-card.tsx`) — and MUST NOT also
duplicate the pending reopen count as a separate indicator in the pending-lead
alert bar (`apps/web/src/components/dashboard/alert-bar.tsx`). Live walkthrough
2026-07-02 (head HF6) found the alert bar's reopen line and the card's header
count state the same thing twice. The pending reopen count and its queue MUST
live only on the Reopen Requests card, whose header already shows the "N pending"
count; the alert bar's outstanding signals MUST be limited to lead-submission
signals (missing/late leads and the reminder action). The Reopen Requests card
MUST render whenever at least one reopen request is pending — even when every lead
has submitted — and MUST render nothing when the queue is empty. The alert bar
MUST self-suppress when there are no missing lead submissions, independent of the
reopen queue. This reverses the earlier `reopen-request-lifecycle` (D3) decision
that made the alert bar carry the reopen indicator.

#### Scenario: Reopen requests show with zero missing leads

- **WHEN** a head opens the dashboard with every lead submitted but two pending
  reopen requests
- **THEN** the Reopen Requests card renders and shows its "2 pending" count and
  the approve/reject queue
- **AND** the pending-lead alert bar renders nothing (no duplicate reopen
  indicator)

#### Scenario: The reopen count is not duplicated in the alert bar

- **WHEN** the dashboard renders with pending reopen requests and one or more
  missing leads
- **THEN** the alert bar shows only the missing-lead signal and the reminder
  action, with no reopen-count line
- **AND** the pending reopen count and queue appear only on the Reopen Requests
  card

#### Scenario: Nothing outstanding hides both surfaces

- **WHEN** a head opens the dashboard with no missing leads and no pending reopen
  requests
- **THEN** the pending-lead alert bar renders nothing
- **AND** the Reopen Requests card renders nothing
