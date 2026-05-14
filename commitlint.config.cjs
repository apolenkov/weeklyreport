/**
 * 34-01: Conventional Commits enforcement for this repo.
 *
 * Allowed types match the existing commit history (feat / fix / chore /
 * docs / refactor / test / perf / ci / build / style / revert). Subject
 * length capped at 100 chars (loose enough not to bite, tight enough to
 * reject novellas in the title).
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [0],
    "subject-max-length": [2, "always", 100],
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "chore",
        "docs",
        "refactor",
        "test",
        "perf",
        "ci",
        "build",
        "style",
        "revert",
      ],
    ],
  },
};
