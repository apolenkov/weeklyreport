import type { ReactNode } from "react";

const MARKER_STRIDE = 2;
const ODD_MARKER_POSITION = 1;
const H3_PREFIX_LENGTH = 4;
const H2_PREFIX_LENGTH = 3;
const H1_PREFIX_LENGTH = 2;

const inlineNodes = (value: string): ReactNode[] => {
  const occurrences = new Map<string, number>();
  return value.split("**").map((part, position) => {
    const occurrence = occurrences.get(part) ?? 0;
    occurrences.set(part, occurrence + 1);
    const isEmphasized = position % MARKER_STRIDE === ODD_MARKER_POSITION;
    const key = `${isEmphasized ? "strong" : "plain"}-${part}-${occurrence}`;
    return isEmphasized ? (
      <strong key={key}>{part}</strong>
    ) : (
      <span key={key}>{part}</span>
    );
  });
};

const lineContent = (
  line: string,
): Readonly<{ kind: "heading" | "list" | "paragraph"; text: string }> => {
  const trimmed = line.trim();
  if (trimmed.startsWith("### ")) {
    return { kind: "heading", text: trimmed.slice(H3_PREFIX_LENGTH) };
  }
  if (trimmed.startsWith("## ")) {
    return { kind: "heading", text: trimmed.slice(H2_PREFIX_LENGTH) };
  }
  if (trimmed.startsWith("# ")) {
    return { kind: "heading", text: trimmed.slice(H1_PREFIX_LENGTH) };
  }
  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    return { kind: "list", text: trimmed.slice(2) };
  }
  return { kind: "paragraph", text: trimmed };
};

const renderLine = (line: string, key: string): ReactNode => {
  if (line.trim().length === 0) {
    return <div key={key} className="h-2" />;
  }
  const content = lineContent(line);
  if (content.kind === "heading") {
    return (
      <h3
        key={key}
        className="mt-3 text-sm font-semibold text-[var(--color-foreground)] first:mt-0"
      >
        {inlineNodes(content.text)}
      </h3>
    );
  }
  if (content.kind === "list") {
    return (
      <div key={key} className="flex gap-2 leading-6">
        <span aria-hidden="true" className="text-[var(--color-primary)]">
          •
        </span>
        <span>{inlineNodes(content.text)}</span>
      </div>
    );
  }
  return (
    <p key={key} className="whitespace-pre-wrap leading-6">
      {inlineNodes(content.text)}
    </p>
  );
};

export function LeadReportAssistantMarkdown({
  markdown,
}: {
  readonly markdown: string;
}) {
  const occurrences = new Map<string, number>();
  return (
    <div className="space-y-1 text-sm text-[var(--color-foreground)]">
      {markdown.split("\n").map((line) => {
        const occurrence = occurrences.get(line) ?? 0;
        occurrences.set(line, occurrence + 1);
        return renderLine(line, `${line}-${occurrence}`);
      })}
    </div>
  );
}
