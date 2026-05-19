---
name: Plan Mode = peo-plan rich-mode (always)
description: Любой Plan Mode в Claude Code = полный peo-plan rich-mode с 15 секциями, TL;DR (Было/Проблема/Станет в схемах + проза), Mermaid pipeline, subagent roadmap, token economy. Без сокращений.
type: feedback
originSessionId: cbc7ca29-a050-408c-ab3c-bfe286f4c592
---

При входе в Plan Mode (любой `plan_mode_active`, любой `EnterPlanMode`) — **обязательно полный шаблон peo-plan rich-mode**, не сокращённая версия.

**Why:** 2026-05-19 пользователь отверг shiny-eagle pivot-plan (W5) с фидбэком: «не все разделы здесь есть, нужна полноценная детализация, которая требует PEO-план… TL;DR — я не вижу конкретной секции, где была проблема, точнее была, а текущий процесс проблемы, как будет, в схемах и человеческим описанием». То есть короткой формы peo-plan недостаточно — нужны ВСЕ 15 секций (TL;DR с Было/Проблема/Станет, Контекст, Сейчас, Architecture context, Recovered intent, Boundaries, Workstreams, Subagent roadmap, Token economy, Agent does / Human does, Open questions with defaults, Verification, Iteration reserve / self-review checklist, Skill routing).

**How to apply:**

1. **Триггер:** любой EnterPlanMode (claude-code) или `/plan` команда → грузить шаблон peo-plan rich-mode (`~/.claude/skills/peo-plan/templates/phase-plan.md`) ДО начала Phase 1 explore.
2. **TL;DR обязательная структура (под почти-квадратное окно ревью):**
   - **Было** — текущее состояние с ASCII-схемой
   - **Проблема** — что не так, почему меняем, со схемой
   - **Станет** — целевой результат со схемой
   - Прозовый абзац под каждой схемой («человеческим описанием») с motivation
   - Pipeline фаз — отдельный блок, можно через Mermaid `flowchart TB` или ASCII arrow flow
   - Одна строка «от человека» — короткое summary
3. **Эксперименты с форматами поощряются:** Mermaid (`flowchart TB`, sequence) для pipeline и flow, ASCII frames для статусов и before/after, HTML mock-up для UI, C4 для architecture. Не один монотонный формат на весь план.
4. **Self-review перед ExitPlanMode:** пройти 13-пунктный чеклист из peo-plan §12 (TL;DR читается без чтения остального? Workstreams имеют file:line якоря? Subagent roadmap содержит model tier + scope + output contract? Token economy без Opus без verified conflict? Open questions имеют defaults? Verification — конкретные команды + acceptance?).
5. **Edge case — pivot inside existing plan:** если план уже существует и происходит pivot после ревью, новая секция (W5 в shiny-eagle) тоже должна иметь полные подсекции (own TL;DR с Было/Проблема/Станет, own pipeline, own subagent roadmap, own verification, own self-review) — не считать что секции выше «накрывают» pivot.

**Anti-pattern:** plain bullets «вот workstream, вот файлы, вот команды» без визуального TL;DR. Pivot-секция без своего Было/Проблема/Станет потому что «это же всё в основном плане выше».
