---
name: Max review mode (advisor + codex-rescue + /codex:review)
description: Пользователь ожидает «максимальный» режим ревью — advisor на каждом WAVE gate, codex-rescue для root-cause, /codex:review после каждой commit-batch
type: feedback
originSessionId: bba7038f-3313-48a3-895f-09a1520a7c56
---

В проекте CustomReport пользователь хочет, чтобы ревью-инструменты работали
на максималках. Сессия 2026-05-12 — он явно сказал:
«я ожидаю, что у нас будет адвайзер и работать и кодекс ReviewGate».

**Why:** в этой сессии advisor() 2× ловил критические проблемы
(analysis paralysis + scope creep), которые независимые ревью-агенты
пропустили. Без advisor мы бы пошли в execute с неверной моделью.
Пользователь видит value и хочет это по умолчанию, не только когда
просит.

**How to apply:**

| Инструмент           | Кто вызывает | Когда                                          |
| -------------------- | ------------ | ---------------------------------------------- |
| `advisor()`          | Claude       | каждый WAVE gate + перед commit decision       |
| `codex-rescue` agent | Claude       | root-cause диагностика sticky bugs (A13-class) |
| `/codex:review`      | User         | после каждой WAVE commit-batch                 |
| `/ultrareview <PR>`  | User         | финальная проверка PR перед merge              |

Без явного запроса от меня всё равно проактивно вызывать advisor()
на каждом крупном sync-point (после каждой WAVE / перед сменой
стратегии / при противоречии между sub-agent reports).

`/codex:review` и `/ultrareview` — slash-команды юзера, я не могу
их запустить. После каждого WAVE-batch напоминать пользователю:
«готов commits в WAVE N — пускай /codex:review --background».
