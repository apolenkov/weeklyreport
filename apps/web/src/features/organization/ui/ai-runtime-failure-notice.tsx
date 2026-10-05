import type { AiProviderControlRead } from "@customreport/shared";

type RuntimeFailure = NonNullable<AiProviderControlRead["runtimeFailure"]>;

const GUIDANCE: Record<RuntimeFailure["outcome"], string> = {
  provider_unavailable:
    "Report chat did not get a timely answer from the AI provider. Check its endpoint, credentials and network.",
  provider_response_incomplete:
    "The AI provider cut report chat answers short. Turn its reasoning off or lower it in the provider configuration.",
};

/** Explains a request-time provider failure that capability tests missed. */
export function AiRuntimeFailureNotice({
  provider,
}: Readonly<{ provider: AiProviderControlRead | undefined }>) {
  const failure = provider?.runtimeFailure;
  if (!failure) return null;
  const time = new Date(failure.occurredAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <p
      role="alert"
      className="text-sm text-[var(--color-destructive)]"
      data-testid="ai-runtime-failure"
    >
      {GUIDANCE[failure.outcome]} Last failure {time}.
    </p>
  );
}
