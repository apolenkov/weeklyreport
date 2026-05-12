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
  Button,
  Section,
} from '@react-email/components';

/**
 * NOTIF-01/03 (Phase 28-03): T-24h deadline reminder email.
 *
 * react-email + <Tailwind> per CONTEXT.md decision lock (MJML rejected).
 * Renders to HTML via @react-email/render; the matching plaintext fallback
 * lives next to the component so multipart emails carry both halves —
 * corporate spam filters score multipart > HTML-only.
 */
/**
 * UFB-047 / Phase 49-01: brand identity threaded into the template props.
 * The BullMQ enqueue path snapshots `OrganizationService.getPublic()` into
 * the job data, so the worker re-renders with whatever the org row said at
 * enqueue time (immune to mid-flight admin edits of the brand strings).
 */
export interface OrganizationBrand {
  shortName: string;
  fullName: string;
}

export interface DeadlineEmailProps {
  leadName: string;
  reportPeriod: string; // human-readable e.g. "2026-W17" or "2026-04-13 to 2026-04-19"
  deadlineIso: string; // ISO datetime
  sectionUrl: string; // deep link to /lead/report
  organization: OrganizationBrand;
}

export function DeadlineEmail({
  leadName,
  reportPeriod,
  deadlineIso,
  sectionUrl,
  organization,
}: DeadlineEmailProps): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>Your weekly status report section is due in 24 hours</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto max-w-xl bg-white p-8 rounded-lg">
            <Heading className="text-xl text-gray-900">
              Hi {leadName}, your section is due in 24 hours
            </Heading>
            <Text className="text-gray-700">
              This is a reminder that your section of the {reportPeriod} weekly
              status report is due by {deadlineIso}.
            </Text>
            <Section className="my-6">
              <Button
                href={sectionUrl}
                className="bg-blue-600 text-white px-5 py-3 rounded"
              >
                Open my section
              </Button>
            </Section>
            {/* UFB-047 / Phase 49-01: brand footer rendered from the
                `organization` payload snapshotted at enqueue time. Subject
                uses `shortName` (compact); footer uses `fullName` (long). */}
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

export function deadlineEmailPlaintext(props: DeadlineEmailProps): string {
  return [
    `Hi ${props.leadName},`,
    '',
    `This is a reminder that your section of the ${props.reportPeriod} weekly status report is due by ${props.deadlineIso}.`,
    '',
    `Open your section: ${props.sectionUrl}`,
    '',
    `— ${props.organization.shortName} (Weekly status reporting for ${props.organization.fullName})`,
  ].join('\n');
}
