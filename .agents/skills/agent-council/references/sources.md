# Agent Council Research Sources

## Primary CLI Sources

- Codex non-interactive mode: https://developers.openai.com/codex/noninteractive
- Codex CLI reference: https://developers.openai.com/codex/cli
- OpenCode CLI reference: https://opencode.ai/docs/cli/
- OpenCode skills discovery: https://opencode.ai/docs/skills/
- OpenCode Go models, including DeepSeek model ids: https://opencode.ai/docs/go/
- Claude Code skills: https://code.claude.com/docs/en/skills
- Claude Code CLI reference: https://code.claude.com/docs/en/cli-reference
- Claude Agent SDK overview: https://code.claude.com/docs/en/agent-sdk/overview

## Nearby Frameworks

- CrewAI: https://docs.crewai.com/
- Microsoft AutoGen: https://microsoft.github.io/autogen/stable/
- LangGraph: https://docs.langchain.com/oss/python/langgraph/overview
- OpenHands: https://docs.all-hands.dev/

## Local CLI Facts Verified

- `codex --version`: `codex-cli 0.142.5`
- `codex --help`: exposes `exec`, not `rescue`
- `codex help rescue`: returns `error: unrecognized subcommand 'rescue'`
- `claude --help`: exposes non-interactive `--print`, `--output-format`, `--no-session-persistence`, `--permission-mode`, `--disable-slash-commands`, `--allowed-tools`, `--model`, and `--effort` with values `low`, `medium`, `high`, `xhigh`, `max`
- `@anthropic-ai/claude-agent-sdk`: not installed in this repo; optional wrapper exists at `scripts/claude-agent-sdk-adapter.mjs` for runtimes that install it
- `opencode --version`: `1.17.11`
- `opencode run --help`: exposes `--format`, `--model`, `--variant`, `--agent`, `--dir`, and `--dangerously-skip-permissions`
- `opencode models opencode-go`: includes `opencode-go/deepseek-v4-flash`, `opencode-go/deepseek-v4-pro`, `opencode-go/glm-5.1`, and `opencode-go/glm-5.2`
- Parallel live `opencode run` smoke tests against the same workspace can fail with `database is locked`
- Sequential no-tools council smoke with Codex stub and real OpenCode returned `OPENCODE_COUNCIL_OK`
- Full no-tools multi-model smoke with real Codex command, DeepSeek Flash, and GLM 5.2: both OpenCode Go advisors returned `ok`; Codex launched but failed on workspace spend cap, which the harness captured as a normal failed advisor result
- Current high-quality defaults prefer `opencode-go/deepseek-v4-pro` over Flash and pass OpenCode `--variant max`; the older live smoke above used Flash because that was the default at the time.
