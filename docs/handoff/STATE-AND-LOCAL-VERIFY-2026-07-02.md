# Состояние + как проверить локально — 2026-07-02 (сессия «доделка»)

Единый адрес хвостов. Ветка `impl/backlog-2026-06-30`, всё запушено.

## Что отгружено этой сессией (8 коммитов)

| SHA        | Что                                                                          | Как проверить                                                                     |
| ---------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ddc4a033` | Zod: частичный апдейт настроек не сбрасывает 12 полей в default              | сохрани одну под-вкладку настроек (напр. Notifications) → остальные не обнулились |
| `c923fff6` | архив 38 реализованных openspec-изменений (per-change landing-проверка)      | `openspec list` → осталось 5 активных                                             |
| `d3cf9005` | fix: веб был 500 на КАЖДОЙ странице (лишнее `.js` в `search.ts`)             | любая страница из исходников открывается (не docker-образ)                        |
| `f7ca631d` | seed: C3-активности видны из коробки                                         | см. «C3» ниже                                                                     |
| `33358aa1` | lock: методы lineage-замка `?`→required (репо без метода падает компиляцией) | гейт зелёный; поведение замков не изменилось                                      |
| `5ed9f289` | fill-from на reopened-периоде: кнопка disabled + tooltip                     | см. «fill-from» ниже                                                              |
| `d98f4548` | тест carry-over-баннера (клик copy-forward)                                  | `pnpm test`                                                                       |
| `d03f4b6f` | doc-статус                                                                   | —                                                                                 |

Гейт на момент коммитов: typecheck 5/5 · unit (shared 14 / api 123 / web 148) · lint чист · integration 256 passed | 4 skipped.

## Как поднять и проверить ЛОКАЛЬНО

**Важно:** docker web/api отдают УСТАРЕВШИЙ образ. Живую проверку делай из ИСХОДНИКОВ.

1. **БД:** postgres+redis подняты через docker. Если dev-БД со старой схемой (симптом при сиде: `P2022 ColumnNotFound`) — полный reset нужен, `migrate deploy` не переприменяет hand-edited init:
   ```bash
   PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes ./apps/api/node_modules/.bin/prisma migrate reset --force   # из корня
   PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes pnpm db:fresh:simple                                          # reset+seed
   ```
   Активный период сидится как `2026-06-29..07-05`, активный отчёт = `a0000000-0000-4000-8000-000000000001`.
2. **Приложение из исходников:** `pnpm dev` (next+nest, порты web :3000 / api :3002). НЕ `docker` для живой проверки.
3. **Вход (dev-login, роль в URL):**
   - admin: `/auth/dev-login?role=admin&email=admin@customreport.local&redirect=/admin`
   - lead: `/auth/dev-login?role=lead&email=lead1@customreport.local&redirect=/lead/report`
   - lead Мария (submitted-секция, для review-панели): `…&email=maria@customreport.local…`
   - head: `/auth/dev-login?role=head&email=head@customreport.local&redirect=/head/report`

### Что смотреть

- **C5 адаптив:** `/lead/report` на ширине **360** и **768** — рефлоу в одну колонку ↔ многоколоночный канбан, тулбар иконки↔текст.
- **C5 stacked review comments (360):** зайди как **Мария** → вверху панель «Reviewer feedback», комментарии головы стекаются вертикально. **Не в seed** — вставь вручную (иначе панель пустая):
  ```sql
  -- docker exec -i customreport-postgres-1 psql -U customreport -d customreport_dev
  INSERT INTO "RecordComment" (id,"reviewerId",text,"itemId","createdAt","updatedAt") VALUES
   (gen_random_uuid()::text,'a0000000-0000-4000-8000-000000000099','Добавь оставшиеся 3 регресс-кейса до пятницы.','a0000000-0000-4000-8000-000000052001',now(),now()),
   (gen_random_uuid()::text,'a0000000-0000-4000-8000-000000000099','Уточни список провайдеров для ревью безопасности.','a0000000-0000-4000-8000-000000052002',now(),now()),
   (gen_random_uuid()::text,'a0000000-0000-4000-8000-000000000099','Приложи ссылку на прогон smoke в CI.','a0000000-0000-4000-8000-000000052003',now(),now());
  ```
  (Хочешь «из коробки» — скажи, добавлю в seed как сделал с C3.)
- **C3 полоса активностей:** голова → `/head/report/a0000000-0000-4000-8000-000000000001?mode=slides&scope=lead` — под именем автора лента пилюль (green/yellow/red). **Ключ: scope = Leads, не Product** (в Product полоса пуста by design — активности author-scoped). Также видно на форме лида в блоке «Project Activities».
- **fill-from на reopened:** переоткрой период (admin → periods → reopen) → у лида кнопка «Fill from previous» становится неактивной с подсказкой, а не падает.

## Что осталось (не автоматизировал — нужен ты)

1. **`head-surface-parity-declutter`** — косметика ЭКРАНОВ ГОЛОВЫ (dashboard/report/slides), НЕ «source». «parity» = сделать контролы головы как у лида; «declutter» = убрать лишнее. Приземлилась только 1 задача (компактные KPI-карточки, `09a3baa4`). Не сделано и требует ТВОЕГО вкуса (это дизайн-решения, не механика):
   - убрать дублирующую строку-заголовок «Group Status Slides», контролы наверх;
   - Agent-review в строку навигации по периодам; судьба `ReadinessStrip`;
   - починить горизонтальный скролл `LeadSummaryTable`;
   - обрезать малополезный `Activity24hCard`;
   - разложить publish/reopen-all/Agent-review/Edit как у лида, убрать кнопку «Present».
     Открой `/head/report` и `?mode=slides` — реши, что из этого реально нужно; остальное закрой как «не делаем».
2. **`ci-deploy-supplychain-hardening` (#32)** — human-gated: sha256-пины базовых образов, CSP `Report-Only`→`enforce` (проверка в браузере на 4 ролях), prod-приёмка. Нужен доступ к registry/prod.
3. **`tighten-comment-policy`** — в работе параллельной сессии, не трогал.
4. **`tighten-code-quality-ratchet`** — оставил, в этой сессии НЕ проверял (по handoff — plan-only; подтверди перед действиями).

## 2 находки — решение за тобой

1. **Inline-редактор текста пункта не подключён.** Фича `isEditing`/`onTextSave` в `item-card.tsx` есть, но все три места вызова передают `isEditing={false}` — редактируемый режим не монтируется нигде. Поэтому баг «обнуление текста опубликованной записи ломает автосейв» (C2 §3) НЕДОСТИЖИМ, и я откатил фикс, который сторожил мёртвый путь. Решение: удалить мёртвый код или доделать фичу?
2. **`observability §3.3` уже сделана** коммитом `4455edb1` (additive-only restore убрал per-user delete loop; чтения bulk-prefetch одним `findMany`). Её же **§3.6** («upsertUsers issues one deleteMany») теперь НЕвыполнима — при архивации observability эту строку надо снять, иначе кто-то реинтродюсит destructive-reconcile.

## Грабли (проверено этой сессией)

- Живая проверка веба — ТОЛЬКО из исходников (`pnpm dev`); docker-образ устаревший; гейт (tsc/vitest) НЕ ловит webpack-ошибки резолва модулей (см. `.js`-баг `d3cf9005`).
- dev/`_test` БД периодически со старой схемой → нужен `migrate reset` per-DB (не `deploy`).
- integration только single-thread: `cd apps/api && pnpm test:integration`; зелёно = `37 passed | 1 skipped`, `256 passed`.
- vitest не оборачивать в `rtk` (мис-парсит TSX → «0 tests»); `pnpm exec vitest` или `rtk proxy pnpm exec vitest`.
- push: `SKIP_PREPUSH=1` (pre-push падает на prettier чужих openspec-файлов — предсуществующий долг); мой код prettier-чист, гейт прогнан вручную.
- shared tree: не стейджить `apps/api/src/modules/auth/*`, `docs/exemplary-*`, `docs/audit/`, `openspec/changes/tighten-comment-policy/` (параллельные сессии).
