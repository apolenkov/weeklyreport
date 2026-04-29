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

  async sendMail(to: string, subject: string, text: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
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
          envelope: { from: this.fromAddress, to },
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
   */
  async sendMailMultipart(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
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
          envelope: { from: this.fromAddress, to },
          subject,
        }) + '\n',
      );
    }
  }
}
