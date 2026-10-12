import type { ReactElement, ReactNode } from "react";

const MARKER_STRIDE = 2;
const ODD_MARKER_POSITION = 1;
const H6_PREFIX_LENGTH = 7;
const H5_PREFIX_LENGTH = 6;
const H4_PREFIX_LENGTH = 5;
const H3_PREFIX_LENGTH = 4;
const H2_PREFIX_LENGTH = 3;
const H1_PREFIX_LENGTH = 2;

type MarkdownLine =
  | Readonly<{
      kind: "heading";
      tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      text: string;
    }>
  | Readonly<{ kind: "list"; text: string }>
  | Readonly<{ kind: "paragraph"; text: string }>
  | Readonly<{ kind: "spacer" }>;

type MarkdownBlock =
  | Readonly<{
      key: string;
      kind: "heading";
      tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      text: string;
    }>
  | Readonly<{
      key: string;
      kind: "list";
      items: readonly Readonly<{ key: string; text: string }>[];
    }>
  | Readonly<{ key: string; kind: "paragraph"; text: string }>
  | Readonly<{ key: string; kind: "spacer" }>;

const inlineNodes = (value: string): ReactNode[] => {
  const occurrences = new Map<string, number>();
  const parts = value.split("**");
  return parts.map((part, position) => {
    const occurrence = occurrences.get(part) ?? 0;
    occurrences.set(part, occurrence + 1);
    const isOddSegment = position % MARKER_STRIDE === ODD_MARKER_POSITION;
    const isEmphasized = isOddSegment && position < parts.length - 1;
    const text = isOddSegment && !isEmphasized ? `**${part}` : part;
    const key = `${isEmphasized ? "strong" : "plain"}-${part}-${occurrence}`;
    return isEmphasized ? (
      <strong key={key}>{part}</strong>
    ) : (
      <span key={key}>{text}</span>
    );
  });
};

const lineContent = (line: string): MarkdownLine => {
  const trimmed = line.trim();
  if (trimmed.startsWith("###### ")) {
    return {
      kind: "heading",
      tag: "h6",
      text: trimmed.slice(H6_PREFIX_LENGTH),
    };
  }
  if (trimmed.startsWith("##### ")) {
    return {
      kind: "heading",
      tag: "h5",
      text: trimmed.slice(H5_PREFIX_LENGTH),
    };
  }
  if (trimmed.startsWith("#### ")) {
    return {
      kind: "heading",
      tag: "h4",
      text: trimmed.slice(H4_PREFIX_LENGTH),
    };
  }
  if (trimmed.startsWith("### ")) {
    return {
      kind: "heading",
      tag: "h3",
      text: trimmed.slice(H3_PREFIX_LENGTH),
    };
  }
  if (trimmed.startsWith("## ")) {
    return {
      kind: "heading",
      tag: "h2",
      text: trimmed.slice(H2_PREFIX_LENGTH),
    };
  }
  if (trimmed.startsWith("# ")) {
    return {
      kind: "heading",
      tag: "h1",
      text: trimmed.slice(H1_PREFIX_LENGTH),
    };
  }
  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    return { kind: "list", text: trimmed.slice(2) };
  }
  if (trimmed.length === 0) {
    return { kind: "spacer" };
  }
  return { kind: "paragraph", text: trimmed };
};

const parseBlocks = (markdown: string): MarkdownBlock[] => {
  const lines = markdown.split("\n");
  const blocks: MarkdownBlock[] = [];

  // eslint-disable-next-line no-restricted-syntax -- The cursor advances over each grouped list exactly once.
  for (let position = 0; position < lines.length; position += 1) {
    const content = lineContent(lines[position] ?? "");
    if (content.kind !== "list") {
      blocks.push({ ...content, key: `line-${position}` });
      continue;
    }

    const start = position;
    const items = [{ key: `line-${position}`, text: content.text }];
    while (position + 1 < lines.length) {
      const next = lineContent(lines[position + 1] ?? "");
      if (next.kind !== "list") break;
      items.push({ key: `line-${position + 1}`, text: next.text });
      position += 1;
    }
    blocks.push({ key: `list-${start}`, kind: "list", items });
  }

  return blocks;
};

const renderHeading = (
  content: Extract<MarkdownBlock, { kind: "heading" }>,
): ReactElement => {
  if (content.tag === "h1") {
    return (
      <h1
        key={content.key}
        className="mt-4 text-base font-semibold text-[var(--color-foreground)] first:mt-0"
      >
        {inlineNodes(content.text)}
      </h1>
    );
  }
  if (content.tag === "h2") {
    return (
      <h2
        key={content.key}
        className="mt-3 text-sm font-semibold text-[var(--color-foreground)] first:mt-0"
      >
        {inlineNodes(content.text)}
      </h2>
    );
  }
  const Heading = content.tag;
  return (
    <Heading
      key={content.key}
      className="mt-2 text-sm font-medium text-[var(--color-foreground)] first:mt-0"
    >
      {inlineNodes(content.text)}
    </Heading>
  );
};

const renderBlock = (content: MarkdownBlock): ReactElement => {
  if (content.kind === "heading") return renderHeading(content);
  if (content.kind === "list") {
    return (
      <ul
        key={content.key}
        className="list-disc space-y-1 pl-5 marker:text-[var(--color-primary)]"
      >
        {content.items.map((item) => (
          <li key={item.key} className="pl-1 leading-6">
            {inlineNodes(item.text)}
          </li>
        ))}
      </ul>
    );
  }
  if (content.kind === "spacer") {
    return <div key={content.key} aria-hidden="true" className="h-2" />;
  }
  return (
    <p key={content.key} className="whitespace-pre-wrap leading-6">
      {inlineNodes(content.text)}
    </p>
  );
};

export function LeadReportAssistantMarkdown({
  markdown,
}: {
  readonly markdown: string;
}) {
  return (
    <div className="space-y-1 text-sm text-[var(--color-foreground)]">
      {parseBlocks(markdown).map(renderBlock)}
    </div>
  );
}
