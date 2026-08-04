import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import {
  type DriverValidationInput,
  type OpenCodeDriverReport,
  parseDriverReport,
} from "./driver-results.ts";

const MAX_OUTPUT_BYTES = Number("16777216");
const OPENCODE_BINARY = "/opt/homebrew/bin/opencode";
const OPENCODE_DRIVER_AGENT = "flash-browser-driver";
const OPENCODE_DRIVER_MODEL = "opencode-go/deepseek-v4-flash";
const OPENCODE_DRIVER_VARIANT = "max";

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

export type OpenCodeEvent = z.infer<typeof eventSchema>;
export type { OpenCodeDriverReport } from "./driver-results.ts";

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
  override readonly name: string = "OpenCodeDriveError";
}

export class OpenCodeDriveInterruptedError extends OpenCodeDriveError {
  override readonly name = "OpenCodeDriveInterruptedError";

  constructor(
    readonly sessionId: string | undefined,
    readonly transcripts: readonly string[],
  ) {
    super("OpenCode session ended before a final answer");
  }
}

export function parseOpenCodeEvents(output: string): readonly OpenCodeEvent[] {
  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap(parseEventLine);
}

function parseEventLine(line: string): readonly OpenCodeEvent[] {
  try {
    const parsedEvent = eventSchema.safeParse(JSON.parse(line) as unknown);
    return parsedEvent.success ? [parsedEvent.data] : [];
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }
}

export function parseOpenCodeDriverReport(
  text: string,
  expected: DriverValidationInput,
): OpenCodeDriverReport {
  try {
    return parseDriverReport(text, expected);
  } catch (error) {
    if (error instanceof OpenCodeDriveError) throw error;
    if (error instanceof SyntaxError)
      throw new OpenCodeDriveError("driver result is not valid JSON");
    if (error instanceof Error) throw new OpenCodeDriveError(error.message);
    throw error;
  }
}

function finalAnswer(events: readonly OpenCodeEvent[]): string | undefined {
  return events.findLast(
    (event) =>
      event.type === "text" && event.part?.metadata?.phase === "final_answer",
  )?.part?.text;
}

function invocationArgs(
  request: OpenCodeDriveRequest,
  message: string,
  sessionId?: string,
): readonly string[] {
  return [
    "run",
    "--agent",
    OPENCODE_DRIVER_AGENT,
    "--auto",
    message,
    "--model",
    OPENCODE_DRIVER_MODEL,
    "--variant",
    OPENCODE_DRIVER_VARIANT,
    "--format",
    "json",
    "--dir",
    request.repoRoot,
    ...(sessionId ? ["--session", sessionId] : []),
  ];
}

async function establishSession(
  request: OpenCodeDriveRequest,
  execute: OpenCodeExecutor,
): Promise<string> {
  const { stdout } = await execute(
    invocationArgs(
      request,
      "Return exactly DRIVER_BOOTSTRAP_READY. Do not use tools.",
    ),
  );
  const sessionId = parseOpenCodeEvents(stdout).at(0)?.sessionID;
  if (!sessionId)
    throw new OpenCodeDriveError(
      "OpenCode bootstrap did not include a session id",
    );
  return sessionId;
}

async function executeInitialTurn(
  request: OpenCodeDriveRequest,
  execute: OpenCodeExecutor,
): Promise<{ readonly stdout: string }> {
  const directory = await mkdtemp(join(tmpdir(), "customreport-driver-"));
  const promptPath = join(directory, "prompt.md");
  try {
    await writeFile(promptPath, request.prompt, "utf8");
    const sessionId = await establishSession(request, execute);
    return await execute(
      invocationArgs(
        request,
        `Read ${JSON.stringify(promptPath)} in full, then execute its runtime-driver instructions exactly.`,
        sessionId,
      ),
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

async function defaultExecutor(
  args: readonly string[],
): Promise<{ readonly stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      OPENCODE_BINARY,
      [...args],
      {
        encoding: "utf8",
        maxBuffer: MAX_OUTPUT_BYTES,
      },
      (error, stdout) => {
        if (error) reject(error);
        else resolve({ stdout });
      },
    );
    child.stdin?.end();
  });
}

async function driveTurn(
  request: OpenCodeDriveRequest,
  execute: OpenCodeExecutor,
  transcripts: readonly string[],
  turn: number,
  sessionId?: string,
): Promise<OpenCodeDriveResult> {
  if (turn >= request.maxTurns) {
    throw new OpenCodeDriveInterruptedError(sessionId, transcripts);
  }
  const { stdout } = sessionId
    ? await execute(
        invocationArgs(
          request,
          "Do not use tools. Return only the required final JSON now.",
          sessionId,
        ),
      )
    : await executeInitialTurn(request, execute);
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
  requiredTools: readonly string[] = [],
): Promise<void> {
  const { stdout } = await execute(["mcp", "list"]);
  if (!/playwright[\s\S]*\bconnected\b/u.test(stdout)) {
    throw new OpenCodeDriveError("OpenCode Playwright MCP is not connected");
  }
  const missingTools = requiredTools.filter((tool) => !stdout.includes(tool));
  if (missingTools.length > 0)
    throw new OpenCodeDriveError(
      `OpenCode Playwright MCP is missing tools: ${missingTools.join(", ")}`,
    );
}
