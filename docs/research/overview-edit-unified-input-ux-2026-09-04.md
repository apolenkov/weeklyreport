# Объединение Overview и Edit для быстрого ввода WeeklyReport

Дата: 2026-09-04

Статус: UX brief принят с делегированием оставшихся решений; повторное ревью
после смены модели выполнено. Продуктовая реализация не менялась. Проверки
прежнего mockup ниже относятся к прежнему варианту, а не к новым решениям.

## Короткий вывод

Нужно не «подтянуть Edit к Overview», а оставить **одно рабочее полотно Report**
с двумя уровнями глубины:

```text
Report = увидеть + быстро ввести + сразу определить судьбу плана
Edit details = уточнить редкие структурные поля
Slides = отдельное представление результата
```

Основная единица интерфейса — не отдельная карточка в каждой неделе, а
**сквозная строка обязательства**: что было запланировано, что с этим произошло
сейчас и куда оно перешло дальше. Связь уже существует в домене через
`stableId`; её нужно сделать видимой.

Это решает одновременно четыре главные проблемы:

1. пользователь перестаёт искать одну работу в трёх несвязанных списках;
2. стадии и workflow-state становятся видимыми без перехода в Edit;
3. короткое добавление и правка происходят прямо в контексте строки;
4. высота текста и badge больше не двигают `Edit` и `Add update`.

До функционального паритета существующий Full Edit можно оставить как
временный fallback. После паритета отдельный `Overview | Edit` toggle следует
убрать: для обычного пользователя это один Report, а не два конкурирующих
способа заполнить один draft.

## Деноминатор исследования

Решение основано на одном проверенном срезе:

- ветка `feat/agentation-feedback`, `HEAD`
  `8796570475e7e94af00f0fce38472fccab1f8efc`;
- две пользовательские иллюстрации: полный Overview и крупный план соседних
  Current/Next cells с разным уровнем `Add update`;
- live inspection страницы
  `/lead/report/a0000000-0000-4000-8000-000000000001` в Overview и Edit;
- текущие projection, editor, draft merge, carry-over и lifecycle sources;
- действующие OpenSpec requirements;
- первичные рекомендации Carbon, Atlassian, W3C APG и MDN.

Проверка onUI на каноническом origin вернула пустой список страниц. Это не
заменяет и не обесценивает пользовательский feedback: в этой итерации он дан
через Agentation, чат и screenshots. Несуществующие onUI annotation IDs не
приписывались. Перед будущими UI-правками проверку нужно повторить по правилу
репозитория.

В worktree есть параллельные изменения вне исследуемых Overview sources. Они не
входят в этот документ и не затрагивались.

## Что в текущем Overview уже правильно

- Три временных контекста видны одновременно и заметно компактнее Full Edit.
- `Previously planned` берётся из авторитетного published predecessor snapshot
  или допустимого submitted-section fallback и в обоих случаях остаётся
  read-only.
- Overview и Edit уже используют один editor handle, draft merge, autosave и
  write path.
- Current и Next можно менять через существующий `ItemEditDialog` без второго
  API или локального draft store.
- Product health показывается только для требующих внимания состояний.
- Autosave text в Overview уже имеет `role="status"` и `aria-live="polite"`.

Поэтому визуальное направление Overview сохраняется. Нужна новая interaction
architecture внутри него, а не новый dashboard и не стилистический редизайн.

## Подтверждённые проблемы текущего состояния

| Проблема                             | Evidence                                                                                                                                                | Почему это мешает                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Три колонки — три независимых списка | `status-overview-projector.ts` уже сопоставляет predecessor/current по `stableId`, но `status-overview-row.tsx` рендерит три отдельные `TimelineColumn` | Не видно, что стало с конкретным обещанием                                   |
| Названия стадий скрыты               | `status-overview-summary.tsx:40-45` выводит только `N owned stages`; `StatusOverviewItem` не несёт `stageNames`                                         | Число стадий не говорит, к чему относится update                             |
| Workflow-state записи скрыт          | `status-overview-row.tsx:46-58` показывает только text и tag                                                                                            | `In progress`, `Done`, `Paused`, `Planned`, `Postponed` приходится угадывать |
| Действия прыгают по вертикали        | `status-overview-row.tsx:135-184`: `Add update` идёт обычным потоком после items; `ItemActionRail` зависит от высоты текста                             | Соседние одинаковые действия находятся в разных местах                       |
| Common path остаётся modal-only      | `lead-status-overview-item-editor.tsx:71-110` открывает полный `ItemEditDialog` и для add, и для edit                                                   | Короткая запись требует смены контекста и заполнения большой формы           |
| Два похожих draft-indicator          | live UI показывает `Autosaved` в document header и `Draft saved` в Overview header                                                                      | Пользователь не понимает, это режим, состояние или два разных сохранения     |
| Ниже 80 rem ломается сравнение       | `STATUS_OVERVIEW_DESKTOP_GRID` включается только с `min-[80rem]`; ниже cells складываются в длинный поток                                               | Tablet теряет главное преимущество Overview                                  |
| Дублируется верхний заголовок        | `lead-form-header-actions.tsx:68-76` уже рендерит `h1 My Report`, а `status-overview.tsx:89-94` добавляет второй `h1`                                   | Иерархия страницы хуже читается assistive technology                         |

Фраза «inline edit» к текущей реализации неприменима: сейчас кликабельный
preview открывает modal. Inline composer ниже — предлагаемое поведение.

## Рассмотренные варианты

| Вариант                                               |       Скорость ввода | Понятна судьба плана | Компактность | Риск                                             |
| ----------------------------------------------------- | -------------------: | -------------------: | -----------: | ------------------------------------------------ |
| A. Только выровнять текущие карточки                  |              средняя |               низкая |      высокая | косметика не решает модель пользователя          |
| B. Добавить inline edit в три текущих списка          |              высокая |               низкая |      высокая | одна работа всё ещё распадается на три места     |
| **C. Сквозные строки обязательств + inline composer** |          **высокая** |          **высокая** |  **высокая** | нужен новый presentation projection              |
| D. Полноценная spreadsheet-grid                       | высокая для эксперта |              средняя |      высокая | сложная focus model, тяжела для новичка и mobile |

Выбран C. W3C APG подчёркивает, что `role="grid"` превращает таблицу в composite
widget и требует собственного управления focus и стрелками
([WAI-ARIA APG Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)). Поэтому
первый этап использует обычные headings, lists, buttons, inputs и нативный Tab,
а не имитацию Excel.

## Рекомендуемая информационная архитектура

### 1. Один document header

```text
My Report · Aug 31–Sep 6                       Draft · Saved just now
[period] [Mine / Everyone]                         [Save] [Submit]
                                                      [Report] [Slides]
```

- Один state indicator: `Draft · Saving…`, `Draft · Saved just now`,
  `Changes not saved`, `Conflict`, `Read-only`.
- `Autosaved` и `Draft saved` не дублируются в двух местах.
- `Status overview` становится `h2` или визуальным section title, не вторым
  `h1`.
- `Edit` не остаётся отдельным равноправным режимом после достижения паритета.

### 2. Product header показывает реальные стадии

```text
Marketing portal                         Blocked
Stages: ● Authentication  ● Development  ○ Testing  +1
```

- В спокойном виде видны до трёх stage names с status indicator и `+N`.
- Цвет никогда не является единственным носителем статуса.
- `Show all stages` раскрывает полный список на месте или в details panel.
- Клик по stage открывает изменение только для напрямую редактируемого status.
  Если `Blocked`/`At risk` выведен из risk, chip ведёт к объяснению и
  `Risks & Blockers`, а не перезаписывает derived state.
- Для Project Activity вместо stage strip показывается её собственный status.

Это unit-level metadata. Stage конкретного product item также выводится в его
meta-zone; для этого presentation model нужно расширить `stageNames`.

### 3. Временные колонки объединяются через commitment lineage

```text
Previously planned        Current week                 Next week
Aug 24–30                 Aug 31–Sep 6                 Sep 7–13

Refactor authorization ── Refactoring complete         [empty]
Feature                    Done · Authentication

Architecture review ───── Still working                [empty]
Ops                        In progress · Continued

Architecture review ───── Moved to next week ───────── Architecture review
Ops                        derived outcome              Postponed · Ops

[empty]                    A/B tests                    [empty]
                           Not in prior plan

[empty]                    [empty]                      Prepare demo
                                                        Planned

                           [+ Add current update]       [+ Plan next week]
```

Каждая горизонтальная линия — один `stableId`:

- predecessor остаётся неизменяемым evidence;
- current/next occurrence получает actions;
- клик по predecessor только переводит focus к связанной editable occurrence и
  кратко подсвечивает её;
- при доступном predecessor несвязанная работа получает нейтральное пояснение
  `Not in prior plan`; отсутствие связи не доказывает дату создания;
- при unavailable predecessor отсутствие связи неизвестно: это пояснение не
  показывается;
- перенос в Next остаётся в той же строке, поэтому исчезает вопрос «куда это
  делось?».

`[empty]` в схеме означает зарезервированный layout slot, а не видимый
decorative placeholder. Для assistive technology он получает контекст
`No linked update`; визуально пустая cell не заполняется тире.

Над таблицей полезен мягкий coverage summary:

```text
Previous plan: 3 of 4 accounted for · 1 needs attention
```

Знаменатель — число уникальных predecessor items по `stableId` только при
доступном authoritative previous source. `Accounted for` означает, что тот же
`stableId` найден в Current или Next либо для него сохранён terminal resolution.
Это учёт судьбы, не процент выполненной работы. Разбивка: `Done`, `In progress`,
`Paused`, `Planned next week`, `Postponed`, `Won't do`, `No update yet`.
Пропавшие identity не сопоставляются по похожему тексту; неизвестные связи
показываются отдельно, без искусственного улучшения coverage.
Если predecessor unavailable, metric полностью скрыт, а не показывает `0 of 0`.

Это guidance, а не hard submit gate: ленивому пользователю помогает завершить
отчёт, но не блокирует работу из-за несовершенной исторической записи.

### 4. Risks, decisions и completion guidance не прячутся в другом режиме

Чтобы действительно убрать конкуренцию Overview/Edit, оставшиеся сущности
нужно постепенно вывести в тот же Report:

- stage/activity status — в unit header;
- risks и decisions — компактные секции `Attention` ниже timeline с inline
  add/edit;
- completion guidance — одна contextual banner только при незаполненных
  обязательных данных;
- priority, parent и paused reason — через `Edit details`.

Пока этого паритета нет, `Full editor` остаётся вторичным fallback, а не
параллельным основным способом заполнения.

## Стабильная геометрия без пустых «простыней»

Ровность должна обеспечиваться внутри одной unit row, а не общей фиксированной
высотой всех Products.

```text
cell
├─ records zone
│  └─ record
│     ├─ text: preview до 2 строк, полный текст по Show more
│     ├─ meta: stage · workflow · continuity
│     └─ action rail: фиксированный слот
├─ +N more / Show less
└─ footer action: margin-top: auto
```

Правила:

- idle preview может резервировать две строки при обычном масштабе; это не
  жёсткая высота карточки. Zoom, перенос metadata и раскрытие текста увеличивают
  общую строку; содержание никогда не перекрывает controls;
- длинный текст раскрывается явным `More`, не только title/tooltip;
- badge не меняет ширину text-zone и не двигает `Edit`;
- Current и Next footer actions закреплены у нижней границы общей unit row;
- раскрытие `+N more` управляет сквозными строками всей unit, а не независимым
  числом элементов каждой lane; порядок и focus сохраняются;
- разные Products могут иметь разную высоту по числу записей: искусственное
  выравнивание всего отчёта породило бы большие пустоты;
- nested card soup не добавляется: записи разделяются линиями и whitespace,
  а не отдельными тяжёлыми карточками.

Именно отсутствие `flex column`/закреплённого footer в
`status-overview-row.tsx:189-230` объясняет дефект на пользовательском crop.

## Быстрый ввод для ленивого и неопытного пользователя

Carbon рекомендует inline creation для простой записи, когда контекст страницы
важен, а более сложные формы — для отдельного modal/side-panel
([Carbon Create flows](https://carbondesignsystem.com/community/patterns/create-flows/)).

### Add

После `Add current update` composer раскрывается внутри выбранной cell:

```text
What happened this week?
[ Finished refactoring the authorization module…             ]

Stages (required): [Authentication] [Development] [More…]
Progress: [In progress ▾]

[Save update] [Cancel]                         [Edit details]
```

Для Next placeholder меняется на `What will happen next week?`.

- unit и week уже известны из места запуска и повторяются текстом над form;
- Current получает default `in_progress`, Next — `planned`;
- default виден в компактном Progress control; пользователь может выбрать
  Done до сохранения, не открывая полный dialog. Текст не интерпретируется
  автоматически как статус; Paused раскрывает обязательную причину;
- product item требует одну или несколько допустимых stages; текущая
  multi-stage модель сохраняется;
- единственная owned stage выбирается автоматически;
- при нескольких стадиях выбор рядом с текстом; запуск из конкретной stage
  предзаполняет именно её. Произвольный первый stage и скрытый global default
  не выбираются;
- activity item не получает stage control;
- `Edit details` открывает существующий dialog с уже введённым text/stage;
- один editor владеет draft, save и reconciliation. Несохранённый текст composer
  имеет явный локальный editing-state; это не второй autosave/store. Передача
  в details, смена lane и попытка Submit его не теряют;
- Add и Edit открываются за одно действие. Save/Cancel всегда подписаны;
  Mod+Enter ускоряет Save, Enter остаётся переносом строки;
- до подтверждённого server save текст остаётся восстановимым, при ошибке
  доступны Retry и Cancel. `Saved` не обозначает несохранённый composer;
- для последовательного ввода есть необязательный `Save and add another`;
  обычный Save возвращает focus к записи.

### Edit

- Клик по text или `Enter` открывает тот же inline composer.
- Быстрая правка меняет text; stage также доступна компактно.
- `Edit details` отвечает за priority, parent, workflow details и paused reason.
- `Enter` в textarea создаёт новую строку, `Mod+Enter` сохраняет.
- `Escape` отменяет незакоммиченную правку.
- Blur ничего молча не коммитит и не уничтожает.
- После Save focus возвращается к изменённой записи; после Add — к созданной.
- Validation находится под конкретным полем.

Atlassian описывает inline edit как переход между read/edit в том же контексте
и требует оставлять actions доступными, а не полагаться на blur
([Atlassian Inline edit](https://atlassian.design/components/inline-edit),
[Forge inline edit accessibility](https://developer.atlassian.com/platform/forge/ui-kit/components/inline-edit/)).

## Судьба previously planned: точная доменная карта

`Previously planned` нельзя редактировать или удалять. Действие применяется к
current/next occurrence с тем же `stableId`.

| Где запись сейчас              | Пользовательское действие | Поддержка             | Канонический результат                                                                                    |
| ------------------------------ | ------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| Previous + linked Current      | `Still working`           | уже представимо       | Current `in_progress`, projection показывает continuation                                                 |
| Previous + linked Current      | `Done`                    | уже есть patch        | Current `done`, `stableId` сохранён                                                                       |
| Previous + linked Current      | `Move to next week`       | уже есть patch        | одним patch: `type=next`, `postponed`, `carriedOver=false`                                                |
| Previous + linked Current      | `Pause`                   | уже есть patch        | Current `paused` + обязательный non-blank reason                                                          |
| Previous без linked occurrence | `Plan again`              | команды сейчас нет    | новая server-resolved command создаёт Current/Next с тем же `stableId`; arbitrary client lineage запрещён |
| Current                        | `Done`                    | поддержано            | `workflowStatus=done`                                                                                     |
| Current                        | `Move to next week`       | поддержано            | `type=next`, `workflowStatus=postponed`                                                                   |
| Current                        | `Pause`                   | поддержано            | `workflowStatus=paused`, reason обязателен                                                                |
| Next                           | `Move to current week`    | поддержано            | `type=current`, `workflowStatus=in_progress`                                                              |
| Next                           | `Postpone`                | поддержано            | остаётся Next `postponed`; auto carry-over дальше исключён                                                |
| Next                           | `Done`                    | отдельной команды нет | нужен один атомарный `next -> current + done` draft operation либо два объяснённых шага                   |
| Любая                          | `Won't do`                | отсутствует           | нужен отдельный per-record outcome/resolution с причиной, actor и timestamp; это не workflow status       |

Критические различия:

- `Continued` / `Not in prior plan` — presentation continuity, не workflow status;
- `Blocked` — risk-derived overlay, не workflow status;
- `Postponed` — «осознанно отложено и не переносится автоматически»;
- `Won't do` — «работу делать не будем», это другой финальный исход;
- `Delete` исправляет ошибочно созданный never-published draft record и не
  является способом отказаться от обещания.

`stableId` технически можно повторно использовать в другой section: DB
уникальность ограничена парой `[reportSectionId, stableId]`, и carry-over уже
создаёт новый physical `id` с сохранённым lineage. Но нынешний quick-add не
имеет безопасного predecessor contract. Поэтому `Plan again` должен быть новой
серверной командой, которая сама разрешает predecessor, проверяет доступ,
target section, отсутствие occurrence-дубликата и допустимые parent/stage, а не
принимает произвольный `stableId` от браузера.

Evidence: `prisma/schema.prisma:615,643`,
`apps/api/src/modules/carry-over/carry-over-clones.ts:16-28`,
`status-overview.ts:51-55` и
`lead-form-draft-merge-helpers.ts:151-161`.

Для unmatched Previous прямые `Done`, `Pause` и `Move to next` сейчас
неканоничны: occurrence, к которому применим lifecycle patch, ещё не существует.
Это ограничение нынешних patch-команд, а не запрет на удобный UX. Принятый
`Resolve plan` должен атомарно создать нужный editable occurrence через новую
серверную команду и записать выбранный исход. Он никогда не правит predecessor.
Подробный контракт принятого решения приведён ниже.

Jira также разделяет положение в workflow и resolution, включая `Done` и
`Won't do`; это подтверждает различие, но не диктует WeeklyReport schema
([Atlassian statuses and resolutions](https://support.atlassian.com/jira-cloud-administration/docs/what-are-issue-statuses-priorities-and-resolutions/)).

### Почему не drag-and-drop

Drag может быть необязательным ускорителем позже, но не основной командой:

- точное последствие переноса неочевидно;
- keyboard/touch требуют полноценной альтернативы;
- `Move`, `Postpone`, `Pause` и `Won't do` имеют разную семантику;
- ошибочный жест слишком легко меняет недельное обязательство.

Базовый control — подписанный outcome/menu, типизированный по текущей колонке:

```text
Current: Done · Still working · Move to next week · Pause
Next:    Move to current week · Keep planned · Postpone
```

Плоское универсальное меню `Change progress` недопустимо: например, `done` не
валиден для `type=next`, а `paused` требует current и reason.

## Draft, loading, error и read-only states

| State                        | Что видит пользователь                                 | Поведение                                                      |
| ---------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| Loading                      | skeleton unit header + period cells                    | geometry не прыгает после загрузки                             |
| Empty report с writable unit | одна инструкция и первый `Add update`                  | нет тупика без CTA                                             |
| Нет Product/Activity         | объяснение назначения reporting unit                   | ложный `Add update` не показывается: у item должен быть parent |
| Empty cell                   | `No updates yet` + add для writable lane               | Previous остаётся без ложного CTA                              |
| Saving                       | `Draft · Saving…` рядом с document title               | `aria-live="polite"`, без modal                                |
| Saved                        | `Draft · Saved just now`                               | не дублируется в section header                                |
| Validation                   | сообщение под text/stage/reason                        | введённое не теряется                                          |
| Conflict                     | `Report changed elsewhere` + `Reload` / `Keep my text` | локальный composer сохраняется                                 |
| Read-only                    | `Read-only` + видимая причина                          | add/edit отсутствуют, не просто disabled без объяснения        |
| Submit incomplete            | contextual completion banner                           | ведёт к первой незаполненной сущности                          |

MDN рекомендует сохранять по `visibilitychange`, а `beforeunload` подключать
только при несохранённых изменениях
([MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)).
Существующие debounce, optimistic locking и reconciliation остаются
авторитетными; меняется их видимое представление, не persistence model.

## Responsive contract

### Desktop, от 1280 px

- unit identity + три равные temporal lanes;
- stage strip находится в unit header и не отнимает вертикальную полосу у всех
  records;
- linked records выровнены по lineage;
- footer actions Current/Next стоят на одной горизонтали.

### Tablet, 768–1279 px

- unit header занимает всю ширину;
- под ним три компактные temporal lanes, если каждая сохраняет читаемую ширину;
- при недостатке ширины включается один общий переключатель
  `Prior | Current | Next`, а не длинный последовательный stack;
- горизонтального document overflow нет.

### Mobile, до 767 px

```text
Marketing portal       Blocked
Authentication · Development · +2

[Current] [Next] [Prior]

Current week
Refactoring complete
Done · Authentication

[Add current update]
```

- по умолчанию открыт Current;
- один period виден за раз;
- touch target минимум 44 x 44 px;
- `Save`, `Cancel`, `Edit details` идут в одном неизменном порядке;
- никакое действие не доступно только по hover, swipe или drag.

## Web Interface Guidelines audit

Текущий код уже использует настоящие `button`, видимый `focus-visible` и live
region для autosave в Overview. Это сохраняется. До приёмки единого Report
обязательны следующие проверки:

- заменить второй page-level `h1` на правильный section heading;
- не оставлять длинный user-generated text без явного clamp/disclosure;
- lifecycle action доступен по keyboard и touch, а не только по hover/gesture;
- disabled/read-only control имеет видимое объяснение рядом, не только `title`;
- async save и conflict имеют постоянный inline status, не только toast;
- ошибки формы связаны с полями через description/error semantics;
- loading skeleton резервирует итоговую geometry;
- document не получает horizontal overflow ни в одном target viewport;
- focus не исчезает после add, save, cancel, move и disclosure;
- motion ограничивается полезной обратной связью и уважает
  `prefers-reduced-motion`.

## Anti-slop ограничения

- Не делать новый набор dashboard cards поверх уже существующей матрицы.
- Не добавлять gradients, glow, декоративные большие заголовки или
  «AI-dashboard» эстетику.
- Не прятать stage/status/reason только в tooltip.
- Не использовать icon-only для смысловых lifecycle actions.
- Не открывать modal для обычного короткого update.
- Не плодить `Quick edit`, `Edit`, `Full edit`, `Advanced edit` как четыре
  конкурирующих термина: остаются `Edit` и `Edit details`.
- Не выравнивать весь отчёт огромными fixed-height cards; стабилизировать
  anatomy внутри unit row.
- Не показывать пять разноцветных badges одновременно. Один workflow state,
  одна attention health и при необходимости одна continuity note.
- Не менять art direction, palette, typography и tokens: меняются содержание,
  hierarchy и interaction model.

## OpenSpec и domain impact

Текущая реализация следует двум действующим решениям, которые новый UX частично
пересматривает:

- `process-current-feedback-batch/proposal.md:14-26` требует сохранять
  отдельный Edit и запрещает новый status;
- `process-current-feedback-batch/specs/lead-status-overview/spec.md:3-24`
  разрешает подробным stages, activity status, risks, decisions и guidance
  оставаться в Edit;
- `add-compact-lead-status-overview` закрепляет три режима
  `Overview | Edit | Slides` и immutable Previous.

Immutable Previous и один editor/draft/write coordinator сохраняются.
Ограничение «нет нового API» пересматривается: lineage-команды расширяют этот
же coordinator и server boundary. Удаление отдельного Edit после паритета, `Won't do` и
`Plan again` нельзя реализовывать «тихо»: нужен новый OpenSpec change, явно
superseding эти границы. `Won't do` также требует domain term и решения о
persistence; реализация должна обновить `CONTEXT.md`, ADR и OpenSpec согласованно.

## Проверяемая acceptance matrix

### Данные

- minimum: 1 Product, 1 owned stage, 1 Current item;
- typical: 4 Products, 3 Activities, смешанные statuses, previous/current/next
  lineage и 1–2 updates в lane;
- maximum: 20+ units, 7+ stages, 5+ items в lane, 500-char text, длинные unit и
  stage names;
- orphan Previous без linked occurrence; выбран server-resolved reuse
  `stableId`, arbitrary client lineage запрещён;
- activity item без stage;
- one-stage и multi-stage Product.

### Поведение

- linked Previous/Current/Next читаются одной строкой по `stableId`;
- Previous не испускает writes;
- Current `Done`, `Pause`, `Move to next` сохраняют identity;
- Next `Done` не отправляется двумя независимыми patch-ами;
- Product quick add не сохраняется без stage; one-stage auto-select работает;
- `More details` сохраняет введённый inline draft;
- `Mod+Enter`, `Escape`, Tab order и focus return проверены;
- long text и badge не двигают action slots;
- раскрытие `+N more` сохраняет focus;
- conflict не стирает локальный text;
- archived, locked, historical и foreign item occurrences read-only;
- `Delete` не доступен как outcome для published lineage;
- root horizontal overflow отсутствует.

### Viewports и gates

- 1280 x 900;
- 1728 x 962;
- tablet около 1024 px;
- mobile около 390 px;
- browser: keyboard, focus, console, network, loading/empty/error/read-only;
- code gates после реализации: targeted tests, `pnpm typecheck`, `pnpm lint`,
  `pnpm test`, `pnpm build`, `pnpm spec:check`.

## Decision mockup

Для продуктового выбора собран disposable interactive mockup вне репозитория.
Это не реализация и не доказательство интеграции с draft/API. Он показывает
рекомендуемую ветвь решения:

- один `Report` с единым `Draft · Saved just now`;
- Product-scoped stage names и derived health; Activity-ветка без stage selector
  остаётся отдельным acceptance-сценарием;
- строки Previous/Current/Next, связанные одной судьбой обязательства;
- двухстрочные previews и выровненные footer actions;
- inline add/edit с обязательной Product stage, раскрытием длинного текста и
  сохранением focus;
- типизированный `Outcome`; исследуемый `Won't do` явно помечен как proposal,
  принимает причину только для preview и не изображает сохранение;
- исследуемый `Plan again` раскрывает явный выбор Current/Next, затем prefilled
  inline composer; результат остаётся несохраняемым proposal preview до
  решения о capability;
- один period за раз на mobile.

Playwright-проверка mockup:

- 1728 px: все три cells внутри каждой commitment row имеют одинаковую высоту,
  а три footer cells начинаются на одной координате;
- 1024 px: add → text → stage → save создаёт новую строку, показывает
  `Added this week` и возвращает focus на `Edit`;
- 736 px: Product metadata переносится над тремя timeline columns, без тесной
  четвёртой колонки;
- 390 px: `Current | Next | Prior` переключает один period, минимальная высота
  видимых buttons 44 px; пустые rows выбранного period не резервируют большие
  пустые blocks;
- на всех трёх ширинах root horizontal overflow отсутствует;
- native edit buttons работают с keyboard; `Escape` закрывает/cancels inline
  composer, outcome reason и proposed replan, `Cmd/Ctrl+Enter` сохраняет
  валидный composer;
- proposed `Plan again → Plan in Next week` переключает mobile на Next,
  открывает prefilled text/stage composer, скрывает конкурирующий footer add и
  по `Escape` возвращает Current + focus на `Plan again` без записи;
- app script выполняется без console errors/warnings; прямой временный HTTP
  harness дополнительно пишет только несвязанный `favicon.ico` 404.

Mockup намеренно содержит `Won't do` и `Plan again` только как маркированные
proposal previews. Они не меняют `Draft · Saved…`, coverage и canonical row,
пока capability и lineage не приняты в domain/OpenSpec.

## Дерево продуктовых решений

Раунд 1 закрыт ответом пользователя `Поехали` от 2026-09-04. Он зафиксирован как
принятие трёх рекомендованных корневых решений; если это была команда начать, а
не согласие с рекомендациями, эту интерпретацию нужно исправить до реализации:

1. **Один Report.** Full Edit остаётся fallback до доказанного parity, затем
   исчезает из основного переключателя; Slides остаётся отдельным.
2. **Terminal `Won't do`.** Это новый per-record resolution/outcome, а не шестой
   `workflowStatus`; reason, actor и timestamp обязательны.
3. **`Plan again` для unmatched Previous.** Сервер сам разрешает predecessor и
   создаёт occurrence в Current или Next с тем же lineage; произвольный
   `stableId` от клиента запрещён. Запись происходит только по явному Save.

После ответа «Да, я, в принципе, согласен» и явного делегирования «сам собой
прогрылись, я тебе доверяю» оставшиеся варианты разрешены агентом в пределах
исходной задачи. Новый раунд разрешений не нужен; принятие UX brief не означает
приёмку ещё не реализованного интерфейса.

## Принятый UX brief

1. Финальная цель — один режим Report; Slides остаётся отдельным.
2. Full Edit временно живёт как fallback до parity, затем исчезает из основного
   переключателя.
3. Timeline строится по `stableId` как строки судьбы обязательства.
4. Product header показывает stage names/status; item показывает конкретные
   stages и workflow state.
5. Common add/edit — inline; редкие поля — `Edit details`.
6. Previous read-only; actions всегда применяются к linked current/next
   occurrence.
7. Явные lifecycle verbs важнее drag-and-drop.
8. `Not in prior plan` заменяет `Unplanned` только при известном previous source.
9. Общие строки и закреплённые action slots выравнивают содержимое; текст
   доступен полностью, масштабирование не ограничено fixed-height cards.
10. `Won't do` и `Plan again` требуют отдельного domain/OpenSpec change с
    server-resolved lineage и audit trail.

## Принятые продуктовые решения: раунд 1

1. Один финальный режим Report и удаление видимого Edit toggle после parity —
   **да**.
2. Отдельный terminal outcome `Won't do` с обязательной причиной — **да**; это
   не `Delete`, `Done` или `Postponed`.
3. Явный server-resolved `Plan again` для predecessor без linked occurrence —
   **да**.

## Принятые продуктовые решения: раунд 2 и самопроверка

### Обратимость и охват

4. `Won't do` можно отменить, пока section действительно editable. Доступное
   постоянно `Restore plan` восстанавливает прежние type/status/reason из
   сохранённого состояния; короткий toast Undo лишь ускоритель. Submitted
   требует существующего reopen/revoke lifecycle. Published snapshot не
   переписывается: более позднее возобновление создаёт occurrence с тем же
   lineage. Audit сохраняет сам отказ и его отмену.
5. Outcome доступен для Item в Current и Next, включая ещё не опубликованные
   задачи; работает одинаково для Product и Activity. Для Product сохраняется
   multi-stage validation, у Activity stages отсутствуют. Risks и Decisions
   имеют свои модели и этим outcome не изменяются. Delete исправляет ошибку
   ввода и не заменяет отказ от реально намеченной работы.
6. Unmatched Previous получает одно явное `Resolve plan`. Внутри — Done,
   Continue this week, Plan next week, Won't do. Историческая запись остаётся
   read-only, действие записывается в текущий editable контекст.

### Быстрые переходы без лишней цепочки подтверждений

| Действие                          | Результат                                        | Взаимодействие                                                        |
| --------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| Resolve plan → Done               | Current/done с тем же lineage                    | Два действия: открыть меню, выбрать Done; затем доступен Undo         |
| Resolve plan → Continue this week | Current/in_progress                              | Предзаполненный inline composer, Save; unit/week/stages уже известны  |
| Resolve plan → Plan next week     | Next/planned                                     | Тот же composer сразу в нужной lane, без промежуточного выбора недели |
| Resolve plan → Won't do           | Terminal resolution в текущем editable контексте | Inline reason и одна кнопка Confirm; отдельный второй modal не нужен  |
| Existing Current → Plan next week | Next/planned, identity сохранена                 | Явный перенос, возвращаемый через Change outcome; без новой копии     |
| Next → Postpone                   | Next/postponed                                   | Видимое пояснение: автоматического переноса не будет                  |

Для быстрого Done сервер проверяет predecessor, ownership, editable-state,
version и допустимость parent/stages. Если нужны новые данные, раскрывается
только недостающее поле вместо безусловного длинного мастера. Двойной клик или
повтор запроса не создаёт дубликат. Если linked occurrence уже появился, UI
переходит к нему; сервер не создаёт второй.

Эти direct outcomes — новые команды, а не существующие возможности patch API.
Все они проходят через один editor/write coordinator: несохранённые локальные
изменения согласуются по version, save echo не стирает composer. `Won't do`
исключает carry-over и отображается в report/export/history. Raw workflowStatus
не должен выдавать отменённую работу за активную или Done в counts/health.

### Поправки повторного ревью

- **P1 — Plan next и Postpone имеют разный смысл.**
  `lead-item-actions.ts:13-15` сейчас сохраняет next/postponed, тогда как
  `apps/api/src/modules/carry-over/carry-over-plan.ts:50-55` исключает postponed.
  Новая команда Plan next должна сохранять next/planned и участвовать в
  штатном carry-over. Старые postponed автоматически не переклассифицируются.
  Раздел выше о текущих patch-командах — аудит baseline, не целевой контракт.
- **P1 — один lineage не равен двум editable records.**
  `prisma/schema.prisma:643` запрещает два одинаковых stableId внутри section.
  Current/Next для одного lineage содержат максимум один persisted occurrence;
  `Moved to next week` в другой lane — вычисленное пояснение, не вторая запись.
  Смена Product/Activity не создаёт дубль: matching выполняется по section/author
  и lineage до группировки по parent; старый parent показан как контекст.
- **P1 — summary не должен врать о сохранении.** Локальный незавершённый composer
  и серверный Saved — разные факты. Submit сначала показывает незавершённую
  правку; Save/Cancel не теряют текст. Published/current read-only определяется
  canonical lifecycle, а не наличием текста Draft в интерфейсе.
- **P1 — default In progress должен быть виден.** Быстрый ввод не анализирует
  русский текст «завершил». Progress доступен рядом с текстом с самого начала.
- **P2 — badge не доказывает дату создания.** Projector сравнивает stableId,
  поэтому `Added this week` заменено на `Not in prior plan`. Unknown source
  не превращается в утверждение об отсутствии плана.
- **P2 — компактность без потери читаемости.** Выравниваются строки и footer,
  а не весь отчёт по самой большой карточке. Show more, zoom 200%, text-spacing
  и длинные stage names не перекрывают действия. 44×44 px — выбранная цель
  удобства для touch; WCAG 2.2 AA 2.5.8 задаёт 24×24 CSS px с исключениями,
  а не безусловное требование 44×44.

Основания: [W3C Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
[Atlassian Inline edit](https://atlassian.design/components/inline-edit/),
[Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
Первичные источники подтверждают взаимодействие и accessibility; выбор
семантики WeeklyReport основан на его коде и делегированном продуктовом решении.

### Приёмка реализации

- Add/Edit: один click до поля ввода; при единственной stage нет обязательного
  повторного выбора; никакого modal на обычном пути.
- Done для валидного prior plan: menu + Done, с постоянной возможностью
  исправления до потери editable-state. Won't do: reason + один Confirm.
- У Current/Next actions совпадает вертикальная координата footer в одной
  unit; metadata не меняет ширину текста; async save не пересортировывает
  активную строку и не отбирает focus.
- Видны stage names, progress и lifecycle. Статус сохранения не объявляет
  несохранённый ввод сохранённым; network error/retry/conflict сохраняют текст.
- Никаких duplicated stableId, изменения predecessor или молчаливого
  переприсвоения parent/stage. Plan next появляется в следующем периоде;
  Postpone и Won't do не переносятся автоматически.
- Проверяются Product + Activity, risks + decisions + statuses + submit
  guidance. Edit toggle удаляется только после перечисленного parity.
- 1280×900, 1728×962, tablet 1024 и mobile 390; zoom 200%; keyboard-only,
  reduced motion, loading/empty/error, min/typical/max из матрицы выше.
- Функциональные проверки и browser evidence относятся к реальному source
  runtime. Прежний mockup не доказывает новые серверные команды.

Граница задачи: `/lead/report/:reportId` и связанные contract/write/render
пути; не повторная полировка `/feedback` или `/admin?tab=ai`. Текущая ветка,
английские UI strings, дизайн-токены и чужие изменения сохраняются. Commit,
push, deploy и разрушительные операции с БД требуют отдельного запроса.

## Completion audit

| Требование цели                                        | Авторитетное evidence                                                  | Статус                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------- |
| Первичные UX-источники                                 | W3C APG, Carbon, Atlassian и MDN связаны с конкретными решениями выше  | доказано                                       |
| Аудит текущего кода, OpenSpec и live UI                | denominator и source table; SHA `879657047…` совпадает с remote branch | доказано для указанного SHA                    |
| Один Report, stages, draft и inline/full-edit contract | разделы 1–4 и принятый brief                                           | принято как направление реализации             |
| Однозначные `done/continue/defer/drop` semantics       | baseline table и новые принятые переходы                               | определено; новые команды требуют реализации   |
| Desktop/mobile и keyboard/focus                        | acceptance matrix и Playwright decision-mockup evidence                | сценарии сформированы, mockup проверен         |
| Loading/empty/error/conflict/read-only                 | state contract и acceptance matrix                                     | сценарии сформированы; implementation не начат |
| Realistic minimum/typical/maximum data                 | acceptance data matrix                                                 | сформировано                                   |
| Все ветви product interview                            | принятые решения и повторное ревью                                     | Q1–Q6 закрыты; детали делегированы             |
| Подтверждение направления UX-brief                     | согласие пользователя и явное делегирование решений                    | получено; не является visual acceptance        |

Исследовательская цель закрыта: решение сформулировано, подвергнуто повторной
проверке и принято с делегированием деталей. Реализация и её приёмка — следующий
отдельный результат. Live UI и Playwright evidence выше относятся к прошлому
проходу; в повторном ревью перепроверены source, спецификации и первичные
guidelines, но новая browser-сессия не проводилась.

## Independent second-pass findings

Этот второй проход сверил утверждения выше с текущими источниками после принятия
раунда 1. Он не меняет существующие разделы исследования.

### 1. `stableId` уже есть, но текущая проекция ещё не строит строки lineage

В базе уникальность ограничена парой `reportSectionId + stableId`, а carry-over
создаёт новый физический `id`, сохраняя `stableId`
(`prisma/schema.prisma:607-648`,
`apps/api/src/modules/carry-over/carry-over-clones.ts:7-40`). Это подтверждает,
что одна logical commitment может безопасно появляться в соседних report
sections. Внутри одной section эта же уникальность означает, что Current и Next
не могут одновременно быть двумя реальными rows с одним `stableId`; состояние
«moved to next» должно быть одной Next occurrence, а связь с Current показывается
как derived transition в projection. Текущий projector сначала строит независимые массивы Previous,
Current и Next, а UI даёт каждому item ключ с префиксом `source`
(`apps/web/src/features/report-sections/model/status-overview-projector.ts:43-71,231-285`,
`apps/web/src/features/report-sections/ui/status-overview-row.tsx:112-185`).
Одного поля `stableId` в DTO поэтому недостаточно: потребуется отдельный
presentation join, который создаёт одну строку на lineage и явно кладёт
orphan Previous в состояние `needs decision`.

### 2. Display mapping не доказывает время создания

Сейчас любой Current item, чей `stableId` не найден среди Previous, получает
`continuity: "unplanned"`, а UI буквально выводит `Unplanned`
(`apps/web/src/features/report-sections/model/status-overview-projector.ts:50-70`,
`apps/web/src/features/report-sections/ui/status-overview-row.tsx:30-43`).
OpenSpec-тесты текущей проекции также закрепляют vocabulary
`unplanned/continued` (`apps/web/src/features/report-sections/model/status-overview.test.ts:150-176`,
`openspec/changes/add-compact-lead-status-overview/tasks.md:3`). Поэтому
Отсутствие связи не доказывает, что запись создана на текущей неделе. После
синтеза ревью выбрано `Not in prior plan` с явным display mapping и обновлением
тестового контракта; при unavailable previous source label скрывается.

### 3. `Plan again` не может быть обычным client-side `DraftPatch`

Новая строка в quick-add сейчас создаётся без `stableId`: payload намеренно
оставляет его `undefined`, чтобы сервер его сминтил
(`apps/web/src/features/report-pages/ui/lead/shell/lead-form.projection.test.tsx:514-547`,
`apps/web/src/features/report-sections/model/lead-form/draft/lead-form-draft-merge-helpers.ts:151-161`).
Текущие create/edit handlers лишь добавляют объект в выбранный week-массив
(`apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview-item-editor.tsx:29-58`).
Следовательно, browser не должен подставлять `stableId` старого Previous в
этот patch. `Plan again` должен быть server-resolved command с идемпотентным
проверением: predecessor доступен, target section разрешён, occurrence ещё не
существует, parent/stage совместимы. Ответ команды должен вернуть созданные
`id/stableId`, чтобы draft не продолжал жить с временной клиентской
идентичностью.

### 4. `Won't do` нельзя моделировать удалением строки или шестым status

Авторитетная модель принимает только
`planned | in_progress | paused | postponed | done`; для Current и Next
существуют разные допустимые подмножества
(`openspec/specs/record-status-derivation/spec.md:188-206`). Кроме того,
published lineage должен сохраняться при save, а существующий guard прямо
проверяет это (`apps/api/src/modules/report-sections/domain/published-record-guard.ts:1-31`,
`apps/api/src/modules/report-sections/infrastructure/published-record-guard.test.ts:74-117`).
Значит, resolution должна ссылаться на lineage и хранить outcome, reason,
actor и timestamp отдельно от `workflowStatus`; операция должна быть
append-preserving и атомарной относительно текущего draft. Для draft разумно
разрешить исправление outcome в editable draft. После Submit сначала нужен
существующий reopen/revoke flow; опубликованный snapshot остаётся неизменным.
Новая попытка в более позднем периоде проходит через `Plan again` с аудитом.

### 5. `Resolve prior plan` допустим только как единая атомарная команда

Previous строится из prior `type=next`; `postponed` намеренно не попадает в
автоматический carry-over и требует явного re-plan
(`openspec/specs/record-status-derivation/spec.md:202-206`,
`openspec/changes/add-compact-lead-status-overview/research.md:18-23`).
Если для ленивого пользователя оставить один вход `Resolve prior plan`, каждый
исход должен иметь собственную серверную транзакцию: `Continue` создаёт Current
`in_progress`, `Done` создаёт Current `done`, `Plan next` создаёт Next
`planned`, `Won't do` создаёт resolution. `Plan next` здесь означает
осознанное планирование на следующую неделю и не должно путаться с
существующим `Move to next week`, который записывает Next `postponed` и
исключает запись из будущего auto carry-over
(`apps/web/src/features/report-sections/model/lead-actions/lead-item-actions.ts:1-20`,
`openspec/specs/record-status-derivation/spec.md:202-206`). Два
последовательных autosave patch-а для `Next -> Current + Done` оставят окно
частичного item-state; это отдельная проблема атомарности, а не report-level
period dual-state invariant. До реализации новых команд доступен только
реально поддержанный набор действий; mockup не является capability.

### 6. Быстрый ввод должен быть text-first и различать `Add` от `Plan`

В production Overview нажатие `Add update` открывает полный `ItemEditDialog`
(`apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview-content.tsx:247-267`,
`apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview-item-editor.tsx:71-110`).
Это объясняет ощущение лишних кликов: пользователь уже выбрал unit и week, но
снова видит parent/status/прочие поля. Carbon рекомендует inline creation,
когда контекст важен, а сложные поля оставляет для отдельного edit flow
([Carbon Create flows](https://carbondesignsystem.com/community/patterns/create-flows/)).
Практический minimum для Overview: один клик по `Add current` или `Plan next`
сразу фокусирует textarea; одна owned stage auto-selects; при нескольких
стадиях stage chip обязателен, но остаётся в той же строке; `Mod+Enter` сохраняет,
`Escape` отменяет, а `Edit details` открывает редкие поля. Это соответствует
контекстной inline edit модели Atlassian и не полагается на blur
([Atlassian Inline edit](https://atlassian.design/components/inline-edit)).
Название `Add update` лучше заменить на глагол с направлением недели: так
пользователю не нужно помнить, что именно означает `update` в Current и Next.

Главный вывод второго прохода: визуальное объединение можно делать уже на
`stableId`, но две новые доменные способности остаются отдельными границами —
server-resolved lineage command и audited resolution. Их нельзя получить одним
переименованием карточек или простым расширением существующего `DraftPatch`.

## Уточнение: задача ведётся до завершения, а не до границы недели

Основание: дополнительное требование пользователя от 2026-09-04 — у заведённой
задачи должен сохраняться трек планирования и фактического исполнения через
недели, включая продолжение, паузу, откладывание и завершение. Это целевая
логика; текущая реализация ей ещё не соответствует. Этот раздел уточняет и
заменяет прежнее решение «переместить Current в Next, оставив только подпись».

### Три разные сущности в интерфейсе

- **Задача** — постоянная идентичность работы. Переименование и смена стадии не
  создают новую задачу.
- **Результат недели** — что реально произошло за конкретную неделю, с её
  статусом и пояснением. Не переписывается планом следующей недели.
- **Следующий шаг** — намерение продолжить ту же работу в следующем периоде.
  У него может быть другой текст: «реализовали API» и «провести интеграционные
  тесты» не должны конкурировать за единственное поле описания.

На доске это одна связанная строка: опубликованный предыдущий план → результат
текущей недели → следующий шаг. История раскрывается из этой строки и включает
периоды раньше непосредственного предшественника. Независимая новая задача
получает новую идентичность; Continue никогда не выполняет Duplicate.

### Правила перехода периода

| Состояние                       | Что происходит в следующем периоде                                                                    | Что система не утверждает                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Явный план следующей недели     | Появляется в текущей как запланированная, ещё не начатая работа                                       | Что работа уже началась                                 |
| В работе, следующий шаг задан   | Сохраняются текущий результат и будущий шаг одной задачи                                              | Что новый план заменил текущий результат                |
| В работе, обновление не внесено | Задача остаётся среди открытых с последним известным статусом и отметкой `Needs update`               | Что старый текст является результатом новой недели      |
| Пауза                           | Сохраняются задача, причина и последний подтверждённый статус; явный Resume возобновляет работу       | Что наступление понедельника сняло паузу                |
| Отложено                        | Остаётся в доступном списке открытых задач, вне активного плана; Replan возвращает в выбранный период | Что исключение из переноса означает исчезновение задачи |
| Завершено                       | Остаётся в истории и результате недели завершения; активный перенос прекращается                      | Что завершённая задача должна повторяться каждую неделю |
| Отказались                      | Причина и история сохраняются; активный перенос прекращается                                          | Что отказ равен удалению                                |

Просроченное обещание не объявляется автоматически провалом, паузой или
завершением. Система показывает последнее подтверждённое состояние и просит
обновить его. Наличие задачи на доске не равно подтверждённому результату недели.
Перед Submit показываются неразобранные обещания; новый жёсткий запрет на
отправку без отдельного обоснования не вводится.

### Быстрые действия и отчётность

- `Done` закрывает работу и сохраняет результат текущей недели.
- `Continue next week` сохраняет текущий результат и предлагает следующий шаг
  с уже выбранными задачей, продуктом/активностью и стадиями.
- `Pause` требует причину; возобновление всегда явное.
- `Postpone` сохраняет работу вне активного плана, не теряя возможности Replan.
- `Won't do` сохраняет причину и аудит; исправление черновика доступно через
  Restore, возобновление после публикации создаёт новую запись той же истории.
- `Create separate task` — вторичное действие с новой идентичностью, а не
  неявный эффект продолжения. Завершённую работу нельзя незаметно «продолжить»:
  нужна либо явная повторная активация с причиной, либо новая задача.

Для обещаний показываются отдельно: выполнено, продолжается, на паузе,
отложено, отказались, нет обновления. «Разобрано» не равно «выполнено»:
перепланирование закрывает вопрос о судьбе обещания, но не увеличивает число
выполненных. Одна задача учитывается один раз, даже если у неё одновременно
есть результат недели и следующий шаг. При недоступном источнике сравнения
показывается неизвестность, а не ноль и не успешное выполнение.

### Что меняется относительно текущего кода

Проверено по `carry-over-plan.ts` и `carry-over-clones.ts`: перенос выбирает
только допустимые Next items и делает их Current/in_progress. По
`record-status-derivation/spec.md` Current пока вообще не допускает Planned.
Это не ошибка CSS: нужны согласованные изменения статусов, carry-over,
read/write contracts, snapshot/export и редактора.

Ограничение одного Item на section/stableId сохраняет защиту от дублей, но
нельзя использовать его как основание потерять результат недели. Результат и
следующий шаг должны храниться раздельно в рамках одной идентичности;
конкретная схема определяется до изменения write path. Реестр открытой работы
должен искать последний допустимый контекст через пропущенные периоды, с
проверкой текущих прав и принадлежности, не только предыдущий Next.

Старые опубликованные снимки не переписываются. Исторический In progress не
переклассифицируется в Not started на основании предположения, а Postponed не
превращается в обещание. Повтор переноса, параллельное сохранение, пропуск недели,
смена продукта/стадий и недоступный владелец требуют отдельных проверок.

### Сквозной приёмочный сценарий

1. Неделя A: запланировали авторизацию на B.
2. Неделя B: план появился без ложного «уже в работе»; автор подтвердил начало,
   записал «готов API» и запланировал тестирование на C. Оба текста сохранены.
3. Неделя C: записали паузу «ждём доступ». На D задача остаётся видна на паузе,
   но не считается новой выполненной работой или автоматически начатым планом.
4. После пропуска периода: Resume сохраняет связь с A–C; завершение закрывает
   активную задачу, оставляя все обещания, результаты и причины в истории.

Варианты того же теста: отложить и перепланировать после двух периодов;
отказаться и восстановить черновик; не внести обновление; повторить запрос;
открыть только опубликованный снимок. Ни один вариант не должен терять задачу,
менять старый отчёт, создавать дубль или выдавать намерение за факт.
