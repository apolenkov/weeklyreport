import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { z } from "zod";

import { roleSchema, sourceShaSchema } from "./contracts.js";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_BYTES = Number("16777216");

const eventSchema = z.object({
  sessionID: z.string().min(1),
  type: z.string().min(1),
  part: z
    .object({
      text: z.string().optional(),
      metadata: z.object({ phase: z.string().optional() }).optional(),
    })
    .optional(),
});

const driverReportSchema = z
  .object({
    roleDriven: roleSchema,
    sourceSha: sourceShaSchema,
    routesVisited: z.number().int().nonnegative(),
    routesPlanned: z.number().int().nonnegative(),
    canary: z
      .object({ injected: z.literal(true), detected: z.boolean() })
      .strict(),
    timeline: z.object({ startedAt: z.string(), endedAt: z.string() }).loose(),
    candidates: z.array(z.object({ cellId: z.string().min(1) }).loose()),
    coverageNotes: z.array(
      z
        .object({
          cellId: z.string().min(1),
          status: z.enum(["covered", "blocked"]),
          reason: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export type OpenCodeEvent = z.infer<typeof eventSchema>;
export type OpenCodeDriverReport = z.infer<typeof driverReportSchema>;

export interface OpenCodeDriveRequest {
  readonly maxTurns: number;
  readonly prompt: string;
  readonly repoRoot: string;
}

export interface OpenCodeDriveResult {
  readonly finalText: string;
  readonly sessionId: string;
  readonly transcripts: readonly string[];
}

export type OpenCodeExecutor = (
  args: readonly string[],
) => Promise<{ readonly stdout: string }>;

export class OpenCodeDriveError extends Error {
  override readonly name = "OpenCodeDriveError";
}

export function parseOpenCodeEvents(output: string): readonly OpenCodeEvent[] {
  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      const parsedJson: unknown = JSON.parse(line);
      const parsedEvent = eventSchema.safeParse(parsedJson);
      return parsedEvent.success ? [parsedEvent.data] : [];
    });
}

export function parseOpenCodeDriverReport(
  text: string,
  expectedSourceSha: string,
): OpenCodeDriverReport {
  const parsedJson: unknown = JSON.parse(text);
  const parsedReport = driverReportSchema.safeParse(parsedJson);
  if (!parsedReport.success) {
    throw new OpenCodeDriveError("OpenCode returned a malformed driver report");
  }
  if (parsedReport.data.sourceSha !== expectedSourceSha) {
    throw new OpenCodeDriveError("OpenCode driver report source SHA is stale");
  }
  if (!parsedReport.data.canary.detected) {
    throw new OpenCodeDriveError("OpenCode driver canary was blind");
  }
  return parsedReport.data;
}

function finalAnswer(events: readonly OpenCodeEvent[]): string | undefined {
  return events.findLast(
    (event) =>
      event.type === "text" && event.part?.metadata?.phase === "final_answer",
  )?.part?.text;
}

function invocationArgs(
  request: OpenCodeDriveRequest,
  sessionId?: string,
): readonly string[] {
  const message = sessionId
    ? "Do not use tools. Return only the required final JSON now."
    : request.prompt;
  return [
    "run",
    message,
    "--model",
    "opencode-go/gpt-5.6-luna",
    "--variant",
    "max",
    "--format",
    "json",
    "--dir",
    request.repoRoot,
    ...(sessionId ? ["--session", sessionId] : []),
  ];
}

async function defaultExecutor(
  args: readonly string[],
): Promise<{ readonly stdout: string }> {
  const result = await execFileAsync("opencode", [...args], {
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  return { stdout: result.stdout };
}

async function driveTurn(
  request: OpenCodeDriveRequest,
  execute: OpenCodeExecutor,
  transcripts: readonly string[],
  turn: number,
  sessionId?: string,
): Promise<OpenCodeDriveResult> {
  if (turn >= request.maxTurns) {
    throw new OpenCodeDriveError(
      "OpenCode session ended without a final answer",
    );
  }
  const { stdout } = await execute(invocationArgs(request, sessionId));
  const events = parseOpenCodeEvents(stdout);
  const observedSessionId = events.at(0)?.sessionID ?? sessionId;
  if (!observedSessionId) {
    throw new OpenCodeDriveError(
      "OpenCode output did not include a session id",
    );
  }
  const answer = finalAnswer(events);
  const nextTranscripts = [...transcripts, stdout];
  return answer
    ? {
        finalText: answer,
        sessionId: observedSessionId,
        transcripts: nextTranscripts,
      }
    : driveTurn(request, execute, nextTranscripts, turn + 1, observedSessionId);
}

export async function runOpenCodeDrive(
  request: OpenCodeDriveRequest,
  execute: OpenCodeExecutor = defaultExecutor,
): Promise<OpenCodeDriveResult> {
  return driveTurn(request, execute, [], 0);
}

export async function assertPlaywrightMcpConnected(
  execute: OpenCodeExecutor = defaultExecutor,
): Promise<void> {
  const { stdout } = await execute(["mcp", "list"]);
  if (!/playwright[\s\S]*connected/u.test(stdout)) {
    throw new OpenCodeDriveError("OpenCode Playwright MCP is not connected");
  }
}
