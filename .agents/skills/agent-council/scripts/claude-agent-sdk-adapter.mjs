#!/usr/bin/env node
import process from "node:process";

const DEFAULT_MODEL = "opus";
const DEFAULT_TOOLS = ["Read", "Glob", "Grep"];

const usage = `Usage:
  node claude-agent-sdk-adapter.mjs [options] -- "<task>"
  echo "<task>" | node claude-agent-sdk-adapter.mjs [options]

Options:
  --cwd <dir>       Working directory before running the SDK query.
  --model <model>   Claude model alias/name. Default: ${DEFAULT_MODEL}.
  --tools <tools>   Comma-separated allowed tools. Default: ${DEFAULT_TOOLS.join(",")}.
  -h, --help        Show this help.
`;

const main = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(usage);
    return;
  }

  const prompt = options.prompt || (await readStdin()).trim();

  if (!prompt) {
    throw new Error("No task provided. Pass it after -- or pipe it on stdin.");
  }

  if (options.cwd) {
    process.chdir(options.cwd);
  }

  const sdk = await import("@anthropic-ai/claude-agent-sdk").catch((error) => {
    throw new Error(
      `@anthropic-ai/claude-agent-sdk is not installed or cannot be loaded: ${error.message}`,
    );
  });

  const result = await collectResult(
    sdk.query({
      prompt,
      options: {
        allowedTools: options.tools,
        maxTurns: 1,
        model: options.model,
        permissionMode: "dontAsk",
        settingSources: [],
      },
    }),
  );

  process.stdout.write(`${result || "(no result returned)"}\n`);
};

function parseArgs(argv) {
  const options = {
    cwd: "",
    help: false,
    model: process.env.AGENT_COUNCIL_CLAUDE_MODEL || DEFAULT_MODEL,
    prompt: "",
    tools: DEFAULT_TOOLS,
  };
  const promptParts = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      promptParts.push(...argv.slice(index + 1));
      break;
    }

    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }

    if (arg === "--cwd") {
      options.cwd = requireValue(argv, (index += 1), "--cwd");
      continue;
    }

    if (arg === "--model") {
      options.model = requireValue(argv, (index += 1), "--model");
      continue;
    }

    if (arg === "--tools") {
      options.tools = requireValue(argv, (index += 1), "--tools")
        .split(",")
        .map((tool) => tool.trim())
        .filter(Boolean);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    promptParts.push(arg);
  }

  options.prompt = promptParts.join(" ").trim();
  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index];

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

async function collectResult(messages) {
  const textParts = [];

  for await (const message of messages) {
    if (typeof message?.result === "string") {
      return message.result;
    }

    if (message?.type === "assistant" && Array.isArray(message.message?.content)) {
      textParts.push(
        ...message.message.content
          .filter((part) => part.type === "text" && typeof part.text === "string")
          .map((part) => part.text),
      );
    }
  }

  return textParts.join("\n").trim();
}

async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

main().catch((error) => {
  process.stderr.write(`claude-agent-sdk-adapter: ${error.message}\n`);
  process.exitCode = 1;
});
