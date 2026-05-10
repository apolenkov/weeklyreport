import * as React from 'react';
import {
  Html,
  Head,
  Preview,
  Tailwind,
  Body,
  Container,
  Heading,
  Text,
  Section,
} from '@react-email/components';

/**
 * NOTIF-02 (Phase 29-05): T+2h escalation digest sent to the head when leads
 * miss the deadline.
 *
 * Reverse shape of the deadline reminder: the deadline reminder fires
 * per-lead at T-24h; the escalation fires per-head at T+2h aggregating ALL
 * late leads into a single email. The dedupe key shape mirrors deadline
 * (`${rule.id}:escalation:${cycleDate}:${recipientEmail}`) so two scheduler
 * ticks within one UTC day collapse to a single email even if Cron
 * misfires.
 *
 * Per CONTEXT.md / NOTIF-05: escalation BYPASSES User.notificationOptOut.
 * Heads must always be notified of late submissions; the opt-out flag only
 * silences kind='deadline' reminders.
 */
export interface LateLead {
  readonly leadName: string;
  readonly sectionTitle: string;
  readonly deadlineIso: string;
}

/**
 * UFB-047 / Phase 49-01: see {@link DeadlineEmailProps.organization} —
 * brand strings now flow through the BullMQ payload instead of being
 * hardcoded in the template.
 */
export interface OrganizationBrand {
  shortName: string;
  fullName: string;
}

export interface EscalationEmailProps {
  headName: string;
  cycleDate: string; // YYYY-MM-DD UTC
  reportPeriod: string; // human-readable e.g. "2026-04-13 → 2026-04-19"
  lateLeads: ReadonlyArray<LateLead>;
  organization: OrganizationBrand;
}

export function EscalationEmail({
  headName,
  cycleDate,
  reportPeriod,
  lateLeads,
  organization,
}: EscalationEmailProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>{`${lateLeads.length} late report section(s) on ${cycleDate}`}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto max-w-xl bg-white p-8 rounded-lg">
            <Heading className="text-xl text-gray-900">
              Late draft sections — {cycleDate}
            </Heading>
            <Text className="text-gray-700">
              Hello {headName}, the following lead{lateLeads.length === 1 ? '' : 's'} have not submitted
              their section of the {reportPeriod} weekly report:
            </Text>
            <Section className="my-4">
              <ul className="list-disc pl-6 text-gray-800">
                {lateLeads.map((lead, index) => (
                  <li key={`${lead.leadName}-${index}`} className="my-1">
                    <strong>{lead.leadName}</strong> — {lead.sectionTitle} (deadline {lead.deadlineIso})
                  </li>
                ))}
              </ul>
            </Section>
            {/* UFB-047 / Phase 49-01: brand footer rendered from the
                `organization` payload snapshotted at enqueue time. */}
            <Text className="text-sm text-gray-500">
              {organization.shortName} — Weekly status reporting for{' '}
              {organization.fullName}.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export function escalationEmailPlaintext(props: EscalationEmailProps): string {
  const lines = [
    `Hello ${props.headName},`,
    '',
    `The following lead${props.lateLeads.length === 1 ? '' : 's'} have not submitted their section of the ${props.reportPeriod} weekly report (${props.cycleDate}):`,
    '',
  ];
  for (const lead of props.lateLeads) {
    lines.push(`  - ${lead.leadName} — ${lead.sectionTitle} (deadline ${lead.deadlineIso})`);
  }
  lines.push(
    '',
    `— ${props.organization.shortName} (Weekly status reporting for ${props.organization.fullName})`,
  );
  return lines.join('\n');
}
