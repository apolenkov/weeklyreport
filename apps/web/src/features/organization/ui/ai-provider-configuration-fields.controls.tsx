import type {
  AiProviderConnectionRole,
  AiProviderProfile,
} from "@customreport/shared";
import type { ReactNode } from "react";

import { CUSTOM_PROVIDER_PROFILE } from "./ai-provider-configuration-fields.types";

export const FIELD_CLASS =
  "mt-1.5 h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-foreground)] shadow-xs outline-none transition focus:border-[var(--color-starbucks-accent)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-muted-foreground)]";

export function Field({
  label,
  hint,
  children,
}: Readonly<{ label: string; hint?: string; children: ReactNode }>) {
  return (
    <label className="block text-sm font-medium text-[var(--color-foreground)]">
      {label}
      {children}
      {hint && (
        <span className="mt-1 block text-xs leading-4 font-normal text-[var(--color-muted-foreground)]">
          {hint}
        </span>
      )}
    </label>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: Readonly<{ eyebrow: string; title: string; description: string }>) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.12em] text-[var(--color-starbucks-accent)] uppercase">
        {eyebrow}
      </p>
      <h4 className="mt-1 text-sm font-semibold text-[var(--color-foreground)]">
        {title}
      </h4>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        {description}
      </p>
    </div>
  );
}

const profileLabel = (profile: AiProviderProfile): string => {
  if (profile === CUSTOM_PROVIDER_PROFILE) return "Custom OpenAI-compatible";
  return profile === "openrouter"
    ? "OpenRouter"
    : profile.charAt(0).toUpperCase() + profile.slice(1);
};

export function ProfileField({
  connectionRole,
  value,
  profiles,
  busy,
  onChange,
}: Readonly<{
  connectionRole: AiProviderConnectionRole;
  value: AiProviderProfile;
  profiles: readonly AiProviderProfile[];
  busy: boolean;
  onChange: (value: AiProviderProfile) => void;
}>) {
  return (
    <Field label="Provider">
      <select
        name={`${connectionRole}.profile`}
        aria-label={`${connectionRole === "generation" ? "Generation" : "Embeddings"} provider profile`}
        className={FIELD_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value as AiProviderProfile)}
        disabled={busy}
      >
        {profiles.map((profile) => (
          <option key={profile} value={profile}>
            {profileLabel(profile)}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function EndpointField({
  connectionRole,
  baseUrl,
  busy,
  onChange,
}: Readonly<{
  connectionRole: AiProviderConnectionRole;
  baseUrl: string;
  busy: boolean;
  onChange: (value: string) => void;
}>) {
  const accessibleLabel =
    connectionRole === "generation"
      ? "Generation endpoint"
      : "Embeddings endpoint";
  return (
    <Field label="Endpoint">
      <input
        name={`${connectionRole}.baseUrl`}
        type="url"
        aria-label={accessibleLabel}
        className={FIELD_CLASS}
        value={baseUrl}
        onChange={(event) => onChange(event.target.value)}
        disabled={busy}
        placeholder="https://approved.example.com/v1"
      />
    </Field>
  );
}

export function CredentialField({
  label,
  value,
  maskedSuffix,
  busy,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  maskedSuffix: string | null | undefined;
  busy: boolean;
  onChange: (value: string) => void;
}>) {
  return (
    <Field
      label={label}
      hint={
        maskedSuffix
          ? "Leave blank to keep the saved credential."
          : "Encrypted at rest; only a masked suffix is shown."
      }
    >
      <input
        name={label.toLowerCase().replaceAll(" ", "-")}
        aria-label={label}
        className={FIELD_CLASS}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={busy}
        placeholder={maskedSuffix ?? "Paste the provider key"}
        autoComplete="new-password"
      />
    </Field>
  );
}
