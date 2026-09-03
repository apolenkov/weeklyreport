# SitePing integration hardening research

Дата: 2026-09-03
Объект: `@siteping/widget@0.10.7`, `@siteping/dashboard@0.2.5`, `@siteping/adapter-prisma@0.6.4`, текущий staged-код WeeklyReport.

## Вывод

Интеграция правильно использует SitePing как транспорт и DOM-annotation engine, но текущий seam не должен считаться полностью совместимым с production-контрактом без дополнительных проверок. Самые опасные места: очередь браузера повторяет любой HTTP failure, deep link ограничен initial load и видимым набором текущего URL, а Prisma store имеет read-then-create гонку. Эти проблемы нельзя закрыть только UI-фильтрами.

## Факты из первичных источников

### Retry queue и удаление

SitePing документирует три попытки с backoff, затем запись payload в `localStorage` (до 20 элементов) и flush на следующей загрузке: [FAQ](https://siteping.dev/docs/faq#what-happens-if-the-network-drops-mid-submit). В исходнике `@siteping/widget` ключ — `siteping_retry_queue`, очередь ограничена 20, при переполнении удаляется старейшая запись ([`api-client.ts`, lines 66–69, 151–167](https://github.com/NeosiaNexus/SitePing/blob/cfd32b6a0c4c243293b2c1656026595aea4f1ff8/packages/widget/src/api-client.ts#L66-L167)).

Критическая деталь: `sendFeedback` ставит payload в очередь на **каждом** неуспешном HTTP-ответе после retry, включая 4xx ([`api-client.ts`, lines 274–305](https://github.com/NeosiaNexus/SitePing/blob/cfd32b6a0c4c243293b2c1656026595aea4f1ff8/packages/widget/src/api-client.ts#L274-L305)). Flush повторяет все записи, оставшиеся для endpoint, а удаляет их только после успешного ответа ([`api-client.ts`, lines 188–255](https://github.com/NeosiaNexus/SitePing/blob/cfd32b6a0c4c243293b2c1656026595aea4f1ff8/packages/widget/src/api-client.ts#L188-L255)). Поэтому первоначальные `POST 404/403` могут жить в браузерах и после удаления строки из БД снова создать отзыв. Очередь также хранит author name/email в payload; текущая версия SitePing отбрасывает запись при смене identity только если вызывающий передал `currentIdentity`.

Удаление через dashboard — это удаление строки по endpoint; endpoint source намеренно не делает retries для triage-операций ([dashboard data sources](https://siteping.dev/docs/dashboard/sources#endpoint-mode-production-default)). Это не очищает `localStorage` очереди на клиентских браузерах. Значит, серверный `Delete all` не является глобальным tombstone.

### Deep link, pagination и SPA

`deepLink` по документации включается только на первом рендере и для изменений route требует `focusFeedback()` ([widget configuration](https://siteping.dev/docs/widget/configuration#visibility)). Реализация сначала запрашивает `PAGE_SIZE`, фильтрует видимые записи текущим URL, затем вызывает `markers.focusFeedback(id)`; при отсутствии записи только пишет диагностический лог ([`launcher.ts`, lines 565–601](https://github.com/NeosiaNexus/SitePing/blob/cfd32b6a0c4c243293b2c1656026595aea4f1ff8/packages/widget/src/launcher.ts#L565-L601)). `focusFeedback` возвращает `false`, если запись не попала в загруженный набор ([`markers.ts`, lines 629–651](https://github.com/NeosiaNexus/SitePing/blob/cfd32b6a0c4c243293b2c1656026595aea4f1ff8/packages/widget/src/markers.ts#L629-L651)).

Следствие: URL с отзывом старше первых 20 (или лимита запроса) может открыть правильную страницу, но не показать marker. SPA watcher обновляет данные после navigation, но явно не повторяет deep-link focus ([`launcher.ts`, lines 648–656](https://github.com/NeosiaNexus/SitePing/blob/cfd32b6a0c4c243293b2c1656026595aea4f1ff8/packages/widget/src/launcher.ts#L648-L656)).

Текущий WeeklyReport передаёт `sitepingUrl` для head route и подменяет scope, но `useLeadFormRedirects` при canonical redirect строит новый `URLSearchParams` только с `mode`, теряя `siteping`, `sitepingUrl` и `authorId` ([`product-feedback-widget.tsx`](../../../../apps/web/src/features/product-feedback/ui/product-feedback-widget.tsx), [`product-feedback-page.tsx`](../../../../apps/web/src/features/product-feedback/ui/product-feedback-page.tsx), [`use-lead-form-redirects.ts`](../../../../apps/web/src/features/report-pages/ui/lead/shell/use-lead-form-redirects.ts)). Это проверяемый путь к «страница открылась, аннотация не сфокусирована».

### SitepingStore и идемпотентность

Официальный adapter-kit требует от query store шесть методов; `createFeedback` при повторном `clientId` должен вернуть существующую запись или бросить `StoreDuplicateError`. `verifyProjectOwnership` нужен для project-scoped PATCH/DELETE, а conformance suite содержит 44 теста ([writing an adapter](https://siteping.dev/docs/adapters/writing-an-adapter#the-error-contract), [conformance suite](https://siteping.dev/docs/adapters/writing-an-adapter#prove-it-the-conformance-suite)).

Официальный Prisma handler при `P2002` повторно вызывает `findByClientId` и возвращает существующую запись ([upstream `index.ts`, lines 751–757](https://github.com/NeosiaNexus/SitePing/blob/cfd32b6a0c4c243293b2c1656026595aea4f1ff8/packages/adapter-prisma/src/index.ts#L751-L757)).

Текущий `ProductFeedbackPrismaRepository.create` сначала делает `findUnique(clientId)`, затем отдельный `create` ([`product-feedback.prisma-repository.ts`](../../../../apps/api/src/modules/product-feedback/product-feedback.prisma-repository.ts)). Два параллельных POST могут оба увидеть `null`; один create получит `P2002`. Handler затем вызывает scoped `findByClientId`, который применяет actor predicate. Для другого пользователя он вернёт `null`, после чего upstream отдаст 500. Это не нарушает ownership (чужая запись не раскрывается), но нарушает ожидаемую retry-safe семантику и даёт ложную server error.

Варианты, которые остаются совместимыми с SitePing: (A) атомарный insert + обработка `P2002` как duplicate с безопасным повторным чтением; (B) сохранить `StoreDuplicateError`, но гарантировать детерминированный non-500 ответ для чужого clientId; (C) применять conformance suite к адаптеру и отдельный concurrent test с двумя POST. Выбор должен учитывать, что `clientId` — браузерный dedupe key и не должен становиться каналом раскрытия чужого feedback.

### Ролевой sidebar

SitePing dashboard в endpoint mode вызывает GET/PATCH/DELETE и классифицирует 401/403 как auth error ([dashboard sources](https://siteping.dev/docs/dashboard/sources#endpoint-mode-production-default)). Его `SitepingStore` контракт не содержит callback для per-record permissions; `deleteAllFeedbacks(projectName)` — отдельная project-wide операция ([upstream types](https://github.com/NeosiaNexus/SitePing/blob/cfd32b6a0c4c243293b2c1656026595aea4f1ff8/packages/core/src/types.ts#L640-L681)). Поэтому приложение может гарантировать authorization только на сервере, но стандартный sidebar может показывать кнопку, которую текущая роль не может выполнить. Скрытие кнопок потребовало бы upstream fork/patch или отдельный UI, а не только props текущего пакета.

Текущий WeeklyReport правильно оставляет стандартный sidebar всем authenticated users и защищает мутации в scoped repository. Но acceptance должен проверять отсутствие side effects при запрещённом действии, а не отсутствие самой кнопки.

### DOM anchoring и `data-feedback-anchor`

SitePing строит anchor из CSS selector, XPath, text snippet и structural fingerprint; это не screenshot-only модель ([anchoring docs](https://siteping.dev/docs/widget/anchoring)). Стабильный host-provided selector улучшает survivability; upstream поддерживает `elementId` и selector data в annotation wire contract ([widget types](https://github.com/NeosiaNexus/SitePing/blob/cfd32b6a0c4c243293b2c1656026595aea4f1ff8/packages/core/src/types.ts#L390-L450)).

В WeeklyReport поиск `data-feedback-anchor` в текущих staged источниках не дал результатов. Значит, сейчас якорь зависит от сгенерированных DOM-селекторов и текста: изменение структуры, повторяющиеся элементы, виртуализация или локализация могут сделать marker невидимым. Это не повод изобретать собственный anchor format без проверки upstream; сначала нужен каталог стабильных host anchors на критических report blocks и e2e-проверка после rerender.

### Screenshot renderer и CSS Color 4

Реальный браузерный прогон выявил, что штатный `html2canvas@1.4.1` из SitePing завершает capture с `Attempting to parse an unsupported color function "color"` на CSS Tailwind 4. Ошибка известна upstream и остаётся открытой ([html2canvas #2700](https://github.com/niklasvh/html2canvas/issues/2700), [CSS Color 4 PR #3256](https://github.com/niklasvh/html2canvas/pull/3256)). Workspace override заменяет только этот transitive renderer на API-совместимый `html2canvas-pro@1.6.7`; compatibility-тест фиксирует разрешённый пакет и версию. После замены браузерный POST сохранил JPEG, region и diagnostics.

### Один inbox для WeeklyReport и Development

SitePing scopes feedback через обязательный `projectName`; quickstart показывает отдельный endpoint и project (`useSiteping({ endpoint, projectName })`) ([README quickstart](https://github.com/NeosiaNexus/SitePing#quickstart)). Текущая реализация WeeklyReport во всех repository/store путях серверно фиксирует `weekly-report`, хотя shared schema резервирует `external-product`. Это безопасный fail-closed rollout, но общего двухпродуктового inbox пока нет. Просто принять client-supplied `projectName` нельзя: это обойдёт intended product boundary.

Варианты: (1) один физический endpoint с server-selected product context и admin-only cross-product query; (2) один inbox UI, но два authenticated ingress scope и объединение результатов в application service; (3) отдельные endpoints/storage scopes, общий только presentation layer. Для Development всё равно нужен отдельный SSO или short-lived signed token — SitePing docs описывают browser `apiKey` как видимый в bundle и рекомендуют short-lived headers для публичных сайтов ([configuration](https://siteping.dev/docs/widget/configuration#connection)).

## Brainstorm / grill: вопросы, которые нельзя замолчать

- Что является источником истины после `Delete all`: БД или уже доставленный browser queue? Если нужна строгая семантика удаления, потребуется server-side generation/tombstone или queue invalidation protocol; одной кнопки dashboard недостаточно.
- Разрешено ли повторно доставить отзыв после logout/login другим пользователем? Текущий upstream payload queue делает это возможным без identity-aware flush; нельзя полагаться только на имя/email.
- Нужна ли «фокусировка» как hard acceptance? Если да, `HTTP 200` и правильный pathname недостаточны: нужно доказать, что target annotation реально разрешился и marker/highlight видим.
- Как обрабатываем duplicate `clientId` от другого actor: 404/409/200 существующей записи? Ответ не должен раскрывать existence чужого feedback и не должен превращаться в неожиданный 500.
- Нужно ли разрешать head status-change group-wide, но не delete? Стандартный sidebar не знает эту матрицу; серверная политика и UI-представление неизбежно расходятся.
- Что значит «один inbox»: общий список в одном экране или общая authorization/persistence boundary? Без ответа легко случайно дать WeeklyReport admin доступ к Development данным.

## Зафиксированные продуктовые решения

- Весь штатный collection surface SitePing включается для всех четырёх авторизованных ролей: drawn annotations, right-click comments, screenshots, console/network diagnostics, markers, sidebar и deep links.
- Стандартный SitePing sidebar, включая Delete all, остаётся без capabilities-патча; сервер трактует bulk action как удаление всех собственных отзывов для обычной роли и всех отзывов WeeklyReport для администратора.
- Постоянная browser retry queue отключается, чтобы удалённые и отклонённые payload не появлялись повторно после reload.
- В этой итерации завершается только WeeklyReport. Development ждёт отдельный authenticated ingress.

## Рекомендуемый порядок hardening

1. Зафиксировать retry/deletion policy и покрыть 4xx, stale identity, logout/login, Delete all и повторный POST тестами.
2. Сделать concurrent Prisma test и прогнать настоящий Siteping conformance suite или эквивалент всех 44 контрактов.
3. Исправить canonical/SPA redirect preservation и добавить deep-link acceptance для записи за пределами первой страницы; если upstream API не позволяет загрузить по id, сделать application-level focus path.
4. Добавить стабильные `data-feedback-anchor` только на подтверждённые report blocks и browser test после rerender.
5. После этого отдельно специфицировать multi-product auth/storage boundary для Development.

## Проверяемые acceptance criteria для следующей OpenSpec change

- Никакой failed feedback submission не остаётся в durable retry queue после callback; network/5xx повторы ограничены текущей попыткой SitePing.
- После удаления feedback запись не может быть создана старым queued payload без явной политики re-admission; это доказано тестом с очищенной/устаревшей очередью.
- Два одновременных POST с одним `clientId` дают ровно одну строку и два retry-safe non-500 ответа; cross-user duplicate не раскрывает данные.
- Реальный store проходит SitePing conformance suite, включая duplicate, not-found, pagination, filtering, project ownership и bulk delete.
- Inbox link сохраняет все параметры через canonical redirect; feedback с page > 20 или не загруженный initial page приводит к фактическому `focusFeedback`/видимому highlight либо явно показывает «annotation unavailable».
- Для выбранных report blocks повторный render/layout shift сохраняет разрешение anchor; тесты не зависят от локализованного текста.
- Admin может управлять всеми WeeklyReport feedback; остальные роли не получают cross-scope mutation даже через прямой HTTP; UI permission mismatch документирован или устранён отдельным компонентом.
- Development не появляется в общем query scope до отдельного решения по SSO/token, tenant isolation и retention.
