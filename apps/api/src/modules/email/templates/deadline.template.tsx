import type { OrganizationBrand } from "@customreport/shared";
import type * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email";

// Multipart HTML + plaintext; spam filters score multipart over HTML-only.
export interface DeadlineEmailProps {
  leadName: string;
  reportPeriod: string; // e.g. "2026-W17" or "2026-04-13 to 2026-04-19"
  deadlineIso: string;
  sectionUrl: string; // deep link to /lead/report
  organization: OrganizationBrand;
}

const formatDeadline = (iso: string): string =>
  `${new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso))} UTC`;

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
              status report is due by {formatDeadline(deadlineIso)}.
            </Text>
            <Section className="my-6">
              <Button
                href={sectionUrl}
                className="bg-blue-600 text-white px-5 py-3 rounded"
              >
                Open my section
              </Button>
            </Section>
            {/* Brand footer from the `organization` payload snapshotted at
                enqueue time (shortName + fullName). */}
            <Text className="text-sm text-gray-500">
              {organization.shortName} — Weekly status reporting for{" "}
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
    "",
    `This is a reminder that your section of the ${props.reportPeriod} weekly status report is due by ${formatDeadline(props.deadlineIso)}.`,
    "",
    `Open your section: ${props.sectionUrl}`,
    "",
    `— ${props.organization.shortName} (Weekly status reporting for ${props.organization.fullName})`,
  ].join("\n");
}
