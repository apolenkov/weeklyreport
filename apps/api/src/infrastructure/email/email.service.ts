import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * SMTP email service wrapping nodemailer.
 *
 * When SMTP_HOST is configured, sends real emails via the corporate SMTP server.
 * When SMTP_HOST is absent (local dev), uses jsonTransport and logs the message
 * payload to stdout instead of sending.
 */
@Injectable()
export class EmailService {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly isDev: boolean;

  constructor() {
    this.fromAddress = process.env['SMTP_FROM'] ?? 'noreply@example.com';
    const host = process.env['SMTP_HOST'];

    if (host) {
      this.isDev = false;
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env['SMTP_PORT'] ?? 587),
        secure: false,
        auth: process.env['SMTP_USER']
          ? { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] }
          : undefined,
      });
    } else {
      this.isDev = true;
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }

  /**
   * UFB-048 / Phase 50-A: optional per-call `from` override lets the
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

    if (this.isDev) {
      process.stdout.write(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'email sent (dev/jsonTransport)',
          envelope: { from: fromAddr, to },
          subject,
        }) + '\n',
      );
    }
  }

  /**
   * NOTIF-03 (Phase 28-03): multipart HTML + plaintext send. nodemailer accepts
   * both `html` and `text` simultaneously — corporate spam filters score
   * multipart higher, and clients that don't render HTML still receive the
   * plaintext body. Use this overload for deadline reminders (NOTIF-01) and
   * any future template-rendered email.
   *
   * UFB-048 / Phase 50-A: optional `from` override identical to `sendMail`.
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

    if (this.isDev) {
      process.stdout.write(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'email sent (dev/jsonTransport, multipart)',
          envelope: { from: fromAddr, to },
          subject,
        }) + '\n',
      );
    }
  }
}
