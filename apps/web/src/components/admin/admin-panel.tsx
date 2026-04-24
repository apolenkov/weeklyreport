'use client';

import { UsersTab } from './users-tab';
import { ProductsTab } from './products-tab';
import { PeriodsTab } from './periods-tab';
import { RemindersTab } from './reminders-tab';
import { SettingsTab } from './settings-tab';

type AdminPanelProps = {
  readonly activeTab: string;
};

export function AdminPanel({ activeTab }: AdminPanelProps) {
  switch (activeTab) {
    case 'users':
      return <UsersTab />;
    case 'products':
      return <ProductsTab />;
    case 'periods':
      return <PeriodsTab />;
    case 'reminders':
      return <RemindersTab />;
    case 'settings':
      return <SettingsTab />;
    default:
      return <UsersTab />;
  }
}
