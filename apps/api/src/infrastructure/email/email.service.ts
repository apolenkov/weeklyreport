import { Inject, Injectable } from "@nestjs/common";
import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";

import { ENV_CONFIG } from "../config/config.module";
import type { EnvConfig } from "../config/env.schema";

// Dev/test jsonTransport has no configured SMTP_FROM; this placeholder only
// labels the envelope in the logged dev payload (jsonTransport never sends).
const DEV_JSON_TRANSPORT_FROM = "noreply@example.com";
// nodemailer's conventional submission port when SMTP_PORT is left unset.
const DEFAULT_SMTP_PORT = 587;
// SMTP port reserved for connections that establish TLS immediately.
const IMPLICIT_TLS_SMTP_PORT = 465;

/**
 * The email-sending seam its consumers (the email-reminder worker) depend on.
 * `EmailService` is the sole SMTP adapter; a test double implements the same
 * two methods without touching nodemailer. `EMAIL_PORT` binds the port to the
 * adapter at the DI boundary so consumers inject the interface, not the class.
 */
export interface EmailPort {
  sendMail(
    to: string,
    subject: string,
    text: string,
    from?: string | null,
  ): Promise<void>;
  sendMailMultipart(
    to: string,
    subject: string,
    html: string,
    text: string,
    from?: string | null,
  ): Promise<void>;
}

export const EMAIL_PORT = Symbol("EMAIL_PORT");

/**
 * SMTP email service wrapping nodemailer.
 *
 * When SMTP_HOST is configured, sends real emails via the corporate SMTP server.
 * When SMTP_HOST is absent (local dev), uses jsonTransport and logs the message
 * payload to stdout instead of sending. All SMTP coordinates come from the
 * injected validated config — a production boot without SMTP fails closed in
 * env.schema, so jsonTransport can never be selected in production.
 */
@Injectable()
export class EmailService implements EmailPort {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly isDev: boolean;

  constructor(@Inject(ENV_CONFIG) env: EnvConfig) {
    this.fromAddress = env.SMTP_FROM ?? DEV_JSON_TRANSPORT_FROM;
    const host = env.SMTP_HOST;

    if (host) {
      this.isDev = false;
      const auth = env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined;
      this.transporter = nodemailer.createTransport({
        host,
        port: env.SMTP_PORT ?? DEFAULT_SMTP_PORT,
        secure: (env.SMTP_PORT ?? DEFAULT_SMTP_PORT) === IMPLICIT_TLS_SMTP_PORT,
        auth,
        ...(auth ? { requireTLS: true } : {}),
      });
    } else {
      this.isDev = true;
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- jsonTransport is an in-memory dev transport (no network protocol); false positive
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }

  /**
   * Optional per-call `from` override lets the
   * reminder processor pass `AppSettings.notificationFromEmail` without
   * mutating shared service state. Null/undefined falls back to the
   * env-configured `SMTP_FROM` value resolved in the constructor.
   */
  async sendMail(
    to: string,
    subject: string,
    text: string,
    from?: string | null,
  ): Promise<void> {
    const fromAddr = from ?? this.fromAddress;
    await this.transporter.sendMail({
      from: fromAddr,
      to,
      subject,
      text,
    });

    this.logDevDelivery(
      "email sent (dev/jsonTransport)",
      fromAddr,
      to,
      subject,
    );
  }

  /**
   * Multipart HTML + plaintext send. nodemailer accepts
   * both `html` and `text` simultaneously — corporate spam filters score
   * multipart higher, and clients that don't render HTML still receive the
   * plaintext body. Use this overload for deadline reminders and
   * any future template-rendered email.
   *
   * Optional `from` override identical to `sendMail`.
   */
  async sendMailMultipart(
    to: string,
    subject: string,
    html: string,
    text: string,
    from?: string | null,
  ): Promise<void> {
    const fromAddr = from ?? this.fromAddress;
    await this.transporter.sendMail({
      from: fromAddr,
      to,
      subject,
      html,
      text,
    });

    this.logDevDelivery(
      "email sent (dev/jsonTransport, multipart)",
      fromAddr,
      to,
      subject,
    );
  }

  private logDevDelivery(
    message: string,
    from: string,
    to: string,
    subject: string,
  ): void {
    if (!this.isDev) return;
    process.stdout.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        message,
        envelope: { from, to },
        subject,
      })}\n`,
    );
  }
}
