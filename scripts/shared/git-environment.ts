import { execFileSync } from "node:child_process";

const GIT = "/usr/bin/git";

const gitLocalEnvironmentNames = new Set(
  execFileSync(GIT, ["rev-parse", "--local-env-vars"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((name) => name !== ""),
);

export const withoutLocalGitEnvironment = (
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(environment).filter(
      ([name]) => !gitLocalEnvironmentNames.has(name),
    ),
  );
