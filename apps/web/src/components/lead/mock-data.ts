/**
 * Mock data and type definitions for Lead Form components.
 * Real data will come from tRPC endpoints in a later phase.
 */

// ---- Type Definitions ----

export type StageStatus = 'on-track' | 'at-risk' | 'blocked' | 'empty';

export type StageOwnership = 'mine' | 'locked' | 'unassigned';

export type StageAssignment = {
  stageName: string;
  status: StageStatus;
  ownership: StageOwnership;
  assignee: string | null;
  tooltip?: string;
};

export type Product = {
  id: string;
  name: string;
  overallStatus: StageStatus;
  stages: StageAssignment[];
  riskSummary?: string;
  riskCount?: number;
};

export type ItemStatus = 'in-progress' | 'completed' | 'blocked' | 'planned';

export type KanbanItem = {
  id: string;
  productId: string;
  productName: string;
  stageName?: string;
  status: ItemStatus;
  text: string;
  author: string;
};

export type RiskEntry = {
  id: string;
  productId: string;
  productName: string;
  stageName: string;
  severity: 'at-risk' | 'blocked';
  /** The user-controlled "what is the risk" text (= raw `risk` field). */
  text: string;
  /** Schema-required impact narrative; surfaced in the edit dialog. */
  impact: string;
  /** Schema-required mitigation narrative; surfaced in the edit dialog. */
  mitigation: string;
};

export type DecisionEntry = {
  id: string;
  productId: string;
  productName: string;
  text: string;
  /** Schema-required owner (responsible person). Surfaced in the edit dialog. */
  owner: string;
  /** Schema-required impact narrative. Surfaced in the edit dialog. */
  impact: string;
  /** Optional deadline (ISO date string) — null when not set. */
  deadline: string | null;
};

export type PriorityEntry = {
  /** 1-indexed rank. Schema allows any positive int up to 50 per draft. */
  rank: number;
  text: string;
};

export type ReportPeriod = {
  id: string;
  /**
   * Section id (per-lead) used for fillFrom mutation. Matches
   * `LeadReportPeriod.sourceSectionId` so cast-through stays structural.
   */
  sourceSectionId: string;
  weekLabel: string;
  dateRange: string;
  isCurrent: boolean;
  isSubmitted: boolean;
  itemCount?: number;
  riskCount?: number;
  productCount?: number;
};

export type VersionSnapshot = {
  version: number;
  timestamp: string;
  itemCount: number;
  riskCount: number;
  decisionCount: number;
};

export type HistoryEntry = {
  id: string;
  periodId: string;
  weekLabel: string;
  dateRange: string;
  status: 'submitted' | 'draft';
  submittedAt?: string;
  trafficLights: { green: number; yellow: number; red: number };
  itemCount: number;
  riskCount: number;
  decisionCount: number;
};

// ---- Mock Data ----

export const CURRENT_USER = {
  name: 'Polenkov A.',
  initials: 'AP',
  role: 'Dev Lead' as const,
};

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'crm',
    name: 'CRM Platform',
    overallStatus: 'at-risk',
    stages: [
      { stageName: 'Planning', status: 'on-track', ownership: 'locked', assignee: 'PM' },
      { stageName: 'Analysis', status: 'on-track', ownership: 'locked', assignee: 'Ivanov A.' },
      { stageName: 'Design', status: 'on-track', ownership: 'locked', assignee: 'Petrova M.' },
      { stageName: 'Dev', status: 'at-risk', ownership: 'mine', assignee: 'Polenkov A.', tooltip: 'At Risk: Delay in OAuth2 due to partner API limits' },
      { stageName: 'Testing', status: 'on-track', ownership: 'locked', assignee: 'Novikova E.' },
      { stageName: 'DevOps', status: 'on-track', ownership: 'locked', assignee: 'Sidorov P.' },
      { stageName: 'Support', status: 'on-track', ownership: 'locked', assignee: 'Support' },
    ],
  },
  {
    id: 'analytics',
    name: 'Data Analytics Suite',
    overallStatus: 'blocked',
    riskSummary: '2 blockers',
    riskCount: 2,
    stages: [
      { stageName: 'Planning', status: 'empty', ownership: 'unassigned', assignee: null },
      { stageName: 'Analysis', status: 'on-track', ownership: 'locked', assignee: 'Ivanov A.' },
      { stageName: 'Design', status: 'empty', ownership: 'unassigned', assignee: null },
      { stageName: 'Dev', status: 'blocked', ownership: 'locked', assignee: 'Kozlov D.' },
      { stageName: 'Testing', status: 'blocked', ownership: 'mine', assignee: 'Polenkov A.', tooltip: 'Blocked: ETL testing blocked — waiting for Dev fix' },
      { stageName: 'DevOps', status: 'on-track', ownership: 'locked', assignee: 'Sidorov P.' },
      { stageName: 'Support', status: 'empty', ownership: 'unassigned', assignee: null },
    ],
  },
  {
    id: 'mobile',
    name: 'Mobile Applications',
    overallStatus: 'at-risk',
    riskSummary: '1 risk',
    riskCount: 1,
    stages: [
      { stageName: 'Planning', status: 'empty', ownership: 'unassigned', assignee: null },
      { stageName: 'Analysis', status: 'empty', ownership: 'unassigned', assignee: null },
      { stageName: 'Design', status: 'at-risk', ownership: 'locked', assignee: 'Petrova M.' },
      { stageName: 'Dev', status: 'at-risk', ownership: 'locked', assignee: 'Smirnov K.' },
      { stageName: 'Testing', status: 'empty', ownership: 'unassigned', assignee: null },
      { stageName: 'DevOps', status: 'on-track', ownership: 'mine', assignee: 'Polenkov A.', tooltip: 'Your stage - On Track' },
      { stageName: 'Support', status: 'empty', ownership: 'unassigned', assignee: null },
    ],
  },
  {
    id: 'cloud',
    name: 'Cloud Infrastructure',
    overallStatus: 'at-risk',
    riskSummary: '1 risk',
    riskCount: 1,
    stages: [
      { stageName: 'Planning', status: 'empty', ownership: 'unassigned', assignee: null },
      { stageName: 'Analysis', status: 'on-track', ownership: 'locked', assignee: 'Ivanov A.' },
      { stageName: 'Design', status: 'empty', ownership: 'unassigned', assignee: null },
      { stageName: 'Dev', status: 'at-risk', ownership: 'mine', assignee: 'Polenkov A.', tooltip: 'At Risk: PgBouncer migration requires 30 min downtime' },
      { stageName: 'Testing', status: 'on-track', ownership: 'locked', assignee: 'Novikova E.' },
      { stageName: 'DevOps', status: 'on-track', ownership: 'locked', assignee: 'Sidorov P.' },
      { stageName: 'Support', status: 'empty', ownership: 'unassigned', assignee: null },
    ],
  },
  {
    id: 'aiml',
    name: 'AI/ML Platform',
    overallStatus: 'on-track',
    stages: [
      { stageName: 'Planning', status: 'on-track', ownership: 'locked', assignee: 'PM' },
      { stageName: 'Analysis', status: 'on-track', ownership: 'locked', assignee: 'Ivanov A.' },
      { stageName: 'Design', status: 'on-track', ownership: 'locked', assignee: 'Petrova M.' },
      { stageName: 'Dev', status: 'on-track', ownership: 'locked', assignee: 'Smirnov K.' },
      { stageName: 'Testing', status: 'empty', ownership: 'mine', assignee: 'Polenkov A.' },
      { stageName: 'DevOps', status: 'empty', ownership: 'unassigned', assignee: null },
      { stageName: 'Support', status: 'on-track', ownership: 'locked', assignee: 'Support' },
    ],
  },
  {
    id: 'gateway',
    name: 'Integration Gateway',
    overallStatus: 'on-track',
    stages: [
      { stageName: 'Planning', status: 'empty', ownership: 'unassigned', assignee: null },
      { stageName: 'Analysis', status: 'on-track', ownership: 'locked', assignee: 'Ivanov A.' },
      { stageName: 'Design', status: 'on-track', ownership: 'locked', assignee: 'Petrova M.' },
      { stageName: 'Dev', status: 'empty', ownership: 'mine', assignee: 'Polenkov A.' },
      { stageName: 'Testing', status: 'empty', ownership: 'unassigned', assignee: null },
      { stageName: 'DevOps', status: 'empty', ownership: 'unassigned', assignee: null },
      { stageName: 'Support', status: 'empty', ownership: 'unassigned', assignee: null },
    ],
  },
];

export const MOCK_CURRENT_WEEK_ITEMS: KanbanItem[] = [
  { id: 'cw1', productId: 'crm', productName: 'CRM Platform', status: 'in-progress', text: 'Интеграция OAuth2 для партнёрского API', author: 'Polenkov A.' },
  { id: 'cw2', productId: 'crm', productName: 'CRM Platform', status: 'completed', text: 'Настройка rate limiter для API', author: 'Polenkov A.' },
  { id: 'cw3', productId: 'crm', productName: 'CRM Platform', status: 'in-progress', text: 'Оптимизация поиска клиентов', author: 'Polenkov A.' },
  { id: 'cw4', productId: 'crm', productName: 'CRM Platform', status: 'completed', text: 'Логика повторных вызовов webhook', author: 'Polenkov A.' },
  { id: 'cw5', productId: 'analytics', productName: 'Data Analytics Suite', stageName: 'Testing', status: 'in-progress', text: 'Регрессионное тестирование ETL пайплайна', author: 'Polenkov A.' },
  { id: 'cw6', productId: 'analytics', productName: 'Data Analytics Suite', stageName: 'Testing', status: 'completed', text: 'Нагрузочное тестирование BI дашборда', author: 'Polenkov A.' },
  { id: 'cw7', productId: 'mobile', productName: 'Mobile Applications', stageName: 'DevOps', status: 'in-progress', text: 'Настройка CI/CD для iOS сборок', author: 'Polenkov A.' },
  { id: 'cw8', productId: 'cloud', productName: 'Cloud Infrastructure', status: 'completed', text: 'Мониторинг K8s + алерты Grafana', author: 'Polenkov A.' },
  { id: 'cw9', productId: 'cloud', productName: 'Cloud Infrastructure', status: 'in-progress', text: 'Настройка пула соединений PgBouncer', author: 'Polenkov A.' },
  { id: 'cw10', productId: 'aiml', productName: 'AI/ML Platform', status: 'in-progress', text: 'Пайплайн обучения моделей v2', author: 'Polenkov A.' },
  { id: 'cw11', productId: 'gateway', productName: 'Integration Gateway', status: 'in-progress', text: 'Прототип моста REST - gRPC', author: 'Polenkov A.' },
];

export const MOCK_NEXT_WEEK_ITEMS: KanbanItem[] = [
  { id: 'nw1', productId: 'crm', productName: 'CRM Platform', status: 'planned', text: 'Настройка фреймворка A/B тестирования', author: 'Polenkov A.' },
  { id: 'nw2', productId: 'crm', productName: 'CRM Platform', status: 'planned', text: 'SSO интеграция партнёрского портала', author: 'Polenkov A.' },
  { id: 'nw3', productId: 'crm', productName: 'CRM Platform', status: 'planned', text: 'MVP конструктора email шаблонов', author: 'Polenkov A.' },
  { id: 'nw4', productId: 'cloud', productName: 'Cloud Infrastructure', status: 'planned', text: 'Миграция CI/CD на GitHub Actions', author: 'Polenkov A.' },
  { id: 'nw5', productId: 'aiml', productName: 'AI/ML Platform', status: 'planned', text: 'Настройка автоскейлинга GPU кластера', author: 'Polenkov A.' },
  { id: 'nw6', productId: 'gateway', productName: 'Integration Gateway', status: 'planned', text: 'Проектирование стратегии версионирования API', author: 'Polenkov A.' },
];

export const MOCK_RISKS: RiskEntry[] = [
  { id: 'r1', productId: 'crm', productName: 'CRM Platform', stageName: 'Dev', severity: 'at-risk', text: 'Задержка интеграции OAuth2 из-за лимитов API партнёра.', impact: 'Сдвиг SSO портала на следующую неделю.', mitigation: 'Ожидаем ответ техподдержки партнёра, готовим batch-fallback.' },
  { id: 'r2', productId: 'cloud', productName: 'Cloud Infrastructure', stageName: 'Dev', severity: 'at-risk', text: 'Миграция PgBouncer требует downtime 30 мин.', impact: 'Окно обслуживания затрагивает зависимые сервисы.', mitigation: 'Координация с DBA на среду, rollback-план готов.' },
  { id: 'r3', productId: 'analytics', productName: 'Data Analytics Suite', stageName: 'Testing', severity: 'blocked', text: 'Регрессионное тестирование ETL заблокировано — утечка памяти у Dev stage.', impact: 'Блокирует релиз Analytics до фикса.', mitigation: 'Эскалирована заявка на фикс, ETA 25 апреля.' },
];

export const MOCK_DECISIONS: DecisionEntry[] = [
  { id: 'd1', productId: 'cloud', productName: 'Cloud Infrastructure', text: 'Требуется одобрение дополнительного Redis-кластера для кеширования', owner: 'Глава департамента', impact: 'Снижает p99 на 30%, требует CapEx-одобрения.', deadline: null },
  { id: 'd2', productId: 'aiml', productName: 'AI/ML Platform', text: 'Выбор между AWS SageMaker и self-hosted для model serving', owner: 'Глава департамента', impact: 'Влияет на TCO и time-to-market.', deadline: null },
];

export const MOCK_PRIORITIES: PriorityEntry[] = [
  { rank: 1, text: 'Запустить Dev для Gateway для CRM Platform (At Risk)' },
  { rank: 2, text: 'Запустить Dev pipeline для Integration Gateway' },
  { rank: 3, text: 'Подготовить Testing для AI/ML Platform' },
];

export const MOCK_PERIODS: ReportPeriod[] = [
  { id: '2026-W16', sourceSectionId: 'sec-W16', weekLabel: 'Week 16', dateRange: 'Apr 14-20', isCurrent: true, isSubmitted: false },
  { id: '2026-W15', sourceSectionId: 'sec-W15', weekLabel: 'Week 15', dateRange: 'Apr 7-13', isCurrent: false, isSubmitted: true, productCount: 6, itemCount: 9, riskCount: 0 },
  { id: '2026-W14', sourceSectionId: 'sec-W14', weekLabel: 'Week 14', dateRange: 'Mar 31-Apr 6', isCurrent: false, isSubmitted: true, productCount: 5, itemCount: 8, riskCount: 1 },
  { id: '2026-W13', sourceSectionId: 'sec-W13', weekLabel: 'Week 13', dateRange: 'Mar 24-30', isCurrent: false, isSubmitted: true, productCount: 5, itemCount: 7, riskCount: 0 },
  { id: '2026-W12', sourceSectionId: 'sec-W12', weekLabel: 'Week 12', dateRange: 'Mar 17-23', isCurrent: false, isSubmitted: true, productCount: 4, itemCount: 6, riskCount: 2 },
];

export const MOCK_VERSIONS: VersionSnapshot[] = [
  { version: 3, timestamp: '2 min ago', itemCount: 11, riskCount: 3, decisionCount: 2 },
  { version: 2, timestamp: '1h ago', itemCount: 10, riskCount: 2, decisionCount: 2 },
  { version: 1, timestamp: '3h ago', itemCount: 8, riskCount: 1, decisionCount: 1 },
];

export const MOCK_HISTORY: HistoryEntry[] = [
  { id: 'h1', periodId: '2026-W15', weekLabel: 'Week 15', dateRange: 'Apr 7-13', status: 'submitted', submittedAt: 'Apr 13, 17:42', trafficLights: { green: 5, yellow: 1, red: 0 }, itemCount: 9, riskCount: 0, decisionCount: 1 },
  { id: 'h2', periodId: '2026-W14', weekLabel: 'Week 14', dateRange: 'Mar 31-Apr 6', status: 'submitted', submittedAt: 'Apr 6, 16:15', trafficLights: { green: 4, yellow: 1, red: 1 }, itemCount: 8, riskCount: 1, decisionCount: 0 },
  { id: 'h3', periodId: '2026-W13', weekLabel: 'Week 13', dateRange: 'Mar 24-30', status: 'submitted', submittedAt: 'Mar 30, 18:00', trafficLights: { green: 5, yellow: 0, red: 0 }, itemCount: 7, riskCount: 0, decisionCount: 2 },
  { id: 'h4', periodId: '2026-W12', weekLabel: 'Week 12', dateRange: 'Mar 17-23', status: 'submitted', submittedAt: 'Mar 23, 15:30', trafficLights: { green: 3, yellow: 0, red: 2 }, itemCount: 6, riskCount: 2, decisionCount: 1 },
  { id: 'h5', periodId: '2026-W11', weekLabel: 'Week 11', dateRange: 'Mar 10-16', status: 'submitted', submittedAt: 'Mar 16, 17:10', trafficLights: { green: 4, yellow: 1, red: 0 }, itemCount: 10, riskCount: 1, decisionCount: 0 },
  { id: 'h6', periodId: '2026-W10', weekLabel: 'Week 10', dateRange: 'Mar 3-9', status: 'submitted', submittedAt: 'Mar 9, 16:45', trafficLights: { green: 5, yellow: 0, red: 0 }, itemCount: 8, riskCount: 0, decisionCount: 1 },
];
