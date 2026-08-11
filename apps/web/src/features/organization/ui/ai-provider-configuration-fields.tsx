import type { AiProviderProfile } from "@customreport/shared";
import type { ReactNode } from "react";

export interface AiProviderFormState {
  profile: AiProviderProfile;
  baseUrl: string;
  plannerModel: string;
  answerModel: string;
  embeddingModel: string;
  credential: string;
}

export const CUSTOM_PROVIDER_PROFILE = "custom-openai-compatible" as const;

const FIELD_CLASS =
  "mt-1.5 h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-foreground)] shadow-xs outline-none transition focus:border-[var(--color-starbucks-accent)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-muted-foreground)]";

type ConfigurationFieldsProps = Readonly<{
  form: AiProviderFormState;
  busy: boolean;
  credentialMaskedSuffix: string | null | undefined;
  onChange: <K extends keyof AiProviderFormState>(
    key: K,
    value: AiProviderFormState[K],
  ) => void;
}>;

function Field({
  label,
  hint,
  children,
}: Readonly<{ label: string; hint?: string; children: ReactNode }>) {
  return (
    <label className="block text-sm font-medium text-[var(--color-foreground)]">
      {label}
      {children}
      {hint && (
        <span className="mt-1 block text-xs leading-5 font-normal text-[var(--color-muted-foreground)]">
          {hint}
        </span>
      )}
    </label>
  );
}

function SectionHeading({
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

function ConnectionFields({ form, busy, onChange }: ConfigurationFieldsProps) {
  const isBuiltIn = form.profile !== CUSTOM_PROVIDER_PROFILE;

  return (
    <section className="space-y-4 border-t border-[var(--color-border)] pt-5">
      <SectionHeading
        eyebrow="01 · Connection"
        title="Choose a provider"
        description="Built-in profiles use their approved endpoint automatically."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Provider profile">
          <select
            aria-label="AI provider profile"
            className={FIELD_CLASS}
            value={form.profile}
            onChange={(event) =>
              onChange("profile", event.target.value as AiProviderProfile)
            }
            disabled={busy}
          >
            <option value="mistral">Mistral</option>
            <option value="openrouter">OpenRouter</option>
            <option value={CUSTOM_PROVIDER_PROFILE}>
              Custom OpenAI-compatible
            </option>
          </select>
        </Field>
        <Field
          label="Endpoint"
          hint={
            isBuiltIn
              ? "Managed by the selected profile."
              : "Only approved OpenAI-compatible endpoints can be used."
          }
        >
          <input
            aria-label="AI provider endpoint"
            className={FIELD_CLASS}
            value={isBuiltIn ? "Selected by profile" : form.baseUrl}
            onChange={(event) => onChange("baseUrl", event.target.value)}
            disabled={busy || isBuiltIn}
            placeholder="https://approved.example.com/v1"
          />
        </Field>
      </div>
    </section>
  );
}

function ModelFields({ form, busy, onChange }: ConfigurationFieldsProps) {
  return (
    <section className="space-y-4">
      <SectionHeading
        eyebrow="02 · Models"
        title="Set the model identifiers"
        description="Use the exact names supplied by your provider."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["plannerModel", "Planner model"],
            ["answerModel", "Answer model"],
            ["embeddingModel", "Embedding model"],
          ] as const
        ).map(([key, label]) => (
          <Field label={label} key={key}>
            <input
              aria-label={label}
              className={FIELD_CLASS}
              value={form[key]}
              onChange={(event) => onChange(key, event.target.value)}
              disabled={busy}
              placeholder="Provider model ID"
            />
          </Field>
        ))}
      </div>
    </section>
  );
}

function AccessFields({
  form,
  busy,
  credentialMaskedSuffix,
  onChange,
}: ConfigurationFieldsProps) {
  return (
    <section className="space-y-4">
      <SectionHeading
        eyebrow="03 · Access"
        title="Add the credential"
        description="It is encrypted before storage and shown only as a masked suffix."
      />
      <div className="max-w-xl">
        <Field label="Provider credential">
          <input
            aria-label="AI provider credential"
            className={FIELD_CLASS}
            type="password"
            value={form.credential}
            onChange={(event) => onChange("credential", event.target.value)}
            disabled={busy}
            placeholder={credentialMaskedSuffix ?? "Paste the provider key"}
            autoComplete="new-password"
          />
        </Field>
      </div>
    </section>
  );
}

export function AiProviderConfigurationFields(props: ConfigurationFieldsProps) {
  return (
    <>
      <ConnectionFields {...props} />
      <ModelFields {...props} />
      <AccessFields {...props} />
    </>
  );
}
