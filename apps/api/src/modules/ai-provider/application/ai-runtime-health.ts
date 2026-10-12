import type { AiProviderControlRead } from "@weeklyreport/shared";

export const AI_RUNTIME_HEALTH = Symbol("AiRuntimeHealth");

export type AiRuntimeFailure = NonNullable<
  AiProviderControlRead["runtimeFailure"]
>;

/** Best-effort memory of the latest request-path failure; never throws. */
export interface AiRuntimeHealth {
  recordFailure(
    outcome: AiRuntimeFailure["outcome"],
    occurredAt?: Date,
  ): Promise<void>;
  recordSuccess(): Promise<void>;
  lastFailure(): Promise<AiRuntimeFailure | null>;
}
