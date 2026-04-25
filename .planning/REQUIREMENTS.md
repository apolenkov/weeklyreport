# Requirements: CustomReport v5.0

**Defined:** 2026-04-25
**Core Value:** Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.

## v5.0 Requirements

Requirements for v5.0 Production Integration. Each maps to roadmap phases.

### Seed Data

- [ ] **SEED-01**: БД содержит 12 продуктов с именами из макета (CRM Platform, Data Analytics Suite, etc.)
- [ ] **SEED-02**: БД содержит 6 лидов с реальными именами (Platanov, Ivanova, etc.) и UUID, совпадающими с DEV_SESSION
- [ ] **SEED-03**: 7 SDLC стадий назначены лидам по продуктам (StageAssignment)
- [ ] **SEED-04**: 2 отчётных периода с реалистичными данными (items, risks, decisions, priorities)
- [ ] **SEED-05**: Seed idempotent — повторный запуск не дублирует данные

### Type System

- [x] **TYPE-01**: Mapper layer преобразует Zod/Prisma типы в presentation model (green->on-track, etc.)
- [x] **TYPE-02**: Mapper покрыт unit тестами (каждое значение enum в обе стороны)
- [x] **TYPE-03**: Computed states (pending, planned) корректно вычисляются из DB данных

### tRPC Wiring

- [ ] **TRPC-01**: TRPCProvider + QueryClientProvider в (app)/layout.tsx с useState pattern (без SSR leak)
- [ ] **TRPC-02**: superjson transformer на клиенте и сервере (Date serialization)
- [ ] **TRPC-03**: @trpc/tanstack-react-query установлен (React Compiler совместимость)
- [x] **TRPC-04**: 7 container-компонентов переведены с mock-data на useQuery/useMutation
- [x] **TRPC-05**: Loading states (skeleton) на каждой странице при загрузке данных
- [x] **TRPC-06**: Error boundaries + toast notifications для ошибок API
- [ ] **TRPC-07**: Cache invalidation после каждой мутации (submit->refetch dashboard, etc.)

### Interactivity

- [x] **INT-01**: Submit секции вызывает реальный tRPC mutation, форма блокируется после submit
- [ ] **INT-02**: Publish & Lock вызывает period.publish, обновляет weekly report и dashboard
- [x] **INT-03**: Revoke вызывает leadForm.revoke, разблокирует секцию для повторного редактирования
- [x] **INT-04**: Fill From вызывает leadForm.fillFrom, заполняет форму данными из предыдущего периода
- [x] **INT-05**: Version History навигация и Restore вызывают leadForm.versions/restoreVersion
- [x] **INT-06**: Autosave drafts через debounced tRPC mutation (3-5 сек)
- [x] **INT-07**: Dirty state tracking + предупреждение при уходе с несохранённой формой
- [x] **INT-08**: Real cursor pagination в archive list и version history
- [x] **INT-09**: Period Navigator переключает периоды через URL + useQuery
- [ ] **INT-10**: Admin CRUD (users, products, stages, periods, settings) через реальные tRPC mutations

### Status-Risk Sync

- [ ] **SYNC-01**: При установке стадии в At Risk/Blocked — автоматически добавляется пустая строка в Risks секцию
- [ ] **SYNC-02**: Пустая risk-строка обязательна к заполнению перед сохранением
- [ ] **SYNC-03**: При заполнении risk — предложение обновить статус стадии (с подтверждением пользователя)
- [ ] **SYNC-04**: SyncSource flag предотвращает infinite loops ('user' | 'auto-sync')

### PDF and Jobs

- [x] **PDF-01**: BullMQ re-enabled, PDF export job работает end-to-end
- [x] **PDF-02**: Кнопка Export PDF -> tRPC mutation -> BullMQ job -> Playwright renders -> download
- [x] **PDF-03**: Индикатор прогресса (generating -> ready -> download link)

### Auth

- [x] **AUTH-01**: proxy.ts проверяет session cookie, redirect на /login для неаутентифицированных
- [x] **AUTH-02**: AUTH_STUB=true полностью обходит auth (для dev/test)
- [x] **AUTH-03**: 401 interceptor — при истечении сессии redirect на login с return URL
- [x] **AUTH-04**: Session context доступен во всех (app)/ layouts

### Logging

- [x] **LOG-01**: Correlation ID propagation через nestjs-cls (AsyncLocalStorage)
- [x] **LOG-02**: Request/response logging на каждом tRPC endpoint
- [x] **LOG-03**: Логи пишутся в файл (не только console)
- [x] **LOG-04**: File rotation — архивация по размеру/времени
- [x] **LOG-05**: Structured JSON format с timestamp, level, correlationId, module

### E2E Integration

- [ ] **E2E-01**: Playwright config с dual webServer (API + Web)
- [ ] **E2E-02**: Global setup seeds БД перед тестами, cleanup после
- [ ] **E2E-03**: 20-30 core integration tests в отдельной e2e/integration/ директории
- [ ] **E2E-04**: Lead journey end-to-end через реальный API (login -> fill -> submit -> locked)
- [ ] **E2E-05**: Head journey end-to-end (dashboard -> report -> publish -> PDF)
- [ ] **E2E-06**: Cross-role lifecycle (lead submits -> head publishes -> lead sees locked)
- [ ] **E2E-07**: Существующие 339 mock-based тестов сохранены (не big-bang миграция)

## v6.0 Requirements (Deferred)

### Role Separation

- **ROLE-01**: Разделение доступа по ролям (lead/head/viewer) на уровне UI
- **ROLE-02**: Backend role guards на каждом endpoint
- **ROLE-03**: Role-specific navigation и menu items

### Notifications

- **NOTIF-01**: Email reminders через BullMQ job
- **NOTIF-02**: In-app notifications для submission events

### Analytics

- **ANAL-01**: Trend analytics (светофоры по неделям)
- **ANAL-02**: Team velocity metrics

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time collaboration | Каждый лид работает в своей секции, конфликтов нет |
| Mobile app | Web-first, responsive достаточно |
| Jira/GitLab integration | Ручной ввод для v5.0 |
| Telegram/Slack notifications | Email only |
| Full SAML SSO flow | AUTH_STUB режим для v5.0, Keycloak в v6.0+ |
| Replace custom logger with pino | Research says enhance existing, not replace |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEED-01 | Phase 20 | Pending |
| SEED-02 | Phase 20 | Pending |
| SEED-03 | Phase 20 | Pending |
| SEED-04 | Phase 20 | Pending |
| SEED-05 | Phase 20 | Pending |
| TYPE-01 | Phase 20 | Complete |
| TYPE-02 | Phase 20 | Complete |
| TYPE-03 | Phase 20 | Complete |
| TRPC-01 | Phase 21 | Pending |
| TRPC-02 | Phase 21 | Pending |
| TRPC-03 | Phase 21 | Pending |
| TRPC-04 | Phase 21 | Complete |
| TRPC-05 | Phase 21 | Complete |
| TRPC-06 | Phase 21 | Complete |
| TRPC-07 | Phase 21 | Pending |
| INT-01 | Phase 22 | Complete |
| INT-02 | Phase 22 | Pending |
| INT-03 | Phase 22 | Complete |
| INT-04 | Phase 22 | Complete |
| INT-05 | Phase 22 | Complete |
| INT-06 | Phase 22 | Complete |
| INT-07 | Phase 22 | Complete |
| INT-08 | Phase 22 | Complete |
| INT-09 | Phase 22 | Complete |
| INT-10 | Phase 22 | Pending |
| SYNC-01 | Phase 22 | Pending |
| SYNC-02 | Phase 22 | Pending |
| SYNC-03 | Phase 22 | Pending |
| SYNC-04 | Phase 22 | Pending |
| PDF-01 | Phase 23 | Complete |
| PDF-02 | Phase 23 | Complete |
| PDF-03 | Phase 23 | Complete |
| AUTH-01 | Phase 24 | Complete |
| AUTH-02 | Phase 24 | Complete |
| AUTH-03 | Phase 24 | Complete |
| AUTH-04 | Phase 24 | Complete |
| LOG-01 | Phase 25 | Complete |
| LOG-02 | Phase 25 | Complete |
| LOG-03 | Phase 25 | Complete |
| LOG-04 | Phase 25 | Complete |
| LOG-05 | Phase 25 | Complete |
| E2E-01 | Phase 26 | Pending |
| E2E-02 | Phase 26 | Pending |
| E2E-03 | Phase 26 | Pending |
| E2E-04 | Phase 26 | Pending |
| E2E-05 | Phase 26 | Pending |
| E2E-06 | Phase 26 | Pending |
| E2E-07 | Phase 26 | Pending |

**Coverage:**
- v5.0 requirements: 48 total (SEED:5 + TYPE:3 + TRPC:7 + INT:10 + SYNC:4 + PDF:3 + AUTH:4 + LOG:5 + E2E:7)
- Mapped to phases: 48
- Unmapped: 0

---
*Requirements defined: 2026-04-25*
*Last updated: 2026-04-25 after roadmap creation (traceability expanded)*
