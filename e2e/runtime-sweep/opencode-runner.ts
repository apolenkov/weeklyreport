import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import {
  type DriverValidationInput,
  type OpenCodeDriverReport,
  parseDriverReport,
} from "./driver-results.ts";
import {
  createOpenCodeExecutor,
  isTimedOutOpenCodeProcessError,
  OPENCODE_INVOCATION_TIMEOUT_MS,
  type OpenCodeExecutor,
  OpenCodeExecutorTimeoutError,
} from "./opencode-executor.ts";

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

export class OpenCodeDriveError extends Error {
  override readonly name: string = "OpenCodeDriveError";
}

export class OpenCodeDriveInterruptedError extends OpenCodeDriveError {
  override readonly name: string = "OpenCodeDriveInterruptedError";

  constructor(
    readonly sessionId: string | undefined,
    readonly transcripts: readonly string[],
    message = "OpenCode session ended before a final answer",
  ) {
    super(message);
  }
}

export class OpenCodeDriveTimeoutError extends OpenCodeDriveInterruptedError {
  override readonly name = "OpenCodeDriveTimeoutError";

  constructor(
    sessionId: string | undefined,
    transcripts: readonly string[],
    readonly timeoutMs: number,
  ) {
    super(
      sessionId,
      transcripts,
      `OpenCode invocation timed out after ${timeoutMs}ms`,
    );
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

interface OpenCodeInvocationContext {
  readonly sessionId?: string;
  readonly transcripts: readonly string[];
}

const transcriptsWithPartialOutput = (
  transcripts: readonly string[],
  stdout: string | undefined,
): readonly string[] =>
  stdout && stdout.length > 0 ? [...transcripts, stdout] : transcripts;

const executeInvocation = async (
  execute: OpenCodeExecutor,
  args: readonly string[],
  context: OpenCodeInvocationContext,
): Promise<{ readonly stdout: string }> => {
  try {
    return await execute(args);
  } catch (error) {
    if (error instanceof OpenCodeExecutorTimeoutError)
      throw new OpenCodeDriveTimeoutError(
        context.sessionId,
        transcriptsWithPartialOutput(context.transcripts, error.stdout),
        OPENCODE_INVOCATION_TIMEOUT_MS,
      );
    if (!isTimedOutOpenCodeProcessError(error)) throw error;
    throw new OpenCodeDriveTimeoutError(
      context.sessionId,
      transcriptsWithPartialOutput(context.transcripts, error.stdout),
      OPENCODE_INVOCATION_TIMEOUT_MS,
    );
  }
};

interface EstablishedOpenCodeSession {
  readonly sessionId: string;
  readonly bootstrapOutput: string;
}

async function establishSession(
  request: OpenCodeDriveRequest,
  execute: OpenCodeExecutor,
): Promise<EstablishedOpenCodeSession> {
  const { stdout } = await executeInvocation(
    execute,
    invocationArgs(
      request,
      "Return exactly DRIVER_BOOTSTRAP_READY. Do not use tools.",
    ),
    { transcripts: [] },
  );
  const sessionId = parseOpenCodeEvents(stdout).at(0)?.sessionID;
  if (!sessionId)
    throw new OpenCodeDriveError(
      "OpenCode bootstrap did not include a session id",
    );
  return { sessionId, bootstrapOutput: stdout };
}

async function executeInitialTurn(
  request: OpenCodeDriveRequest,
  execute: OpenCodeExecutor,
  transcripts: readonly string[],
): Promise<{ readonly stdout: string }> {
  const directory = await mkdtemp(join(tmpdir(), "customreport-driver-"));
  const promptPath = join(directory, "prompt.md");
  try {
    await writeFile(promptPath, request.prompt, "utf8");
    const { sessionId, bootstrapOutput } = await establishSession(
      request,
      execute,
    );
    return await executeInvocation(
      execute,
      invocationArgs(
        request,
        `Read ${JSON.stringify(promptPath)} in full, then execute its runtime-driver instructions exactly.`,
        sessionId,
      ),
      {
        sessionId,
        transcripts: [...transcripts, bootstrapOutput],
      },
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

const defaultExecutor = createOpenCodeExecutor();

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
    ? await executeInvocation(
        execute,
        invocationArgs(
          request,
          "Do not use tools. Return only the required final JSON now.",
          sessionId,
        ),
        { sessionId, transcripts },
      )
    : await executeInitialTurn(request, execute, transcripts);
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
  const { stdout } = await executeInvocation(execute, ["mcp", "list"], {
    transcripts: [],
  });
  if (!/playwright[\s\S]*\bconnected\b/u.test(stdout)) {
    throw new OpenCodeDriveError("OpenCode Playwright MCP is not connected");
  }
  const missingTools = requiredTools.filter((tool) => !stdout.includes(tool));
  if (missingTools.length > 0)
    throw new OpenCodeDriveError(
      `OpenCode Playwright MCP is missing tools: ${missingTools.join(", ")}`,
    );
}
