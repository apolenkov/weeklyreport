# Демо-фидбэк 2026-06-23 — head-поверхности (живой журнал)

Статус: **ГРИЛЛ ПРОВЕДЁН; решения зафиксированы** (см. секцию «ЗАФИКСИРОВАННЫЕ
РЕШЕНИЯ» ниже). Verify-пункты (D1/D3/D6) продиагностированы вживую. Осталось:
написать OpenSpec changes (explore/propose) — 3 change + research-трек.

Git на момент фиксации: локально на `main` == `origin/main` (**fc6bfeb4**).
Параллельная сессия смержила и запушила ветку `demo-feedback-2026-06-22` в main
(карусель `4d5709a9`+`b513c0ea`, demo-feedback-polish `43c2d571`+архив).
Стек поднят (`:3000`, API healthy).

ВАЖНО про часть C: карусель **уже отгружена в main**. Поэтому S1–S6 — это
доводка УЖЕ ОТГРУЖЕННОГО кода = НОВЫЙ change(ы), а НЕ правки «до архива».
Изменение `head-slides-carousel-fullscreen` числится Complete, но не
заархивировано (openspec housekeeping — заархивировать как есть, отдельно).

Легенда категорий:

- **fix** — конкретная починка, причину диагностируем вживую.
- **decision** — решение пользователя (убрать / как убрать).
- **verify** — «иди проверь», ответ из кода/живого прогона, не вопрос к юзеру.
- **seed** — правка демо-данных.
- **redesign** — открытый редизайн, research-first (варианты до реализации).

---

## A. `/head/dashboard` (партия 1)

- **D1** `fix` — `LeadSummaryTable` (`lead-summary-table.tsx`): стиль «квадратный»,
  отличается от остальных карточек; появляется неожиданный скролл.
  **ДИАГНОЗ (live):** таблица 1100px шире обёртки 1086px на ~14px; враппер
  `div.overflow-x-auto` превращает излишек в гориз. скролл. «Квадратность» =
  таблица с прямыми углами/линиями не совпадает с card-идиомой остальных карточек.
  Починка: ужать колонки/паддинги до влезания (убрать скролл) + строки в card-стиль.
- **D2** `decision` — `ProductKpiCard` (`product-kpi-card.tsx`): «может пока уберём?».
  Это рабочая фича (Phase 52, telemetry.summary, recharts ~130kB lazy). НЕ полу-готовая,
  ComingSoon не подходит. Развилка: unmount+TODO (обратимо) vs полное удаление вместе
  с recharts dynamic-import. Метрики ОТЛИЧАЮТСЯ от `KpiCards` — это вопрос ценности, не
  дублирования.
- **D3** `verify`→**БАГ ПОДТВЕРЖДЁН** — `BlockedAtRiskTable`: строки «… is flagged red»
  задвоены по лидам. **ДИАГНОЗ:** `buildEscalationsFromReadSections`
  (`published-report-snapshot.ts:247-260`) строит эскалацию product-level «flagged red»
  В ЦИКЛЕ ПО СЕКЦИЯМ (= по лидам): для каждого co-owner красного продукта пушится своя
  строка с его `leadName`. Текст одинаковый, инфо не добавляет. Нужна дедуп по продукту
  (одна строка на красный продукт). ⚠️ Та же функция кормит published-снапшот — фикс
  не должен сломать published. ОТДЕЛЬНАЯ change (bug-fix) + тест.
- **D4** `decision` — `Activity24hCard` (`activity-24h-card.tsx`): «не вижу смысла».
  Делит ровно ту же ленту `activity.live`, что и `ActivityLivePanel` сверху →
  избыточность реальна. Подтвердить, что `ActivityLivePanel` остаётся хозяином.
- **D5** `seed` — `LeadSummaryTable`: «сделай в примере так, чтобы хоть один лид
  отчитался, чтобы видеть как вернуть назад». Механизм «вернуть» = существующий Revoke
  (`revoke-lead-button.tsx` / Revoke All). Сейчас seed = все лиды In-progress, поэтому
  Revoke не появляется. Проверить per-lead Revoke, засидить одного лида submitted.
- **D6** `verify`→**РАБОТАЕТ МЕХАНИЧЕСКИ, НО МЁРТВО В ДЕМО** — `RemindLeadButton`
  зовёт `reminders.dispatchPending({reportId, leadId})`. **ДИАГНОЗ (live):** POST 200,
  но ответ `{dispatched:0, reason:"no-active-rule"}` — в seed НЕТ активного правила
  напоминаний → клик ничего не шлёт, кнопка мигает «Retry»(error), письма нет.
  Бэкенд reminders покрыт тестами (contract/integration/service); прямого
  компонент-теста на кнопку нет. НЕСОГЛАСОВАННОСТЬ: `AlertBar` прячет Remind при
  `!hasActiveReminderRule` (`canSendReminder`), а `LeadSummaryTable` показывает всегда
  → предлагает нерабочее действие. Решение: засидить активное правило (демо) + гейтить
  Remind в `LeadSummaryTable` тем же `hasActiveReminderRule` (как AlertBar).

## B. `/head/report` (accordion/edit, партия 2)

- **R1** `redesign` — `ProductAccordion` (`product-accordion.tsx:168`): «очень
  топорно/коряво получилось». Открытый редизайн.
- **R2** `redesign`/`fix` — `ProductAccordion` (другой продукт): лейауты не вровень,
  «текст прыгает», нужна чёткость по вертикали и горизонтали. «Нужен фронт-дизайнер».
  Полу-конкретное выравнивание + общий редизайн.

## C. `/head/report?mode=slides` (партия 3) — фидбэк по ТОЛЬКО ЧТО сделанной карусели

Карусель УЖЕ отгружена в main (`4d5709a9`+`b513c0ea`, origin/main). Эти правки =
НОВЫЙ change поверх отгруженного (`head-slides-lead-parity`), НЕ «до архива».

- **S1** `fix`/umbrella — `ViewModeToggle` → Slides: «при переходе в slides лейаут не
  должен особо меняться, как у лидов; а смотри что произошло». Зонтик над S2/S3/S6:
  head-slides должны зеркалить раскладку lead-slides.
- **S2** `decision`/`fix` — блок «Group Status Slides» (h1 + подзаголовок «Group deck
  ordered by review risk…» + «Open focused report») `status-slide-deck.tsx:~1073`:
  «появилась эта строка, дублирует [шапку], её вообще не должно быть. Вообще». → убрать
  заголовочный блок целиком.
- **S3** `fix` — кнопка «Open focused report»: «должна быть сверху, как у лидов, кнопочки».
  → перенести в верхний toolbar.
- **S4** ✓ ПОХВАЛА — `HeadSlideCarousel`: «парусель в правильном месте, это понятно».
  Размещение карусели подтверждено — НЕ трогать.
- **S5** `decision` — `ReadinessStrip` (`status-slide-deck.tsx:431`, добавлен в этом же
  изменении): «непонятно, что это, для чего». Пользователь не понимает ценность
  только что добавленной полосы готовности. Возможный откат/переосмысление.
- **S6** `fix` — `AgentReviewComingSoon` в шапке слайда: «зачем-то здесь оказалось;
  должна быть в строке где периоды кликаем, как у лидов». → перенести в toolbar/строку
  периодов.

---

## ЗАФИКСИРОВАННЫЕ РЕШЕНИЯ (grill 2026-06-23)

Контейнер: **сплит на 3 change + проверки** (не одна change).

**Change 1 — `head-dashboard-declutter`** (конкретные починки):

- D2+D4: **полное удаление** `ProductKpiCard` и `Activity24hCard` (компоненты +
  тесты + recharts-dep, если recharts больше нигде не нужен — проверить перед
  удалением). Activity24hCard дублирует `ActivityLivePanel`; ProductKpiCard — по
  ценности. `ActivityLivePanel` остаётся.
- D1: починить скролл `LeadSummaryTable` (ужать колонки/паддинги, чтобы таблица
  влезала в обёртку без `overflow-x-auto`-скролла) + привести к card-стилю.
- D5: seed — один лид **submitted**, чтобы появился Revoke («вернуть назад» =
  существующий per-lead Revoke / Revoke All, форма → Draft).
- D6: seed — **активное правило напоминаний** (чтобы Remind слал письмо) +
  гейтить Remind в `LeadSummaryTable` по `hasActiveReminderRule` (как `AlertBar`).

> **Статус Change 1 (2026-06-23): РЕАЛИЗОВАН + live-проверен.** Все 16 задач
> закрыты, гейты зелёные (typecheck/lint/test 1259/build), `openspec validate
--strict` валиден.
>
> - D2/D4: `ProductKpiCard` и `Activity24hCard` (+тесты +`activity-querykey`
>   дедуп-гард) удалены; `recharts` **оставлен** — он ещё нужен в
>   `reports/trends` и `@customreport/ui`.
> - D1: убран `min-w-[840px]` → `w-full` + паддинги ячеек `px-5`→`px-3`;
>   натуральная ширина таблицы 940px. На стандартном десктопе (1440px, контент
>   1086px) переполнения нет (live: overflow=0). Узкие окна (<~1000px) корректно
>   скроллят через `overflow-x-auto`.
> - D5: submitted-лид — **Мария К.** (чистый co-owner: не primary, не владелец
>   red-блокера, не двигает три цвета). Vasily+Igor остаются draft → период open.
>   Ортогональность подтверждена: `crossAuthorContent` берёт секции без фильтра
>   по статусу, Everyone-линза не теряет foreign-контент.
> - D5-побочное (решение пользователя): `submittedAt`=понедельник давал date-only
>   `lastActivity`, и эвристика «неактивен 24ч» затеняла submitted-строку Maria
>   (opacity-60), хотя она ровно ради Revoke. Детерминизм запрещает «свежий»
>   submittedAt → починили в `LeadSummaryTable`: **submitted-строки исключены из
>   24ч-затенения** (submitted = «готово», не «залежался»). Спека + тест на
>   date-only-полночь добавлены; 2 date-logic теста переведены на draft-фикстуру.
> - D6: seed `ReminderPolicy`(deadline)+`ReminderRule` на `ACTIVE_REPORT_ID`
>   (форма из `seed-simple`, fixed UUID `d…9000…`, только small-tier). Live:
>   Remind на draft-лиде реально отправил письмо в Mailpit, повторный клик →
>   «Already sent» (дедуп), на submitted-строке — Revoke.

**Change 2 — `head-slides-lead-parity`** (доводка отгруженной карусели):

- S2: убрать заголовочный блок «Group Status Slides» (h1 + подзаголовок +
  «Open focused report») целиком.
- S3: «Open focused report» → в верхний toolbar (как у лидов).
- S6: `AgentReviewComingSoon` → в строку периодов/toolbar (как у лидов), убрать
  из шапки слайда.
- S5: **убрать `ReadinessStrip` совсем** (у лидов нет; head-сигнал готовности, но
  в демо всегда 100% = пустой).
- S4: карусель НЕ трогать (одобрено).
- S1 — зонтик: проверить итог против lead-slides раскладки как эталона.

**Change 3 — `fix-flagged-red-escalation-dedup`** (bug-fix + тест):

- D3: дедуп product-level «flagged red» эскалаций по продукту (сейчас дубль на
  каждого co-owner'а). ⚠️ `buildEscalationsFromReadSections` кормит и
  published-снапшот — не сломать published; тест на дедуп.

**Research-трек (НЕ реализация) — `head-report-accordion-redesign`**:

- R1+R2: открытый редизайн ProductAccordion (выравнивание, «текст прыгает»,
  чёткость). Сначала варианты/скриншоты, отдельно от починок.

Housekeeping: заархивировать `head-slides-carousel-fullscreen` как есть до старта
Change 2 (она уже отгружена в main).

## Заметки для заморозки (предварительно)

1. Открытый редизайн (R1, R2, возможно S1) — отдельный research-трек, не в один change
   с починками (правило репо: визуальный редизайн research-first).
2. Часть C (S1–S6) — НОВЫЙ change поверх отгруженной карусели (она уже в main,
   fc6bfeb4). S5 может означать откат/переосмысление ReadinessStrip. Сначала
   заархивировать `head-slides-carousel-fullscreen` как есть (housekeeping).
3. D3 — если задвоение flagged-red это баг агрегации, отдельная починка + тест.
4. «Как у лидов» — повторяющийся мотив (S1, S3, S6): свериться с lead-slides раскладкой
   (`LeadSlideArticle` / lead toolbar) как с эталоном.
