export const boundedPlaywrightArgs = (
  leadingArgs: readonly string[],
  configPath: string,
): readonly string[] => [
  ...leadingArgs,
  "--filter",
  "@customreport/web",
  "exec",
  "playwright",
  "test",
  "--config",
  configPath,
];
