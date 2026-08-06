import { createHash } from "node:crypto";

import { z } from "zod";

import { sha256DigestSchema } from "../source/contracts.ts";

const TRANSCRIPT_TOOLS = [
  "browser_console_messages",
  "browser_network_requests",
] as const;

const transcriptToolSchema = z.enum(TRANSCRIPT_TOOLS);

const transcriptToolRecordSchema = z
  .object({
    attemptId: z.string().min(1),
    timestamp: z.iso.datetime(),
    tool: transcriptToolSchema,
    route: z.string().min(1).optional(),
  })
  .strict();

export type TranscriptToolRecord = z.infer<typeof transcriptToolRecordSchema>;

export const transcriptEvidenceSchema = z
  .object({
    status: z.literal("captured"),
    evidenceRefs: z.array(z.string().min(1)).min(1).readonly(),
    digest: sha256DigestSchema,
  })
  .strict();

export type TranscriptEvidence = z.infer<typeof transcriptEvidenceSchema>;

export type TranscriptTimeline = Readonly<{
  readonly startedAt: string;
  readonly endedAt: string;
  readonly routes: readonly Readonly<{
    readonly route: string;
    readonly enteredAt: string;
    readonly leftAt: string;
  }>[];
}>;

export type TranscriptDocument = Readonly<{
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly text: string;
  readonly digest: string;
  readonly records: readonly TranscriptToolRecord[];
}>;

const timestamp = (value: string): number | null => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const recordKey = (record: TranscriptToolRecord): string =>
  [record.attemptId, record.timestamp, record.tool, record.route ?? ""].join(
    "\u0000",
  );

const decodeUtf8 = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("transcript is not valid UTF-8");
  }
};

export const sha256Bytes = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const parseLines = (text: string): readonly unknown[] => {
  const lines = text.split(/\r?\n/u);
  const body = lines.at(-1) === "" ? lines.slice(0, -1) : lines;
  if (body.length === 0 || (body.length === 1 && body[0] === ""))
    throw new Error("transcript has no records");
  return body.map((line, index) => {
    if (line.trim() === "")
      throw new Error(`transcript line ${index + 1} is empty`);
    try {
      return JSON.parse(line) as unknown;
    } catch {
      throw new Error(`transcript line ${index + 1} is not valid JSON`);
    }
  });
};

const routeMatches = (
  route: string,
  timestampMs: number,
  timeline: TranscriptTimeline,
): boolean =>
  timeline.routes.some((entry) => {
    const entered = timestamp(entry.enteredAt);
    const left = timestamp(entry.leftAt);
    return (
      entry.route === route &&
      entered !== null &&
      left !== null &&
      entered <= timestampMs &&
      timestampMs <= left
    );
  });

export const parseTranscript = (
  input: Readonly<{
    readonly path: string;
    readonly bytes: Uint8Array;
    readonly attemptId: string;
    readonly timeline: TranscriptTimeline;
  }>,
): TranscriptDocument => {
  const text = decodeUtf8(input.bytes);
  const start = timestamp(input.timeline.startedAt);
  const end = timestamp(input.timeline.endedAt);
  if (start === null || end === null || start > end)
    throw new Error("transcript requires a valid report timeline");
  const records = parseLines(text).map((value, index) => {
    const parsed = transcriptToolRecordSchema.safeParse(value);
    if (!parsed.success)
      throw new Error(`invalid transcript record at line ${index + 1}`);
    const record = parsed.data;
    if (record.attemptId !== input.attemptId)
      throw new Error(`transcript line ${index + 1} has a foreign attemptId`);
    const recordTime = timestamp(record.timestamp);
    if (recordTime === null || recordTime < start || recordTime > end)
      throw new Error(
        `transcript line ${index + 1} is outside the report timeline`,
      );
    if (
      record.route !== undefined &&
      !routeMatches(record.route, recordTime, input.timeline)
    )
      throw new Error(
        `transcript line ${index + 1} is outside its route interval`,
      );
    return record;
  });
  const keys = records.map(recordKey);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicates.length > 0)
    throw new Error("transcript contains duplicate records");
  return {
    path: input.path,
    bytes: Uint8Array.from(input.bytes),
    text,
    digest: sha256Bytes(input.bytes),
    records,
  };
};
