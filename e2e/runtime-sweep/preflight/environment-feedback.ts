import { readFile } from "node:fs/promises";

import { z } from "zod";

import type { AiDriverReport } from "../driver/driver-results-contract.ts";

export const ENVIRONMENT_CHANNELS = [
  "browser-console",
  "network",
  "app-log",
  "bugsink",
  "loki",
] as const;
export type EnvironmentChannel = (typeof ENVIRONMENT_CHANNELS)[number];

const signalKinds = ["console", "page-error", "network", "server"] as const;
const environmentChannelSchema = z.enum(ENVIRONMENT_CHANNELS);
const environmentEventSchema = z
  .object({
    eventId: z.string().min(1),
    timestamp: z.iso.datetime(),
    kind: z.enum(signalKinds),
    message: z.string().min(1),
    evidenceRefs: z.array(z.string().min(1)).min(1).readonly(),
    route: z.string().min(1).optional(),
    cellId: z.string().min(1).optional(),
  })
  .strict();
const environmentChannelInputSchema = z
  .object({
    channel: environmentChannelSchema,
    reachable: z.boolean(),
    hasStreams: z.boolean(),
    events: z.array(environmentEventSchema).readonly(),
  })
  .strict();
const canarySchema = z
  .object({ injected: z.boolean(), detected: z.boolean() })
  .strict();
export const environmentFeedbackDocumentSchema = z
  .object({
    canary: canarySchema,
    channels: z.array(environmentChannelInputSchema).readonly(),
  })
  .strict();

export type EnvironmentEvent = z.infer<typeof environmentEventSchema>;
export type EnvironmentChannelInput = z.infer<
  typeof environmentChannelInputSchema
>;
export type EnvironmentFeedbackDocument = z.infer<
  typeof environmentFeedbackDocumentSchema
>;
export type EnvironmentTimeline = AiDriverReport["timeline"];
export type EnvironmentHit = Readonly<{
  readonly channel: EnvironmentChannel;
  readonly eventId: string;
  readonly timestamp: string;
  readonly kind: EnvironmentEvent["kind"];
  readonly message: string;
  readonly evidenceRefs: readonly string[];
  readonly route: string | null;
  readonly cellId: string | null;
}>;
export type EnvironmentChannelStatus = Readonly<{
  readonly channel: EnvironmentChannel;
  readonly reachable: boolean;
  readonly hasStreams: boolean;
  readonly status: "live" | "blind";
  readonly reason?: string;
}>;
export type EnvironmentFeedback = Readonly<{
  readonly canary: EnvironmentFeedbackDocument["canary"];
  readonly channels: readonly EnvironmentChannelStatus[];
  readonly blindChannels: readonly EnvironmentChannel[];
  readonly hits: readonly EnvironmentHit[];
  readonly blockingReasons: readonly string[];
  readonly clean: boolean;
}>;

export class EnvironmentFeedbackError extends Error {
  override readonly name = "EnvironmentFeedbackError";

  constructor(readonly issues: readonly string[]) {
    super(
      `Environment feedback blocked the driver result: ${issues.join("; ")}`,
    );
  }
}

const toMillis = (value: string): number | null => {
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
};

function routeAt(
  timestamp: string,
  timeline: EnvironmentTimeline,
): string | null {
  const eventMillis = toMillis(timestamp);
  if (eventMillis === null) return null;
  return (
    timeline.routes.find((route) => {
      const entered = toMillis(route.enteredAt);
      const left = toMillis(route.leftAt);
      return (
        entered !== null &&
        left !== null &&
        entered <= eventMillis &&
        eventMillis <= left
      );
    })?.route ?? null
  );
}

function channelStatus(
  channel: EnvironmentChannel,
  input: EnvironmentChannelInput | undefined,
): EnvironmentChannelStatus {
  if (!input)
    return {
      channel,
      reachable: false,
      hasStreams: false,
      status: "blind",
      reason: "channel was not reported",
    };
  if (!input.reachable)
    return {
      channel,
      reachable: false,
      hasStreams: input.hasStreams,
      status: "blind",
      reason: "channel is unreachable",
    };
  if (!input.hasStreams)
    return {
      channel,
      reachable: true,
      hasStreams: false,
      status: "blind",
      reason: "no shipped stream",
    };
  return {
    channel,
    reachable: true,
    hasStreams: true,
    status: "live",
  };
}

function collectHits(
  channels: readonly EnvironmentChannelInput[],
  timeline: EnvironmentTimeline,
): readonly EnvironmentHit[] {
  return channels.flatMap(({ channel, events }) =>
    events.map((event) => ({
      channel,
      eventId: event.eventId,
      timestamp: event.timestamp,
      kind: event.kind,
      message: event.message,
      evidenceRefs: event.evidenceRefs,
      route: event.route ?? routeAt(event.timestamp, timeline) ?? null,
      cellId: event.cellId ?? null,
    })),
  );
}

export function correlateEnvironmentFeedback(
  input: Readonly<{
    readonly timeline: EnvironmentTimeline;
    readonly document: EnvironmentFeedbackDocument;
  }>,
): EnvironmentFeedback {
  const document = environmentFeedbackDocumentSchema.parse(input.document);
  const byChannel = new Map(
    document.channels.map((channel) => [channel.channel, channel]),
  );
  const statuses = ENVIRONMENT_CHANNELS.map((channel) =>
    channelStatus(channel, byChannel.get(channel)),
  );
  const blindChannels = statuses
    .filter(({ status }) => status === "blind")
    .map(({ channel }) => channel);
  const blockingReasons = [
    ...statuses
      .filter((status) => status.status === "blind")
      .map(
        (status) =>
          `${status.channel} channel is blind (${status.reason ?? "unknown reason"})`,
      ),
    ...(document.canary.injected && document.canary.detected
      ? []
      : ["browser console canary was not detected"]),
  ];
  const hits = collectHits(document.channels, input.timeline);
  return {
    canary: document.canary,
    channels: statuses,
    blindChannels,
    hits,
    blockingReasons,
    clean: blockingReasons.length === 0 && hits.length === 0,
  };
}

const emptyDocument = (
  canary: EnvironmentFeedbackDocument["canary"],
): EnvironmentFeedbackDocument => ({
  canary,
  channels: ENVIRONMENT_CHANNELS.map((channel) => ({
    channel,
    reachable: false,
    hasStreams: false,
    events: [],
  })),
});

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export async function readEnvironmentFeedback(
  path: string,
  timeline: EnvironmentTimeline,
  canary: EnvironmentFeedbackDocument["canary"],
): Promise<EnvironmentFeedback> {
  try {
    const text = await readFile(path, "utf8");
    const parsed: unknown = JSON.parse(text);
    return correlateEnvironmentFeedback({
      timeline,
      document: environmentFeedbackDocumentSchema.parse(parsed),
    });
  } catch (error) {
    if (isMissingFile(error))
      return correlateEnvironmentFeedback({
        timeline,
        document: emptyDocument(canary),
      });
    if (error instanceof EnvironmentFeedbackError) throw error;
    if (error instanceof Error)
      throw new EnvironmentFeedbackError([error.message]);
    throw error;
  }
}

export function assertEnvironmentFeedbackLive(
  feedback: EnvironmentFeedback,
): void {
  if (feedback.blockingReasons.length > 0)
    throw new EnvironmentFeedbackError(feedback.blockingReasons);
}
