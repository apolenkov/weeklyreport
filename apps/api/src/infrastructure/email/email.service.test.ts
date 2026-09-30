import { beforeEach, describe, expect, it, vi } from "vitest";

interface TransportStub {
  sendMail: ReturnType<typeof vi.fn>;
}

type CreateTransportStub = (options: Record<string, unknown>) => TransportStub;

const { createTransportMock, sendMailMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  const createTransportMock = vi.fn<CreateTransportStub>(() => ({
    sendMail: sendMailMock,
  }));
  return { createTransportMock, sendMailMock };
});

vi.mock("@nestjs/common", () => ({
  Injectable: () => (target: unknown) => target,
  Module: () => (target: unknown) => target,
  Inject: () => () => undefined,
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

import type { EnvConfig } from "../config/env.schema.js";
import { EmailService } from "./email.service.js";

const SMTP_HOST = "smtp.example.com";

const createEmailService = (env: Record<string, unknown>): EmailService =>
  new EmailService(env as unknown as EnvConfig);

const transportOptions = (): Record<string, unknown> | undefined =>
  createTransportMock.mock.calls.at(-1)?.[0];

beforeEach(() => {
  createTransportMock.mockClear();
  sendMailMock.mockClear();
});

describe("EmailService transport security", () => {
  it("uses implicit TLS on port 465", () => {
    createEmailService({ SMTP_HOST, SMTP_PORT: 465 });

    expect(transportOptions()).toEqual({
      host: SMTP_HOST,
      port: 465,
      secure: true,
      auth: undefined,
    });
  });

  it("uses STARTTLS mode on port 587", () => {
    createEmailService({ SMTP_HOST, SMTP_PORT: 587 });

    expect(transportOptions()).toEqual({
      host: SMTP_HOST,
      port: 587,
      secure: false,
      auth: undefined,
    });
  });

  it("defaults to STARTTLS mode on port 587", () => {
    createEmailService({ SMTP_HOST });

    expect(transportOptions()).toEqual({
      host: SMTP_HOST,
      port: 587,
      secure: false,
      auth: undefined,
    });
  });

  it("requires TLS when SMTP authentication is configured", () => {
    createEmailService({
      SMTP_HOST,
      SMTP_PORT: 587,
      SMTP_USER: "mailer",
      SMTP_PASS: "test-password",
    });

    expect(transportOptions()).toEqual({
      host: SMTP_HOST,
      port: 587,
      secure: false,
      auth: { user: "mailer", pass: "test-password" },
      requireTLS: true,
    });
  });

  it("omits requireTLS when SMTP authentication is not configured", () => {
    createEmailService({ SMTP_HOST, SMTP_PORT: 587 });

    expect(transportOptions()).not.toHaveProperty("requireTLS");
  });
});

describe("EmailService delivery behavior", () => {
  it("keeps the development transport isolated from SMTP options", () => {
    createEmailService({ SMTP_PORT: 465, SMTP_USER: "mailer" });

    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("keeps sendMail callable when detached", async () => {
    const service = createEmailService({
      SMTP_HOST,
      SMTP_FROM: "sender@example.com",
    });
    const { sendMail } = service;

    await sendMail("recipient@example.com", "Subject", "Body");

    expect(sendMailMock).toHaveBeenCalledWith({
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "Subject",
      text: "Body",
    });
  });

  it.each([
    { from: undefined, expectedFrom: "sender@example.com" },
    { from: null, expectedFrom: "sender@example.com" },
    { from: "override@example.com", expectedFrom: "override@example.com" },
  ])(
    "maps multipart delivery with sender override $from",
    async ({ from, expectedFrom }) => {
      const service = createEmailService({
        SMTP_HOST,
        SMTP_FROM: "sender@example.com",
      });

      await service.sendMailMultipart(
        "recipient@example.com",
        {
          subject: "Multipart subject",
          html: "<p>HTML body</p>",
          text: "Plain text body",
        },
        from,
      );

      expect(sendMailMock).toHaveBeenCalledTimes(1);
      expect(sendMailMock).toHaveBeenCalledWith({
        from: expectedFrom,
        to: "recipient@example.com",
        subject: "Multipart subject",
        html: "<p>HTML body</p>",
        text: "Plain text body",
      });
    },
  );

  it("propagates the multipart SMTP transport rejection", async () => {
    const service = createEmailService({
      SMTP_HOST,
      SMTP_FROM: "sender@example.com",
    });
    const transportError = new Error("Multipart SMTP transport unavailable");
    sendMailMock.mockRejectedValueOnce(transportError);

    await expect(
      service.sendMailMultipart("recipient@example.com", {
        subject: "Multipart subject",
        html: "<p>HTML body</p>",
        text: "Plain text body",
      }),
    ).rejects.toBe(transportError);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("observes one SMTP transport rejection and recovers on the subsequent send", async () => {
    const service = createEmailService({
      SMTP_HOST,
      SMTP_FROM: "sender@example.com",
    });
    const transportError = new Error("SMTP transport unavailable");
    sendMailMock
      .mockRejectedValueOnce(transportError)
      .mockResolvedValueOnce(undefined);

    await expect(
      service.sendMail("first@example.com", "First", "First body"),
    ).rejects.toThrow("SMTP transport unavailable");
    await expect(
      service.sendMail("second@example.com", "Second", "Second body"),
    ).resolves.toBeUndefined();

    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(sendMailMock).toHaveBeenNthCalledWith(1, {
      from: "sender@example.com",
      to: "first@example.com",
      subject: "First",
      text: "First body",
    });
    expect(sendMailMock).toHaveBeenNthCalledWith(2, {
      from: "sender@example.com",
      to: "second@example.com",
      subject: "Second",
      text: "Second body",
    });
  });
});
