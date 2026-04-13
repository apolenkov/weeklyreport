'use client';

import { useState } from 'react';
import {
  Bell,
  Calendar,
  FolderKanban,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { formatDate, formatDateTime, formatPeriodDate } from '../../lib/format-date';

import type {
  AdminProject,
  AdminReminderRule,
  AdminSnapshot,
  AdminUser,
  ReportPeriod,
  Role,
} from '@customreport/shared';

import {
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  CrudSheet,
  DataTable,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@customreport/ui';
import type { Column } from '@customreport/ui';

type AdminPanelProps = {
  readonly initialSnapshot: AdminSnapshot;
  readonly onUpsertUser: (user: AdminUser) => Promise<AdminSnapshot>;
  readonly onRemoveUser: (userId: string) => Promise<AdminSnapshot>;
  readonly onUpsertProject: (project: AdminProject) => Promise<AdminSnapshot>;
  readonly onUpsertPeriod: (period: ReportPeriod) => Promise<AdminSnapshot>;
  readonly onUpsertReminderRule: (
    rule: AdminReminderRule,
  ) => Promise<AdminSnapshot>;
  readonly onRunCarryOver: () => Promise<boolean>;
  readonly onRequestReminderExecution: (
    ruleId: string,
    recipientEmail: string,
  ) => Promise<AdminSnapshot>;
};

function buildUserId(): string {
  return crypto.randomUUID();
}

function StatCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminPanel({
  initialSnapshot,
  onRemoveUser,
  onUpsertPeriod,
  onUpsertProject,
  onRunCarryOver,
  onRequestReminderExecution,
  onUpsertReminderRule,
  onUpsertUser,
}: AdminPanelProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  // User form state
  const [userSheetOpen, setUserSheetOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState<Role>('lead');
  const [userLoading, setUserLoading] = useState(false);

  // Confirm dialog states
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserName, setDeleteUserName] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [carryOverOpen, setCarryOverOpen] = useState(false);
  const [carryOverLoading, setCarryOverLoading] = useState(false);

  const [reminderRunId, setReminderRunId] = useState<string | null>(null);
  const [reminderRunLoading, setReminderRunLoading] = useState(false);

  // Project/Period/Reminder sheet states
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const [projectLoading, setProjectLoading] = useState(false);
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);

  function resetUserForm() {
    setUserName('');
    setUserEmail('');
    setUserRole('lead');
  }

  function handleUserSheetChange(open: boolean) {
    setUserSheetOpen(open);
    if (!open) {
      resetUserForm();
    }
  }

  async function handleAddUser() {
    setUserLoading(true);
    try {
      const nextSnapshot = await onUpsertUser({
        id: buildUserId(),
        email: userEmail,
        name: userName,
        role: userRole,
      });
      setSnapshot(nextSnapshot);
      toast.success('User added', {
        description: `${userName} has been added as ${userRole}.`,
      });
      setUserSheetOpen(false);
      resetUserForm();
    } finally {
      setUserLoading(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserId) return;
    setDeleteLoading(true);
    try {
      const nextSnapshot = await onRemoveUser(deleteUserId);
      setSnapshot(nextSnapshot);
      toast.success('Deleted', {
        description: `${deleteUserName} has been removed.`,
      });
      setDeleteUserId(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleBootstrapProject() {
    const lead = snapshot.users.find((row) => row.role === 'lead');
    if (!lead) return;
    setProjectLoading(true);
    try {
      const nextSnapshot = await onUpsertProject({
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Project Bootstrap',
        archived: false,
        leadId: lead.id,
        leadName: lead.name,
      });
      setSnapshot(nextSnapshot);
      toast.success('Project created', {
        description: 'Project Bootstrap has been added.',
      });
      setProjectSheetOpen(false);
    } finally {
      setProjectLoading(false);
    }
  }

  async function handleBootstrapPeriod() {
    setPeriodLoading(true);
    try {
      const nextSnapshot = await onUpsertPeriod({
        id: '88888888-8888-4888-8888-888888888888',
        periodStart: new Date('2026-04-20T00:00:00.000Z'),
        periodEnd: new Date('2026-04-26T23:59:59.000Z'),
        deadline: new Date('2026-04-24T15:00:00.000Z'),
        status: 'draft',
      });
      setSnapshot(nextSnapshot);
      toast.success('Period created', {
        description: 'Report period has been added.',
      });
      setPeriodSheetOpen(false);
    } finally {
      setPeriodLoading(false);
    }
  }

  async function handleBootstrapReminderRule() {
    const firstPeriod = snapshot.periods[0];
    if (!firstPeriod) return;
    setReminderLoading(true);
    try {
      const nextSnapshot = await onUpsertReminderRule({
        id: '99999999-9999-4999-8999-999999999998',
        reportId: firstPeriod.id,
        kind: 'deadline',
        fireAt: new Date('2026-04-24T09:00:00.000Z'),
        timezone: 'Europe/Moscow',
        status: 'active',
        version: 1,
      });
      setSnapshot(nextSnapshot);
      toast.success('Reminder rule created', {
        description: 'Deadline reminder has been added.',
      });
      setReminderSheetOpen(false);
    } finally {
      setReminderLoading(false);
    }
  }

  function describeLatestExecution(ruleId: string): string {
    const latestExecution = snapshot.reminderExecutions
      .filter((row) => row.ruleId === ruleId)
      .at(-1);

    if (!latestExecution) {
      return '---';
    }

    return `${latestExecution.recipientEmail} -- ${latestExecution.status}`;
  }

  async function handleRunReminder(ruleId: string) {
    const leadRecipient = snapshot.users.find(
      (row) => row.role === 'lead',
    )?.email;
    if (!leadRecipient) return;

    setReminderRunLoading(true);
    try {
      const nextSnapshot = await onRequestReminderExecution(
        ruleId,
        leadRecipient,
      );
      setSnapshot(nextSnapshot);
      toast.success('Reminder sent', {
        description: `Reminder sent to ${leadRecipient}.`,
      });
      setReminderRunId(null);
    } finally {
      setReminderRunLoading(false);
    }
  }

  async function handleRunCarryOver() {
    setCarryOverLoading(true);
    try {
      const completed = await onRunCarryOver();
      if (completed) {
        toast.success('Carry-over completed', {
          description:
            'Pending items have been copied to the current period.',
        });
      } else {
        toast.error('Carry-over skipped', {
          description: 'Not enough periods to run carry-over.',
        });
      }
      setCarryOverOpen(false);
    } finally {
      setCarryOverLoading(false);
    }
  }

  // --- Column definitions ---

  const userColumns: Column<AdminUser>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      cell: (row) => (
        <Badge variant={row.role === 'head' ? 'default' : 'secondary'}>
          {row.role}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) =>
        row.role !== 'head' ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${row.name}`}
            className="text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteUserId(row.id);
              setDeleteUserName(row.name);
            }}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        ) : null,
    },
  ];

  const projectColumns: Column<AdminProject>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'leadName', header: 'Lead' },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.archived ? 'outline' : 'secondary'}>
          {row.archived ? 'Archived' : 'Active'}
        </Badge>
      ),
    },
  ];

  const periodColumns: Column<ReportPeriod>[] = [
    {
      key: 'period',
      header: 'Period',
      cell: (row) =>
        `${formatPeriodDate(row.periodStart)} \u2013 ${formatPeriodDate(row.periodEnd)}`,
    },
    {
      key: 'deadline',
      header: 'Deadline',
      cell: (row) => formatDate(row.deadline),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <Badge variant="secondary">{row.status}</Badge>,
    },
  ];

  const reminderColumns: Column<AdminReminderRule>[] = [
    { key: 'kind', header: 'Kind', sortable: true },
    {
      key: 'fireAt',
      header: 'Fire At',
      cell: (row) => formatDateTime(row.fireAt),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.status === 'active' ? 'secondary' : 'outline'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'execution',
      header: 'Last Execution',
      cell: (row) => (
        <span className="text-muted-foreground">
          {describeLatestExecution(row.id)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setReminderRunId(row.id);
          }}
        >
          Run
        </Button>
      ),
    },
  ];

  const activeProjects = snapshot.projects.filter((p) => !p.archived).length;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Page header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-base text-muted-foreground">Manage users, projects, periods, and reminders</p>
      </div>

      {/* Stats overview */}
      <div className="stagger-children grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Users"
          value={snapshot.users.length}
          colorClass="bg-primary/10 text-primary"
        />
        <StatCard
          icon={FolderKanban}
          label="Active Projects"
          value={activeProjects}
          colorClass="bg-[oklch(0.68_0.17_152)]/10 text-[oklch(0.68_0.17_152)]"
        />
        <StatCard
          icon={Calendar}
          label="Periods"
          value={snapshot.periods.length}
          colorClass="bg-warning/10 text-warning"
        />
        <StatCard
          icon={Bell}
          label="Reminder Rules"
          value={snapshot.reminderRules.length}
          colorClass="bg-[oklch(0.62_0.18_310)]/10 text-[oklch(0.62_0.18_310)]"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-5 w-5" />
            Users
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5">
            <FolderKanban className="h-5 w-5" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="periods" className="gap-1.5">
            <Calendar className="h-5 w-5" />
            Periods
          </TabsTrigger>
          <TabsTrigger value="reminders" className="gap-1.5">
            <Bell className="h-5 w-5" />
            Reminders
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setUserSheetOpen(true)}>Add User</Button>
          </div>
          <DataTable
            columns={userColumns}
            data={snapshot.users}
            aria-label="Users"
          />
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setProjectSheetOpen(true)}>Add Project</Button>
          </div>
          <DataTable
            columns={projectColumns}
            data={snapshot.projects}
            aria-label="Projects"
          />
        </TabsContent>

        {/* Periods Tab */}
        <TabsContent value="periods" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setCarryOverOpen(true)}
            >
              <RefreshCw className="h-5 w-5" />
              Run Carry-Over
            </Button>
            <Button onClick={() => setPeriodSheetOpen(true)}>Add Period</Button>
          </div>
          <DataTable
            columns={periodColumns}
            data={snapshot.periods}
            aria-label="Report periods"
          />
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setReminderSheetOpen(true)}>Add Rule</Button>
          </div>
          <DataTable
            columns={reminderColumns}
            data={snapshot.reminderRules}
            aria-label="Reminder rules"
          />
        </TabsContent>
      </Tabs>

      {/* Add User Sheet */}
      <CrudSheet
        open={userSheetOpen}
        onOpenChange={handleUserSheetChange}
        title="Add User"
        description="Add a new user to the system."
        submitLabel="Add User"
        loading={userLoading}
        onSubmit={() => void handleAddUser()}
      >
        <div className="space-y-2">
          <Label htmlFor="user-name">Name</Label>
          <Input
            id="user-name"
            value={userName}
            onChange={(e) => setUserName(e.currentTarget.value)}
            placeholder="Full name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.currentTarget.value)}
            placeholder="user@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-role">Role</Label>
          <Select
            value={userRole}
            onValueChange={(value) => setUserRole(value as Role)}
          >
            <SelectTrigger id="user-role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="head">Head</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CrudSheet>

      {/* Add Project Sheet (bootstrap) */}
      <CrudSheet
        open={projectSheetOpen}
        onOpenChange={setProjectSheetOpen}
        title="Add Project"
        description="Create a bootstrap project with the first available lead."
        submitLabel="Create Project"
        loading={projectLoading}
        onSubmit={() => void handleBootstrapProject()}
      >
        <p className="text-sm text-muted-foreground">
          This will create a bootstrap project assigned to the first lead
          in the system.
        </p>
      </CrudSheet>

      {/* Add Period Sheet (bootstrap) */}
      <CrudSheet
        open={periodSheetOpen}
        onOpenChange={setPeriodSheetOpen}
        title="Add Period"
        description="Create a bootstrap report period."
        submitLabel="Create Period"
        loading={periodLoading}
        onSubmit={() => void handleBootstrapPeriod()}
      >
        <p className="text-sm text-muted-foreground">
          This will create a report period for Apr 20-26, 2026 with a
          deadline of Apr 24.
        </p>
      </CrudSheet>

      {/* Add Reminder Rule Sheet (bootstrap) */}
      <CrudSheet
        open={reminderSheetOpen}
        onOpenChange={setReminderSheetOpen}
        title="Add Reminder Rule"
        description="Create a deadline reminder rule for the first period."
        submitLabel="Create Rule"
        loading={reminderLoading}
        onSubmit={() => void handleBootstrapReminderRule()}
      >
        <p className="text-sm text-muted-foreground">
          This will create a deadline reminder for the first report
          period.
        </p>
      </CrudSheet>

      {/* Delete User Confirmation */}
      <ConfirmDialog
        open={deleteUserId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteUserId(null);
        }}
        title="Remove User"
        description={`This will remove ${deleteUserName} from the system. This action cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={() => void handleDeleteUser()}
      />

      {/* Carry-Over Confirmation */}
      <ConfirmDialog
        open={carryOverOpen}
        onOpenChange={setCarryOverOpen}
        title="Run Carry-Over"
        description="Pending items and unresolved decisions will be copied to the current period. Continue?"
        confirmLabel="Run Carry-Over"
        variant="default"
        loading={carryOverLoading}
        onConfirm={() => void handleRunCarryOver()}
      />

      {/* Run Reminder Confirmation */}
      <ConfirmDialog
        open={reminderRunId !== null}
        onOpenChange={(open) => {
          if (!open) setReminderRunId(null);
        }}
        title="Run Reminder"
        description="This will send the reminder to the first lead. Continue?"
        confirmLabel="Send Reminder"
        variant="default"
        loading={reminderRunLoading}
        onConfirm={() => {
          if (reminderRunId) {
            void handleRunReminder(reminderRunId);
          }
        }}
      />
    </div>
  );
}
