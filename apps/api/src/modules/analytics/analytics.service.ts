import {
  type LeadVelocityInput,
  leadVelocityInputSchema,
  type LeadVelocityOutput,
  leadVelocityOutputSchema,
  type PeriodComparisonInput,
  periodComparisonInputSchema,
  type PeriodComparisonOutput,
  periodComparisonOutputSchema,
  type TrafficLightHistoryInput,
  trafficLightHistoryInputSchema,
  type TrafficLightHistoryOutput,
  trafficLightHistoryOutputSchema,
  type UserSession,
} from "@customreport/shared";

import { scopeDiscriminator } from "../../lib/group-scope.js";

// Every read takes session — sections span groups, so queries must bind group scope.
export interface AnalyticsRepository {
  trafficLightHistory(
    input: TrafficLightHistoryInput,
    session: UserSession,
  ): Promise<TrafficLightHistoryOutput>;
  leadVelocity(
    input: LeadVelocityInput,
    session: UserSession,
  ): Promise<LeadVelocityOutput>;
  periodComparison(
    input: PeriodComparisonInput,
    session: UserSession,
  ): Promise<PeriodComparisonOutput>;
}

export interface AnalyticsCachePort {
  getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

// Under customreport:analytics: so SCAN invalidation reaches all three.
// v2 under that root orphans stale pre-bump entries without breaking invalidateAll.
const PREFIX_HISTORY = "customreport:analytics:traffic-light:v2:";
const PREFIX_VELOCITY = "customreport:analytics:lead-velocity:v2:";
const PREFIX_COMPARISON = "customreport:analytics:period-comparison:v2:";

// Sort keys at every nesting depth — JSON.stringify key whitelist would drop nested keys.
export function stableHash(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableHash).join(",")}]`;
  return stableHashObject(value as Record<string, unknown>);
}

function stableHashObject(record: Record<string, unknown>): string {
  const entries = Object.keys(record)
    // eslint-disable-next-line sonarjs/no-alphabetical-sort -- stable cache-key hashing; localeCompare would break determinism across locales
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableHash(record[key])}`);
  return `{${entries.join(",")}}`;
}

export class AnalyticsService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly cache: AnalyticsCachePort,
  ) {}

  async trafficLightHistory(
    input: TrafficLightHistoryInput,
    session: UserSession,
  ): Promise<TrafficLightHistoryOutput> {
    const parsed = trafficLightHistoryInputSchema.parse(input);
    const key = `${PREFIX_HISTORY}${scopeDiscriminator(session)}:${stableHash(parsed)}`;
    const result = await this.cache.getOrCompute(key, () =>
      this.repository.trafficLightHistory(parsed, session),
    );
    return trafficLightHistoryOutputSchema.parse(result);
  }

  async leadVelocity(
    input: LeadVelocityInput,
    session: UserSession,
  ): Promise<LeadVelocityOutput> {
    const parsed = leadVelocityInputSchema.parse(input);
    const key = `${PREFIX_VELOCITY}${scopeDiscriminator(session)}:${stableHash(parsed)}`;
    const result = await this.cache.getOrCompute(key, () =>
      this.repository.leadVelocity(parsed, session),
    );
    return leadVelocityOutputSchema.parse(result);
  }

  async periodComparison(
    input: PeriodComparisonInput,
    session: UserSession,
  ): Promise<PeriodComparisonOutput> {
    const parsed = periodComparisonInputSchema.parse(input);
    const key = `${PREFIX_COMPARISON}${scopeDiscriminator(session)}:${stableHash(parsed)}`;
    const result = await this.cache.getOrCompute(key, () =>
      this.repository.periodComparison(parsed, session),
    );
    return periodComparisonOutputSchema.parse(result);
  }
}
