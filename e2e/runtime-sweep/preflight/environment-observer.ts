import path from "node:path";

import type { AiDriverReport } from "../driver/driver-results-contract.ts";
import type { TranscriptToolRecord } from "../driver/driver-results-transcript.ts";
import {
  correlateEnvironmentFeedback,
  type EnvironmentFeedback,
  type EnvironmentFeedbackDocument,
} from "./environment-feedback.ts";
import { apiLogChannel } from "./environment-observer-api-log.ts";
import { driverChannel } from "./environment-observer-events.ts";
import {
  type LokiProbeConfig,
  probeLokiChannel,
} from "./environment-observer-probes.ts";
import {
  type BugsinkProbeConfig,
  probeBugsinkChannel,
} from "./observability/environment-observer-bugsink.ts";

export type { LokiProbeConfig } from "./environment-observer-probes.ts";
export type { BugsinkProbeConfig } from "./observability/environment-observer-bugsink.ts";

const NETWORK_KIND = "network" as const;

export interface EnvironmentObserverInput {
  readonly report: AiDriverReport;
  readonly transcriptRecords: readonly TranscriptToolRecord[];
  readonly transcriptEvidenceRef?: string;
  readonly apiLogPath?: string;
  readonly apiLogText?: string;
  readonly apiLogEvidenceRef?: string;
  readonly bugsink?: BugsinkProbeConfig;
  readonly loki?: LokiProbeConfig;
  readonly fetcher?: typeof fetch;
}

export type EnvironmentObserverConfig = Omit<
  EnvironmentObserverInput,
  | "report"
  | "transcriptRecords"
  | "transcriptEvidenceRef"
  | "apiLogText"
  | "apiLogEvidenceRef"
  | "fetcher"
>;

const envValue = (name: string): string | undefined =>
  process.env[name]?.trim();

export function readEnvironmentObserverConfig(
  repoRoot: string,
): EnvironmentObserverConfig {
  const apiLogPath = envValue("RUNTIME_SWEEP_API_LOG");
  const bugsinkDsn = envValue("RUNTIME_SWEEP_BUGSINK_DSN");
  const bugsinkApiToken = envValue("RUNTIME_SWEEP_BUGSINK_API_TOKEN");
  const pushUrl = envValue("RUNTIME_SWEEP_LOKI_PUSH_URL");
  const queryUrl = envValue("RUNTIME_SWEEP_LOKI_QUERY_URL");
  const username = envValue("RUNTIME_SWEEP_LOKI_USERNAME");
  const password = process.env.RUNTIME_SWEEP_LOKI_PASSWORD;
  return {
    ...(apiLogPath ? { apiLogPath: path.resolve(repoRoot, apiLogPath) } : {}),
    ...(bugsinkDsn || bugsinkApiToken
      ? {
          bugsink: {
            ...(bugsinkDsn ? { dsn: bugsinkDsn } : {}),
            ...(bugsinkApiToken ? { apiToken: bugsinkApiToken } : {}),
          },
        }
      : {}),
    loki: {
      ...(pushUrl ? { pushUrl } : {}),
      ...(queryUrl ? { queryUrl } : {}),
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
    },
  };
}

export async function observeEnvironmentFeedback(
  input: EnvironmentObserverInput,
): Promise<EnvironmentFeedback> {
  const fetcher = input.fetcher ?? fetch;
  const document: EnvironmentFeedbackDocument = {
    canary: input.report.canary,
    channels: await Promise.all([
      driverChannel(
        input.report,
        "browser-console",
        "console",
        "browser_console_messages",
        input.transcriptRecords,
        input.transcriptEvidenceRef,
      ),
      driverChannel(
        input.report,
        NETWORK_KIND,
        NETWORK_KIND,
        "browser_network_requests",
        input.transcriptRecords,
        input.transcriptEvidenceRef,
      ),
      apiLogChannel(
        input.report,
        input.apiLogPath,
        input.apiLogText,
        input.apiLogEvidenceRef,
      ),
      probeBugsinkChannel(input.bugsink, input.report, fetcher),
      probeLokiChannel(input.loki, input.report, fetcher),
    ]),
  };
  return correlateEnvironmentFeedback({
    timeline: input.report.timeline,
    document,
  });
}
