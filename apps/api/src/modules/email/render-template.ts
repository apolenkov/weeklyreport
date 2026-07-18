import * as React from "react";
import { render } from "react-email";

import {
  DeadlineEmail,
  deadlineEmailPlaintext,
  type DeadlineEmailProps,
} from "./templates/deadline.template.js";
import {
  EscalationEmail,
  escalationEmailPlaintext,
  type EscalationEmailProps,
} from "./templates/escalation.template.js";

/**
 * Central renderer for the email template catalog.
 *
 * Returns `{subject, html, text}`. The processor passes all three to
 * nodemailer so the email is multipart (HTML + plaintext) — corporate
 * spam filters score multipart higher than HTML-only.
 */
export type EmailRenderInput =
  | { kind: "deadline"; props: DeadlineEmailProps }
  | { kind: "escalation"; props: EscalationEmailProps };

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderEmail(
  input: EmailRenderInput,
): Promise<RenderedEmail> {
  switch (input.kind) {
    case "deadline": {
      const html = await render(
        React.createElement(DeadlineEmail, input.props),
      );
      const text = deadlineEmailPlaintext(input.props);
      // Subject prefixes the org `shortName` so the recipient's inbox folder
      // rules can grep on the brand without parsing the long-form name.
      const subject = `[${input.props.organization.shortName}] Reminder: ${input.props.reportPeriod} report section due in 24h`;
      return { subject, html, text };
    }
    case "escalation": {
      const html = await render(
        React.createElement(EscalationEmail, input.props),
      );
      const text = escalationEmailPlaintext(input.props);
      const lateCount = input.props.lateLeads.length;
      const subject = `[${input.props.organization.shortName}] Action required: ${lateCount} late report section${lateCount === 1 ? "" : "s"} (${input.props.cycleDate})`;
      return { subject, html, text };
    }
  }
}
