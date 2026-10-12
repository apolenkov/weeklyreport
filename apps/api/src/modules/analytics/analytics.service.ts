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
} from "@weeklyreport/shared";

import { scopeDiscriminator } from "../../lib/group-scope.js";

// Every read takes session — sections span groups, so queries must bind group scope.
export interface AnalyticsRepository {
  readonly trafficLightHistory: (
    input: TrafficLightHistoryInput,
    session: UserSession,
  ) => Promise<TrafficLightHistoryOutput>;
  readonly leadVelocity: (
    input: LeadVelocityInput,
    session: UserSession,
  ) => Promise<LeadVelocityOutput>;
  readonly periodComparison: (
    input: PeriodComparisonInput,
    session: UserSession,
  ) => Promise<PeriodComparisonOutput>;
}

export interface AnalyticsCachePort {
  readonly getOrCompute: <T>(
    key: string,
    fn: () => Promise<T>,
    validate?: (value: unknown) => value is T,
  ) => Promise<T>;
}

// Under weeklyreport:analytics: so SCAN invalidation reaches all three.
// v2 under that root orphans stale pre-bump entries without breaking invalidateAll.
const PREFIX_HISTORY = "weeklyreport:analytics:traffic-light:v2:";
const PREFIX_VELOCITY = "weeklyreport:analytics:lead-velocity:v2:";
const PREFIX_COMPARISON = "weeklyreport:analytics:period-comparison:v2:";

// Sort keys at every nesting depth — JSON.stringify key whitelist would drop nested keys.
export function stableHash(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableHash).join(",")}]`;
  return stableHashObject(value as Record<string, unknown>);
}

function stableHashObject(record: Record<string, unknown>): string {
  // Default code-unit sort spelled as a comparator — deterministic across
  // locales (localeCompare is not), which stable cache-key hashing requires.
  const entries = Object.keys(record)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
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
    const result = await this.cache.getOrCompute(
      key,
      () => this.repository.trafficLightHistory(parsed, session),
      (value): value is TrafficLightHistoryOutput =>
        trafficLightHistoryOutputSchema.safeParse(value).success,
    );
    return trafficLightHistoryOutputSchema.parse(result);
  }

  async leadVelocity(
    input: LeadVelocityInput,
    session: UserSession,
  ): Promise<LeadVelocityOutput> {
    const parsed = leadVelocityInputSchema.parse(input);
    const key = `${PREFIX_VELOCITY}${scopeDiscriminator(session)}:${stableHash(parsed)}`;
    const result = await this.cache.getOrCompute(
      key,
      () => this.repository.leadVelocity(parsed, session),
      (value): value is LeadVelocityOutput =>
        leadVelocityOutputSchema.safeParse(value).success,
    );
    return leadVelocityOutputSchema.parse(result);
  }

  async periodComparison(
    input: PeriodComparisonInput,
    session: UserSession,
  ): Promise<PeriodComparisonOutput> {
    const parsed = periodComparisonInputSchema.parse(input);
    const key = `${PREFIX_COMPARISON}${scopeDiscriminator(session)}:${stableHash(parsed)}`;
    const result = await this.cache.getOrCompute(
      key,
      () => this.repository.periodComparison(parsed, session),
      (value): value is PeriodComparisonOutput =>
        periodComparisonOutputSchema.safeParse(value).success,
    );
    return periodComparisonOutputSchema.parse(result);
  }
}
