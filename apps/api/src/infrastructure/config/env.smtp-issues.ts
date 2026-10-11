import type { z } from "zod";

// Structural view of the SMTP fields the refinements read; keeps this module
// free of an import back into env.schema.ts.
interface SmtpEnv {
  SMTP_HOST?: string | undefined;
  SMTP_PORT?: number | undefined;
  SMTP_USER?: string | undefined;
  SMTP_PASS?: string | undefined;
  SMTP_FROM?: string | undefined;
}

// SMTP must be configured in production: without a host EmailService uses the
// no-send development transport, and without a from-address it cannot address
// an envelope. A whitespace-only value counts as absent.
const SMTP_PRODUCTION_KEYS = ["SMTP_HOST", "SMTP_FROM"] as const;

export const addMissingSmtpIssues = (
  data: SmtpEnv,
  ctx: z.RefinementCtx,
): void => {
  SMTP_PRODUCTION_KEYS.filter((key) => !data[key]?.trim()).forEach((key) => {
    ctx.addIssue({
      code: "custom",
      message: `${key} is required when NODE_ENV=production`,
      path: [key],
    });
  });
};

export const addMissingSmtpPortIssue = (
  data: SmtpEnv,
  ctx: z.RefinementCtx,
): void => {
  if (data.SMTP_PORT !== undefined) return;
  ctx.addIssue({
    code: "custom",
    message: "SMTP_PORT is required when NODE_ENV=production",
    path: ["SMTP_PORT"],
  });
};

// SMTP auth is an all-or-none pair in every environment: a user without its
// password surfaces only as a late send failure, and a password without a
// user is silently ignored. Whitespace counts as absent; the secret bytes of
// a configured password are never trimmed.
export const addSmtpAuthPairIssue = (
  data: SmtpEnv,
  ctx: z.RefinementCtx,
): void => {
  const userConfigured = Boolean(data.SMTP_USER?.trim());
  const passConfigured = Boolean(data.SMTP_PASS?.trim());
  if (userConfigured === passConfigured) return;
  ctx.addIssue({
    code: "custom",
    message: "SMTP_USER and SMTP_PASS must be configured together",
    path: [userConfigured ? "SMTP_PASS" : "SMTP_USER"],
  });
};
