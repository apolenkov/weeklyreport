import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(import.meta.filename), "..");
const markdownRoots = [join(repoRoot, "docs")];
const markdownFiles = [join(repoRoot, "README.md")];

const walk = (directory) => {
  readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && path.endsWith(".md")) markdownFiles.push(path);
  });
};

markdownRoots.filter(existsSync).forEach(walk);

const errors = [];
const linkPattern = /\]\(([^)\n]*)\)/gu;

markdownFiles.forEach((file) => {
  const text = readFileSync(file, "utf8");
  const fences = text.match(/^```/gmu) ?? [];
  if (fences.length % 2 !== 0) {
    errors.push(`${file}: unbalanced fenced code block`);
  }
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1]?.trim().split("#", 1)[0] ?? "";
    if (!target || /^(?:https?:|mailto:)/u.test(target)) continue;
    const resolved = resolve(dirname(file), target);
    if (!existsSync(resolved))
      errors.push(`${file}: missing link target ${target}`);
  }
});

const diagramDirectory = join(repoRoot, "docs", "llm-report");
if (existsSync(diagramDirectory)) {
  readdirSync(diagramDirectory)
    .filter((name) => name.endsWith(".mmd"))
    .forEach((name) => {
      const path = join(diagramDirectory, name);
      const text = readFileSync(path, "utf8");
      if (!/^(?:flowchart|graph)\s/mu.test(text)) {
        errors.push(
          `${path}: Mermaid diagram must start with flowchart or graph`,
        );
      }
    });
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Markdown and Mermaid checks passed (${markdownFiles.length} files).`,
  );
}
