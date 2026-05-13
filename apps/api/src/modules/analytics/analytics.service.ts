import {
  trafficLightHistoryInputSchema,
  trafficLightHistoryOutputSchema,
  leadVelocityInputSchema,
  leadVelocityOutputSchema,
  periodComparisonInputSchema,
  periodComparisonOutputSchema,
  type TrafficLightHistoryInput,
  type TrafficLightHistoryOutput,
  type LeadVelocityInput,
  type LeadVelocityOutput,
  type PeriodComparisonInput,
  type PeriodComparisonOutput,
} from "@customreport/shared";

/**
 * AnalyticsRepository contract — Prisma-free at the service boundary so the
 * domain stays test-friendly. The Prisma implementation lives in
 * analytics.prisma-repository.ts.
 */
export interface AnalyticsRepository {
  trafficLightHistory(
    input: TrafficLightHistoryInput,
  ): Promise<TrafficLightHistoryOutput>;
  leadVelocity(input: LeadVelocityInput): Promise<LeadVelocityOutput>;
  periodComparison(
    input: PeriodComparisonInput,
  ): Promise<PeriodComparisonOutput>;
}

/**
 * Cache port — Phase 30-01 wraps Redis behind this minimal interface so unit
 * tests can supply an in-memory fake (the real Redis client is opt-in via
 * AnalyticsCache in analytics.cache.ts).
 */
export interface AnalyticsCachePort {
  getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

// Phase 32-C / M-04: namespace under `customreport:` so analytics keys do not
// collide with other applications sharing the Redis instance. The cache's
// SCAN-based invalidation (analytics.cache.ts) walks the same prefix, so all
// three sub-prefixes must remain on the `customreport:analytics:` root.
const PREFIX_HISTORY = "customreport:analytics:traffic-light:";
const PREFIX_VELOCITY = "customreport:analytics:lead-velocity:";
const PREFIX_COMPARISON = "customreport:analytics:period-comparison:";

/**
 * Stable JSON.stringify with sorted keys so equivalent inputs hit the same
 * cache key regardless of property order in the call site.
 */
function stableHash(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return JSON.stringify(value, keys);
}

export class AnalyticsService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly cache: AnalyticsCachePort,
  ) {}

  async trafficLightHistory(
    input: TrafficLightHistoryInput,
  ): Promise<TrafficLightHistoryOutput> {
    const parsed = trafficLightHistoryInputSchema.parse(input);
    const key = `${PREFIX_HISTORY}${stableHash(parsed)}`;
    const result = await this.cache.getOrCompute(key, () =>
      this.repository.trafficLightHistory(parsed),
    );
    return trafficLightHistoryOutputSchema.parse(result);
  }

  async leadVelocity(input: LeadVelocityInput): Promise<LeadVelocityOutput> {
    const parsed = leadVelocityInputSchema.parse(input);
    const key = `${PREFIX_VELOCITY}${stableHash(parsed)}`;
    const result = await this.cache.getOrCompute(key, () =>
      this.repository.leadVelocity(parsed),
    );
    return leadVelocityOutputSchema.parse(result);
  }

  async periodComparison(
    input: PeriodComparisonInput,
  ): Promise<PeriodComparisonOutput> {
    const parsed = periodComparisonInputSchema.parse(input);
    const key = `${PREFIX_COMPARISON}${stableHash(parsed)}`;
    const result = await this.cache.getOrCompute(key, () =>
      this.repository.periodComparison(parsed),
    );
    return periodComparisonOutputSchema.parse(result);
  }
}
