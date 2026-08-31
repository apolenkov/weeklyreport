import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";

export const mergeNextEnvironment = (
  environmentSource: string | undefined,
  inherited: NodeJS.ProcessEnv,
  command?: string,
): NodeJS.ProcessEnv => ({
  ...(environmentSource === undefined ? {} : parseEnv(environmentSource)),
  ...inherited,
  ...(command === "build"
    ? { NODE_ENV: "production" }
    : command === "dev"
      ? { NODE_ENV: "development" }
      : {}),
});

const main = (): void => {
  const webRoot = resolve(import.meta.dirname, "..");
  const repositoryRoot = resolve(webRoot, "../..");
  const environmentPath = join(repositoryRoot, ".env");
  const environmentSource = existsSync(environmentPath)
    ? readFileSync(environmentPath, "utf8")
    : undefined;
  const child = spawn(
    process.execPath,
    [
      join(webRoot, "node_modules/next/dist/bin/next"),
      ...process.argv.slice(2),
    ],
    {
      cwd: webRoot,
      env: mergeNextEnvironment(
        environmentSource,
        process.env,
        process.argv[2],
      ),
      stdio: "inherit",
    },
  );
  child.once("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.once("exit", (status, signal) => {
    if (signal !== null) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = status ?? 1;
  });
};

if (process.argv[1]?.endsWith("run-next.ts") === true) main();
