import { render } from "@react-email/render";
import * as React from "react";

import {
  DeadlineEmail,
  type DeadlineEmailProps,
  deadlineEmailPlaintext,
} from "./templates/deadline.template.js";
import {
  EscalationEmail,
  type EscalationEmailProps,
  escalationEmailPlaintext,
} from "./templates/escalation.template.js";

/**
 * NOTIF-01 (Phase 28-03), NOTIF-02 (Phase 29-05): central renderer for the
 * email template catalog.
 *
 * Returns `{subject, html, text}`. The processor passes all three to
 * nodemailer so the email is multipart (HTML + plaintext) — corporate
 * spam filters score multipart higher than HTML-only.
 */
export type EmailKind = "deadline" | "escalation";

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
      // UFB-047 / Phase 49-01: subject prefixes the org `shortName` so the
      // recipient's inbox folder rules can grep on the brand without
      // parsing the long-form name.
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
