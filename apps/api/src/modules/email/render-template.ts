import * as React from 'react';
import { render } from '@react-email/render';

import {
  DeadlineEmail,
  deadlineEmailPlaintext,
  type DeadlineEmailProps,
} from './templates/deadline.template.js';

/**
 * NOTIF-01 (Phase 28-03): central renderer for the email template catalog.
 *
 * Returns `{subject, html, text}`. The processor passes all three to
 * nodemailer so the email is multipart (HTML + plaintext) — corporate
 * spam filters score multipart higher than HTML-only.
 *
 * Phase 29 will add 'follow-up' and 'escalation' kinds. The discriminated
 * union shape below makes that additive without breaking call sites.
 */
export type EmailKind = 'deadline';

export type EmailRenderInput = { kind: 'deadline'; props: DeadlineEmailProps };

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function renderEmail(input: EmailRenderInput): Promise<RenderedEmail> {
  switch (input.kind) {
    case 'deadline': {
      const html = await render(React.createElement(DeadlineEmail, input.props));
      const text = deadlineEmailPlaintext(input.props);
      const subject = `Reminder: ${input.props.reportPeriod} report section due in 24h`;
      return { subject, html, text };
    }
  }
}
