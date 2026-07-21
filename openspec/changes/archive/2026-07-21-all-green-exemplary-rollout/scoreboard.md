# SCOREBOARD — Фаза 0 (2026-07-18, main @ 261a255d)

Полные данные: `phase0-inventory.json`. Итоги по дереву:
86 файлов ≥240 строк · 102 функции >50 строк · 32 mutation-хотспота ·
38 exempt-записей на слайсах (много PERM — остаются) · 597 seed-minors.

| Слайс                        | Файлов | Oversize | LongFn | Mut | Exempt | Minors | Объём |
| ---------------------------- | ------ | -------- | ------ | --- | ------ | ------ | ----- |
| web-report-pages             | 45     | 10       | 14     | 1   | 6      | 0\*    | L     |
| api-sections-review          | 28     | 6        | 8      | 2   | 3      | 30     | L     |
| web-admin                    | 42     | 5        | 10     | 0   | 0      | 27     | M     |
| web-report-sections          | 37     | 7        | 9      | 4   | 5      | 38     | M     |
| web-review                   | 19     | 2        | 9      | 0   | 2      | 16     | M     |
| web-slides                   | 39     | 4        | 5      | 1   | 0      | 29     | M     |
| web-landing-org-period       | 40     | 8        | 7      | 0   | 5      | 43     | M     |
| web-app                      | 40     | 4        | 4      | 0   | 2      | 35     | M     |
| api-infrastructure           | 63     | 3        | 3      | 2   | 5      | 73     | M     |
| api-period-carryover-archive | 25     | 4        | 5      | 2   | 0      | 40     | M     |
| api-comms                    | 26     | 3        | 1      | 4   | 0      | 25     | M     |
| packages-misc                | 64     | 12       | 11     | 9   | 0      | 38     | M     |
| web-analytics                | 4      | 0        | 0      | 0   | 0      | 4      | S     |
| web-dashboard                | 29     | 1        | 2      | 0   | 1      | 25     | S     |
| web-pdf-export               | 3      | 1        | 1      | 0   | 0      | 2      | S     |
| web-viewer-telemetry         | 3      | 0        | 1      | 0   | 0      | 2      | S     |
| web-shared                   | 33     | 2        | 2      | 1   | 2      | 35     | S     |
| web-lib                      | 34     | 0        | 2      | 1   | 1      | 26     | S     |
| api-lib                      | 20     | 5        | 1      | 2   | 2      | 14     | S     |
| api-auth-admin               | 34     | 8        | 5      | 1   | 0      | 42     | S     |
| api-report-pub-search        | 19     | 0        | 2      | 2   | 4      | 27     | S     |
| api-analytics-activity-obs   | 36     | 1        | 0      | 0   | 0      | 26     | S     |

\* seed-minors report-pages «0» — файлы переехали из report-sections после ревью;
реальные хвосты подберёт regrade волны.

## Порядок волн

- **W1 — калибровка** (S-мелочь): web-analytics, web-pdf-export, web-viewer-telemetry,
  web-dashboard + оба defect-теста (bullmq attemptsMade, role-coverage гейт).
  Цель: откалибровать харнес до массовых волн.
- **W2–W6** — остальные S: web-shared, web-lib, api-lib, api-auth-admin,
  api-report-pub-search, api-analytics-activity-obs.
- **W7–W14** — M-слайсы (web-admin, report-sections, review, slides,
  landing-org-period, app, api-infrastructure, period-carryover-archive, comms, packages-misc).
- **W15–W16** — L: web-report-pages, api-sections-review.
- **Финал** — teardown снимаемых exempt-записей, контрольный полный гейт,
  Codex-спот-ревью случайной выборки.

Правило калибровки: после W1 сверить деградацию (память exemplary-rollout-degrades):
если верификаторы ловят «расщепил ради счётчика» — ужесточить спеки, а не гнать объём.
