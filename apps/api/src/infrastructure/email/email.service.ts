import { Inject, Injectable } from "@nestjs/common";
import type { SendMailOptions } from "nodemailer";
import nodemailer from "nodemailer";

import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { ENV_CONFIG } from "../config/config.module";
import type { EnvConfig } from "../config/env.schema";

// The no-send dev/test transport has no configured SMTP_FROM; this placeholder
// only labels the envelope in the logged development payload.
const DEV_STREAM_TRANSPORT_FROM = "noreply@example.com";
// nodemailer's conventional submission port when SMTP_PORT is left unset.
const DEFAULT_SMTP_PORT = 587;
// SMTP port reserved for connections that establish TLS immediately.
const IMPLICIT_TLS_SMTP_PORT = 465;
const createMailTransport = nodemailer.createTransport;

interface EmailTransport {
  readonly sendMail: (options: SendMailOptions) => Promise<unknown>;
}

const DEV_TRANSPORT: EmailTransport = {
  sendMail: () => Promise.resolve(undefined),
};

// EMAIL_PORT binds consumers to the interface so tests inject a double without nodemailer.
export interface EmailPort {
  readonly sendMail: (
    to: string,
    subject: string,
    text: string,
    from?: string | null,
  ) => Promise<void>;
  readonly sendMailMultipart: (
    to: string,
    content: MultipartMail,
    from?: string | null,
  ) => Promise<void>;
}

export interface MultipartMail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export const EMAIL_PORT = Symbol("EMAIL_PORT");

// Absent SMTP_HOST uses the no-send development transport; production fails
// closed in env.schema.
@Injectable()
export class EmailService implements EmailPort {
  private readonly transporter: EmailTransport;
  private readonly fromAddress: string;
  private readonly isDev: boolean;

  constructor(
    @Inject(ENV_CONFIG) env: EnvConfig,
    @Inject(APP_LOGGER) private readonly logger: AppLogger,
  ) {
    this.fromAddress = env.SMTP_FROM ?? DEV_STREAM_TRANSPORT_FROM;
    const host = env.SMTP_HOST;

    if (host) {
      this.isDev = false;
      // env.schema guarantees the pair is all-or-none; the pass check keeps
      // the types honest for callers that bypass env validation.
      const auth =
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined;
      this.transporter = createMailTransport({
        host,
        port: env.SMTP_PORT ?? DEFAULT_SMTP_PORT,
        secure: (env.SMTP_PORT ?? DEFAULT_SMTP_PORT) === IMPLICIT_TLS_SMTP_PORT,
        auth,
        ...(auth ? { requireTLS: true } : {}),
      });
    } else {
      this.isDev = true;
      this.transporter = DEV_TRANSPORT;
    }
  }

  // Per-call `from` lets the reminder processor pass AppSettings.notificationFromEmail
  // without mutating service state.
  readonly sendMail = async (
    to: string,
    subject: string,
    text: string,
    from?: string | null,
  ): Promise<void> => {
    const fromAddr = from ?? this.fromAddress;
    await this.transporter.sendMail({
      from: fromAddr,
      to,
      subject,
      text,
    });

    this.logDevDelivery("email sent (dev/streamTransport)", fromAddr, to);
  };

  // Multipart (html+text) scores higher with corporate spam filters;
  // text-only clients still get the body.
  readonly sendMailMultipart = async (
    to: string,
    { subject, html, text }: MultipartMail,
    from?: string | null,
  ): Promise<void> => {
    const fromAddr = from ?? this.fromAddress;
    await this.transporter.sendMail({
      from: fromAddr,
      to,
      subject,
      html,
      text,
    });

    this.logDevDelivery(
      "email sent (dev/streamTransport, multipart)",
      fromAddr,
      to,
    );
  };

  // Dev no-send diagnostics go through the shared logger so LOG_LEVEL gates
  // them and the redaction layer sees the envelope. `recipientEmail` is the
  // known PII key — the marker, not the address, reaches sinks. Subject/body
  // are deliberately not logged.
  private logDevDelivery(message: string, from: string, to: string): void {
    if (!this.isDev) return;
    this.logger.info(message, { from, recipientEmail: to });
  }
}
