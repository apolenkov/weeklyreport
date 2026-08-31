import { defineConfig } from "vitest/config";

type VitestReportingEnvironment = Readonly<{
  GITHUB_ACTIONS?: string;
  VITEST_JSON_OUTPUT_FILE?: string;
}>;

type VitestReporter =
  | "default"
  | [
      "github-actions",
      { displayAnnotations: boolean; jobSummary: { enabled: boolean } },
    ]
  | ["json", { outputFile: string }];

export const getVitestReporters = (
  environment: VitestReportingEnvironment = process.env,
): VitestReporter[] => {
  const humanReporters =
    environment.GITHUB_ACTIONS === "true"
      ? ([
          "default",
          [
            "github-actions",
            {
              displayAnnotations: true,
              jobSummary: { enabled: false },
            },
          ],
        ] as VitestReporter[])
      : (["default"] as VitestReporter[]);

  return [
    ...humanReporters,
    ...(environment.VITEST_JSON_OUTPUT_FILE
      ? [
          ["json", { outputFile: environment.VITEST_JSON_OUTPUT_FILE }] as [
            "json",
            { outputFile: string },
          ],
        ]
      : []),
  ];
};

// Shared coverage shell for every suite: the engine, the report formats and
// where the report lands are a repo-wide decision, so they live in one place.
// What each suite measures (`include`/`exclude`) and how strict it is
// (`thresholds`) stays in that suite's own config — they differ on purpose.
// `reportsDirectory` is resolved against the merging project's root, so each
// suite still writes its own `<project>/coverage`.
export default defineConfig({
  test: {
    // Keep GitHub annotations without letting every Vitest invocation append
    // its own generic "Vitest Test Report" to the job summary. CI owns the
    // single labelled summary; JSON is opt-in so local runs stay artifact-free.
    reporters: getVitestReporters(),
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
