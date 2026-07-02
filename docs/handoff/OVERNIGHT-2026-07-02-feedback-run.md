# Ночной автономный прогон — 2026-07-02 (фидбек + аудит)

Ветка `impl/backlog-2026-06-30` = `main` (FF). Всё запушено. Саша спал — прогон автономный.

## Что залито в main (по порядку)

| SHA        | Что                                                                        | Проверка                                                |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| `d67553b7` | LeadSummaryTable: убран горизонт-скролл в полосе 768–1023 (грид `md`→`lg`) | `/head/dashboard` на 900px — стек-карточки, скролла нет |
| `25720d56` | архив `head-surface-parity-declutter` (done)                               | `openspec list` — его нет                               |
| `0c45622e` | Фаза 1: безопасное подмножество 22 находок аудита                          | ниже                                                    |
| `b438177f` | 4 OpenSpec-change по фидбеку (спеки, не код)                               | `openspec list` — 4 новых                               |

Гейт на всех: web typecheck чист, eslint `--max-warnings 0` чист, unit зелёный (181 dashboard+slides, снапшоты обновлены). Полный репо-гейт НЕ гонял — в дереве незакоммиченная работа параллельных сессий (`apps/api/auth/*`, `exemplary-*`, `tighten-comment-policy`), она бы его загрязнила; мой фронт-код изолирован.

## Фаза 1 — что реально починено (коммит `0c45622e`)

Из 22 подтверждённых находок аудита — безопасное, высокоценное подмножество:

- **WCAG-контраст:** KPI «deadline» и «at risk» были золотом `#cba258` на белом (2.35:1) → читаемые токены.
- **Undefined-токен** `--radius-card` (квадратные углы в empty/skeleton) → `--radius` в 3 файлах.
- **Хардкод статус-хексов** (`#fef3c7/#8a6d1b/#d4a017/#fee2e2`) → токены `--color-status-*` (заодно поднят контраст <4.5:1).
- **Статус только цветом** на слайд-пилюлях/чипах → sr-only лейблы (WCAG 1.4.1/1.1.1).
- **Битый ARIA-таб** у product-chips (role=tab + висячий aria-controls) → `role=group`+`aria-pressed` (toggle-фильтр); тесты обновлены.
- **Touch-floor** на Remind/Revoke; тень reopen-card к общему рецепту; ритм заголовков.

**Не сделано из аудита (осознанно):** полная токенизация амбера по всему репо (item-card, risks/decisions-section, portfolio-overview и т.д. — большой sweep), извлечение `PendingCountPill` в примитив, единый `--elevation-panel/-table`. Это отдельный token-hygiene sweep — низкий риск, но широкий; оставил на отдельную сессию.

## 4 OpenSpec-change по фидбеку (коммит `b438177f`) — ТРЕБУЮТ ТВОИХ РЕШЕНИЙ

Весь живой фидбек (~24 пункта) захвачен в `docs/feedback/lead-surface-annotations-2026-07-02.md` и `head-surface-walkthrough-2026-07-02.md`, затем сгрилен автономно в спеки. Все 4 валидны `--strict`. **Код НЕ писал** — это план, часть со схемой; мигрировать вслепую ночью на общем дереве не стал.

1. **`activity-first-class-reporting-unit`** (крупнейший, схема). Активность = первоклассная единица как продукт: свои items/risks/blockers, БЕЗ стадии SDLC, связь с продуктами **M:N**. Полиморфный XOR-родитель на Item/Risk/Decision (nullable product FK + nullable activityId + CHECK XOR), новый join `ProjectActivityProduct`, статус активности выводится из её рисков/блокеров. Поймал латентный баг: `submitSectionSchema.projectStatuses.min(1)` блокирует лида только с активностями.
2. **`record-status-derived-from-risk`**. Статус-пилюля пункта выводится из покрывающих рисков/блокеров, вручную не снять («сначала удали риск/блокер»). Переиспользует stage-chip floor. Поймал баг флоринга completed-пунктов.
3. **`agent-review-human-confirmed-gate`**. Agent-review как gate с обязательным человеческим подтверждением; «review mode» отдельно; affordance на section-review; перенос review-полосы в дашборд.
4. **`lead-report-surface-polish`** (фронт, без схемы). Слайды: группировка по продукту→лиду, приоритеты вперёд, переполнение→карусель; единая высота карточек + «…» + тултип; «+Add» между Save/Submit и не прятать в слайдах; слияние AlertBar+ReopenCard; авто-копирование carry-over.

### Открытые вопросы (агенты подняли — реши перед реализацией)

- **Escalation/KPI-паритет (главный):** риски активностей — кормят ли head-dashboard Blocked&AtRisk + KPI, или пилюля активности изолирована? Фаза-1 дефолт спеки: изолирована (не трогает product-health). Подтверди Фазу-2.
- **Stored-vs-derived статус:** Option A (derive-only, убрать `ItemWorkflowStatus.blocked`) рекомендован vs Option B (хранить blocked + инвариант). Выбери форк.
- **Родитель Decision:** может ли активность владеть decision (полный паритет XOR) или decision остаётся product-only?
- **Достижим ли лид с активностями и 0 продуктов** в seed/реале (иначе relaxation submit — мёртвый код)?

## Статус на конец прогона

- Codex Act-2 adversarial-ревью `activity-first-class` — запущен в фоне (guarded). Вердикт/правки — следующим коммитом, если успел.
- Дерево: мои пути закоммичены; работа параллельных сессий не тронута.
- `openspec list`: 4 новых change (по фидбеку) + observability/ci-deploy/ratchet/tighten-comment (не мои).

## Первый шаг новой сессии

Реши 4 открытых вопроса выше → тогда реализуемо: сначала `lead-report-surface-polish` (фронт, без блокеров), затем `record-status-derived-from-risk`, затем `activity-first-class` (схема — `migrate reset` на dev). `agent-review` — уточни authz.
