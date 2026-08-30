// No `server-only`: next.config.ts loads this at Node config time and client
// components load it in the browser. Full literals + lazy parse are mandatory
// (openspec/specs/web-env-validation, "A typed accessor is the single seam").

import { z } from "zod";

const emptyToUndefined = (value: unknown): unknown =>
  value === "" ? undefined : value;

// Shared by the four product boolean toggles: only "true"/"false"/unset so a typo is
// rejected at build rather than silently read as "off". Empty string coerces
// to unset so both parse sites treat absence uniformly.
const optionalToggle = z.preprocess(
  emptyToUndefined,
  z.enum(["true", "false"]).optional(),
);

export const webEnvSchema = z.object({
  NEXT_PUBLIC_APP_VERSION: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
  NEXT_PUBLIC_AUTH_STUB: optionalToggle,
  NEXT_PUBLIC_CLIENT_LOG_FORWARDING: optionalToggle,
  NEXT_PUBLIC_DEV_ROLE_SWITCHER: optionalToggle,
  NEXT_PUBLIC_SENTRY_DSN: z.preprocess(emptyToUndefined, z.url().optional()),
  NEXT_PUBLIC_WEB_VITALS: optionalToggle,
});

// Full literals only — Next string-replaces each occurrence at build so the
// parsed object holds the inlined values in the browser.
const rawWebEnv = (): Record<string, string | undefined> => ({
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_AUTH_STUB: process.env.NEXT_PUBLIC_AUTH_STUB,
  NEXT_PUBLIC_CLIENT_LOG_FORWARDING:
    process.env.NEXT_PUBLIC_CLIENT_LOG_FORWARDING,
  NEXT_PUBLIC_DEV_ROLE_SWITCHER: process.env.NEXT_PUBLIC_DEV_ROLE_SWITCHER,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_WEB_VITALS: process.env.NEXT_PUBLIC_WEB_VITALS,
});

const readWebEnv = (): z.infer<typeof webEnvSchema> =>
  webEnvSchema.parse(rawWebEnv());

const isTrue = (value: string | undefined): boolean => value === "true";

const isProduction = (): boolean => process.env.NODE_ENV === "production";

// The single client-env read seam. Each getter parses lazily; the two dev
// toggles fold `NODE_ENV !== "production"` so a production build never renders
// the auth stub or the dev role switcher even if the var is left "true".
export const webEnv = {
  authStub: (): boolean =>
    isTrue(readWebEnv().NEXT_PUBLIC_AUTH_STUB) && !isProduction(),
  devRoleSwitcher: (): boolean =>
    isTrue(readWebEnv().NEXT_PUBLIC_DEV_ROLE_SWITCHER) && !isProduction(),
  clientLogForwarding: (): boolean =>
    isTrue(readWebEnv().NEXT_PUBLIC_CLIENT_LOG_FORWARDING),
  webVitals: (): boolean => isTrue(readWebEnv().NEXT_PUBLIC_WEB_VITALS),
  appVersion: (): string | undefined => readWebEnv().NEXT_PUBLIC_APP_VERSION,
  sentryDsn: (): string | undefined => readWebEnv().NEXT_PUBLIC_SENTRY_DSN,
} as const;

// Build-time gate (called from next.config.ts): fails `next build` loud on a
// present-but-malformed value, naming the offending variable. All seven vars are
// optional, so absence passes — only a malformed value rejects the build.
export function assertWebEnv(): void {
  const result = webEnvSchema.safeParse(rawWebEnv());
  if (!result.success) {
    throw new Error(
      `Invalid NEXT_PUBLIC_* client env:\n${z.prettifyError(result.error)}`,
    );
  }
}
