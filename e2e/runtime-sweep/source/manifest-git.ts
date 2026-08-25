import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { withoutLocalGitEnvironment } from "../../../scripts/shared/git-environment.ts";

const execFileAsync = promisify(execFile);

export type ManifestCommandRunner = (
  args: readonly string[],
  cwd: string,
) => Promise<string>;

export class ManifestGitError extends Error {
  override readonly name = "ManifestGitError";
}

export async function runGitCommand(
  args: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  try {
    const result = await execFileAsync("/usr/bin/git", [...args], {
      cwd,
      env: withoutLocalGitEnvironment(environment),
    });
    return result.stdout;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new ManifestGitError(
        `git ${args.join(" ")} failed: ${error.message}`,
      );
    }
    throw error;
  }
}
