# Анализ незавершённого — CustomReport (2026-06-19)

> Результат ultracode-прогона `w8ttdnf9q`: 44 агента, ~2.2M токенов.
> Haiku-прочёс 41 сессии + 6 хенд-оффов → 364 сырые находки →
> Opus-сверка с ground-truth → раскладка по моделям.
> Advisor был недоступен (перегружен) — раскладка не прошла внешнее ревью,
> но опирается прямо на `openspec list`, листинг архива и `git status`.

## Bottom line

Почти всё сделано и реально живёт в коде. Из 364 находок:
330 — уже отгружены и заархивированы, 28 — запаркованы by design,
и лишь ~6 уникальных — реально открыты.

Главная открытая работа — **одно** изменение `close-slides-visibility-tails`.

## ⚠ Коллизия (на момент анализа)

`close-slides-visibility-tails` писалась, судя по всему, ПАРАЛЛЕЛЬНОЙ
сессией прямо во время прогона:

- ни один агент воркфлоу не использовал Write (только grep/чтение);
- файлы писались поступательно 09:26→09:35 (proposal→specs→design→tasks);
- два интерактивных процесса `claude` + брокер Codex;
- `git reflog` без новых коммитов — изменение ещё не закоммичено;
- задача трекера #84 (Tail 1) стоит `in_progress`.

Директорию изменения НЕ трогать, пока коллизия не снята.

## Проверка «релизовано»

- Типчек зелёный: 5/5 пакетов, exit 0.
- Код недавних фич на месте + тесты: слайды Mine/Everyone
  (`lead-slides-client.tsx`, `section-slide-utils.ts`), требование стадии
  в схеме записи (`section.schema.ts`), sticky-тулбар (`report-toolbar.tsx`),
  «Your stages» (`sdlc-pipeline.tsx`).
- 125 изменений в `openspec/changes/archive` — сходятся с кодом.

## Реально открытое + раскладка по моделям

| #     | Что                                                                                                                               | Модель   | Усилие | Группа      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ----------- |
| 1     | Tail 1: баг fetch-gate `crossAuthorContent` на чужой колоде (`lead-form.tsx` L466 + L796) + регресс-тест                          | **Opus** | сред.  | bug         |
| 2     | Tail 2: инертный `ForeignTagsComingSoon` + render-условие + тесты                                                                 | Sonnet   | сред.  | integration |
| 3     | Tail 3/4: записать решения (head-тулбар + вердикт Codex) в `design.md` + ADR 0003                                                 | Sonnet   | низк.  | spec-debt   |
| 4     | Закоммитить + довести изменение до зелёного + архив                                                                               | Sonnet   | высок. | integration |
| 5     | Убрать 2 бесхозных PNG в корне (`head-toolbar*.png`)                                                                              | Haiku    | низк.  | cosmetic    |
| 6     | Запушить 28 коммитов ветки в `origin/main` (по команде)                                                                           | Haiku    | низк.  | seam        |
| ~~7~~ | ~~Пересоздать Bugsink-проект~~ — ЗАКРЫТО 2026-06-19: контейнер `customreport-bugsink-1` Up (healthy), DSN прописан в `.env.local` | —        | —      | ops         |

Пункты 1–4 — это и есть `close-slides-visibility-tails` (0/14).
Opus только на #1: логика утечки cross-author, цена ошибки высока.
Пункты 6 и 7 — user-managed (push по запросу, ops при сбросе тома); не авто.

## Отсев (для протокола)

- **Запарковано by design (28):** 20 директорий `openspec/deferred`
  (versions-v2, i18n, theme-switch, telegram, ai-rag, holidays, multi-org, occ
  и пр.) + ComingSoon-аффордансы (lead-pdf-export, agent-review-placeholder,
  why-status tooltip) + research-only. Это НЕ недоделки.
- **Уже сделано (330):** почти каждая «открытая» сырая находка нашлась в
  архиве 2026-06-08..18. Огромный сырой счёт схлопнулся, потому что одни и те
  же items повторялись 20–80 раз по сессиям.
- ScopeToggle «Own»→«Summary» — подтверждён и отгружен в
  archived `slides-record-visibility`. «Тулбар не заархивирован» — устарело
  (оба в `archive/2026-06-18`).

## Предлагаемый порядок (когда коллизия снята)

1. Закоммитить директорию изменения (убрать из untracked).
2. Tail 1: фикс gate + регресс-тест (Opus).
3. Tail 2: аффорданс (Sonnet).
4. Tail 3/4: решения в design.md + ADR 0003 (Sonnet).
5. Гейты + live-verify → openspec-verify/archive.
6. Убрать 2 PNG (Haiku).
7. Push в main — только по явной команде (Haiku).
8. Bugsink — независимо, при сбросе тома (Sonnet).
