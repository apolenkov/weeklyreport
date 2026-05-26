# Inventory 2026-05-26

## Problem

Накопился ряд отложенных вещей, заглушек и TODO-маркеров без единого
обзора. Нужен один снимок: что уже сделано, что отложено, что надо
доделать, что заморожено навсегда.

---

## DONE — заархивированные changes (21 шт.)

Всё ниже было сделано и заархивировано в `openspec/changes/archive/`.

### 2026-05-25 (16 changes)

| Change                            | Что было сделано                                                   |
| --------------------------------- | ------------------------------------------------------------------ |
| `add-report-url-id`               | Уникальный ID отчёта в URL (`/report/:id`)                         |
| `audit-scope-filter-migration`    | Фильтр по группе при чтении черновиков                             |
| `fix-decisions-slide-overflow`    | Слайд «Решения» больше не переполняется                            |
| `fix-head-dashboard-group-scope`  | Дашборд хеда показывает только свою группу                         |
| `fix-item-dialog-input-loss`      | Ввод текста сразу после открытия диалога не теряется               |
| `fix-landing-cls-skeleton`        | Landing page не прыгает (CLS исправлен)                            |
| `fix-multitab-lead-form-sync`     | Форма лида синхронизируется между вкладками                        |
| `fix-period-reopen-ui`            | Понятный UI для переоткрытия закрытого периода                     |
| `fix-samlify-xmldom-onerror`      | Устаревший обработчик `onError` в samlify убран                    |
| `fix-slide-separator-alignment`   | Разделители продуктов на слайдах выровнены                         |
| `fix-stage-chip-risk-visual-sync` | Чип риска обновляет цвет сразу при смене стадии                    |
| `fix-stage-cross-author-multi`    | Стадии рисков хранятся массивом, не строкой                        |
| `redesign-slide-density-v8-4-3`   | Слайды переработаны с более плотной вёрсткой                       |
| `refactor-stage-source-ownership` | Маппинг имён стадий вынесен в одно место                           |
| `save-disc-stage-banner`          | Кнопка сохранения (icon-only) + баннер предупреждения над стадиями |
| `verify-fit2-v7-uat-items`        | UAT v7 — проверены edge-case риски по всем ролям                   |

### 2026-05-26 (5 changes)

| Change                            | Что было сделано                                 |
| --------------------------------- | ------------------------------------------------ |
| `add-landing-tagline-cycler`      | Циклический тайтл на лендинге                    |
| `add-next-week-dashed-border`     | Пунктирная рамка для строк «следующая неделя»    |
| `add-prisma-typecheck-gate`       | CI-проверка TypeScript для Prisma seed-файлов    |
| `add-revoke-on-head-dashboard`    | Кнопка Revoke доступна прямо с дашборда хеда     |
| `fix-archive-history-distinction` | Archive и History разграничены для пользователей |

---

## DEFERRED — отложено до явного «вперёд»

| Change                                    | Что внутри                                                                                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defer-uat-codequality-vercel-2026-05-26` | Live Playwright UAT-свип 4 ролей + code-quality агенты (simplifier/modernization/review) + Vercel best-practices аудит + финальные гейты. Все задачи `[ ]` — старт по явному сигналу пользователя. |

---

## TO-DO — надо сделать

### `unify-sdlc-stage-ownership` (отдельный openspec change)

В коде два независимых места, которые вычисляют «кому принадлежит
SDLC-стадия»:

```text
[buildStageGrid]          ← lib/mappers/lead-form.ts:296
       ↓ вычисляет ownership
   stage.ownership
       ↑ вычисляет ownership
[cross-author upgrade]    ← lead-form.tsx:795
```

Правка в одном не обновляет другое. Это **будущий баг**. Нужно
вытащить общий helper `resolveStageOwnership(...)`.

Зарегистрировано отдельным change (скелет). Реализация — следующая задача.

### Технический долг в TODO-маркерах

Список всех актуальных маркеров (кроме FROZEN-разделов ниже):

| Маркер                  | Файл                                                                  | Описание                                                               |
| ----------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `v8.5-C-ownership`      | `lib/mappers/lead-form.ts:296`                                        | Два источника ownership → нужен один helper                            |
| `v8.5-A-occ`            | `api/.../lead-form.prisma-repository.ts:290`                          | Нет OCC-проверки при wipe+recreate стадий                              |
| `v8.5-B-pin`            | `web/.../version-history-nav.tsx:23`                                  | Callback `onPin` для закрепления версии не подключён                   |
| `v8.4.3-slide-redesign` | `web/.../status-slide-deck.tsx:226`                                   | 2-колоночная сетка слайдов нарушает ритм                               |
| `STAGE-NAMING-01`       | `packages/shared/.../report.ts:87`                                    | Переименование `stageIds→stageNames` (~125 мест, 28 файлов) — деферред |
| `LEAD-VHS-07`           | `web/e2e/regression/version-history-snapshot.spec.ts:338`             | Полная проверка целостности версионного снимка                         |
| `E2E-RESEED-01`         | `web/e2e/regression/helpers/dev-auth.ts:197`                          | In-test ресид через API (сейчас заглушка)                              |
| `LEAD-LSC-01..06`       | `web/e2e/regression/lead-locked-stage-color.spec.ts`                  | Seed не создаёт `locked+blocked/at-risk` состояния — тесты скипаются   |
| `scopeAccessed-audit`   | `api/.../weekly-report.prisma-repository.ts:78`                       | Audit-лог при обращении к данным по скоупу                             |
| `Phase-59-multi-org`    | `api/lib/group-scope.ts:4`, `org.service.ts:36`, `login-page.tsx:161` | Расширение под мульти-орг (сейчас один синглтон)                       |
| `AGENT-REVIEW-01`       | `web/.../agent-review-coming-soon.tsx:7`                              | Подключить AI-ревью в surfaces отчёта                                  |
| `AGENT-REVIEW-02`       | `web/.../ai-summary-card.tsx:81`                                      | Подключить реального LLM-провайдера                                    |

---

## FROZEN — не трогаем без явного разрешения

Эти вещи существуют как заглушки или плашки «скоро», но их реализация
не начнётся без отдельного решения.

| Направление             | Маркер / файл                                              | Статус                                     |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| AI/RAG (фаза 54)        | `Phase-54-activation` — `api/modules/ai/*`                 | Мок + seeds, реального провайдера нет      |
| Telegram-бот (фаза 55)  | `Phase-55-activation` — `api/modules/telegram/*`           | Мок, `TG_BOT_TOKEN` не задан               |
| Тёмная тема             | `UFB-074` — `nav-bar.tsx:189`                              | Только research, CSS-токены не реализованы |
| i18n (русский UI)       | `i18n-future` — `nav-bar.tsx:166`, `tagline-cycler.tsx:10` | Production UI остаётся на английском       |
| Holidays calendar       | `holidays-activation` — `settings-tab.tsx:105`             | ComingSoon-плашка в admin                  |
| Director workflow       | —                                                          | viewer read-only, runtime-путь не открыт   |
| VERCEL-FONT (next/font) | `VERCEL-FONT` — `app/layout.tsx:35`                        | Google Fonts → `next/font` — отложено      |

### ComingSoon-плашки в UI

Это маленькие значки «скоро» на кнопках — показывают пользователю,
что фича запланирована, но ещё не работает.

| Контрол                    | Файл                                                     | Маркер                |
| -------------------------- | -------------------------------------------------------- | --------------------- |
| Language (выбор языка)     | `nav-bar.tsx:165`                                        | `i18n-future`         |
| Theme (выбор темы)         | `nav-bar.tsx:188`                                        | `UFB-074`             |
| Agent Review (слайды лида) | `lead-slides-client.tsx:189,223`                         | `AGENT-REVIEW-01`     |
| Agent Review (слайды хеда) | `status-slide-deck.tsx:222`, `head-report-shell.tsx:117` | `AGENT-REVIEW-01`     |
| Agent Review (форма лида)  | `lead-form.tsx:1429,1445`                                | `AGENT-REVIEW-01`     |
| Holidays Calendar          | `settings-tab.tsx:64`                                    | `holidays-activation` |
| AI Provider (3 настройки)  | `settings-tab.tsx:1070,1143,1166`                        | `Phase-54-activation` |
