import type { OrganizationBrand } from "@customreport/shared";
import type * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email";

// Per-head late-leads digest; opt-out / timing / dedupe live on the scheduler path.
export interface LateLead {
  readonly leadName: string;
  readonly sectionTitle: string;
  readonly deadlineIso: string;
}

export interface EscalationEmailProps {
  headName: string;
  cycleDate: string; // YYYY-MM-DD UTC
  reportPeriod: string; // human-readable e.g. "2026-04-13 → 2026-04-19"
  lateLeads: readonly LateLead[];
  organization: OrganizationBrand;
}

/**
 * Escalation Email.
 * @param props - The props argument.
 */
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
              Hello {headName}, the following lead
              {lateLeads.length === 1 ? "" : "s"}{" "}
              {lateLeads.length === 1 ? "has" : "have"} not submitted their
              section of the {reportPeriod} weekly report:
            </Text>
            <Section className="my-4">
              <ul className="list-disc pl-6 text-gray-800">
                {lateLeads.map((lead) => (
                  <li
                    key={`${lead.leadName}-${lead.sectionTitle}`}
                    className="my-1"
                  >
                    <strong>{lead.leadName}</strong> — {lead.sectionTitle}{" "}
                    (deadline {lead.deadlineIso})
                  </li>
                ))}
              </ul>
            </Section>
            {/* Brand footer rendered from the `organization` payload
                snapshotted at enqueue time. */}
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

/**
 * Escalation Email Plaintext.
 * @param props - The props argument.
 */
export function escalationEmailPlaintext(props: EscalationEmailProps): string {
  return [
    `Hello ${props.headName},`,
    "",
    `The following lead${props.lateLeads.length === 1 ? "" : "s"} ${props.lateLeads.length === 1 ? "has" : "have"} not submitted their section of the ${props.reportPeriod} weekly report (${props.cycleDate}):`,
    "",
    ...props.lateLeads.map(
      (lead) =>
        `  - ${lead.leadName} — ${lead.sectionTitle} (deadline ${lead.deadlineIso})`,
    ),
    "",
    `— ${props.organization.shortName} (Weekly status reporting for ${props.organization.fullName})`,
  ].join("\n");
}
