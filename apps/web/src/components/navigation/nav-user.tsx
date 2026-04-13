'use client';

import { LogOut } from 'lucide-react';

import type { Role } from '@customreport/shared';

import {
  Avatar,
  AvatarFallback,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@customreport/ui';

type NavUserProps = {
  readonly userName: string;
  readonly userRole: Role;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    lead: 'Lead',
    head: 'Head',
    viewer: 'Viewer',
  };
  return labels[role];
}

function getRoleBadgeVariant(role: Role): 'default' | 'secondary' | 'outline' {
  const variants: Record<Role, 'default' | 'secondary' | 'outline'> = {
    head: 'default',
    lead: 'secondary',
    viewer: 'outline',
  };
  return variants[role];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function NavUser({ userName, userRole }: NavUserProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg p-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="User menu"
        >
          <Avatar className="size-8 border border-border">
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden items-start gap-1 lg:flex lg:flex-col">
            <span className="max-w-[120px] truncate text-sm font-medium leading-tight">
              {userName}
            </span>
            <Badge variant={getRoleBadgeVariant(userRole)} className="h-4 px-1.5 text-[10px] leading-none">
              {getRoleLabel(userRole)}
            </Badge>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1.5 py-2">
          <span className="font-semibold">{userName}</span>
          <Badge variant={getRoleBadgeVariant(userRole)} className="w-fit text-xs">
            {getRoleLabel(userRole)}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={`${API_URL}/auth/logout`} className="flex cursor-pointer items-center gap-2">
            <LogOut className="size-4" />
            <span>Log out</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
