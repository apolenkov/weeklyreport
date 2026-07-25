import { ESLint } from "eslint";
const files = process.argv.slice(2);
const e = new ESLint({
  overrideConfig: [
    {
      files: ["**/*.ts"],
      rules: {
        "sonarjs/cognitive-complexity": ["error", 10],
        "max-lines-per-function": [
          "error",
          { max: 50, skipBlankLines: true, skipComments: true },
        ],
        "max-lines": [
          "error",
          { max: 250, skipBlankLines: true, skipComments: true },
        ],
      },
    },
  ],
});
const res = await e.lintFiles(files);
for (const r of res) {
  const msgs = r.messages.filter((m) =>
    [
      "sonarjs/cognitive-complexity",
      "max-lines-per-function",
      "max-lines",
    ].includes(m.ruleId),
  );
  if (msgs.length)
    console.log(
      r.filePath,
      JSON.stringify(
        msgs.map((m) => ({ l: m.line, r: m.ruleId, m: m.message })),
        null,
        1,
      ),
    );
}
