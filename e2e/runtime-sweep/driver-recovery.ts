import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type DriverAttemptStatus = "completed" | "interrupted";
export interface DriverAttemptInput {
  readonly directory: string;
  readonly reportText: string;
  readonly sessionId: string;
  readonly transcripts: readonly string[];
  readonly status: DriverAttemptStatus;
  readonly reportName?: string;
  readonly sessionName?: string;
}
export interface DriverAttemptArtifacts {
  readonly reportPath: string;
  readonly sessionPath: string;
}

export async function persistDriverAttempt(
  input: DriverAttemptInput,
): Promise<DriverAttemptArtifacts> {
  const reportPath = join(
    input.directory,
    input.reportName ?? "driver-report.raw.json",
  );
  const sessionPath = join(
    input.directory,
    input.sessionName ?? "driver-session.json",
  );
  await mkdir(input.directory, { recursive: true });
  await Promise.all([
    writeFile(reportPath, input.reportText, "utf8"),
    writeFile(
      sessionPath,
      `${JSON.stringify(
        {
          status: input.status,
          sessionId: input.sessionId,
          transcripts: input.transcripts,
        },
        null,
        2,
      )}\n`,
      "utf8",
    ),
  ]);
  return { reportPath, sessionPath };
}
