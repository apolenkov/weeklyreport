'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { invalidateAdmin } from '../../lib/cache-keys';
import { toAdminUserInput } from '../../lib/mappers';
import { useTRPC } from '../../lib/trpc-context';

import type { MockUser, UserRole } from './mock-data';

type UserFormData = {
  name: string;
  email: string;
  role: UserRole;
  department: string;
};

const EMPTY_FORM: UserFormData = { name: '', email: '', role: 'lead', department: 'Development' };

type UsersTabProps = {
  readonly users: MockUser[];
};

export function UsersTab({ users }: UsersTabProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [editingUser, setEditingUser] = useState<MockUser | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MockUser | null>(null);
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM);
  const [search, setSearch] = useState('');

  // Escape closes the Add/Edit dialog. The dialog is rendered inline (not
  // through a Radix wrapper) so we wire the listener manually.
  useEffect(() => {
    if (!showDialog) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDialog(false);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showDialog]);

  const saveUserMut = useMutation(
    trpc.admin.saveUser.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success('User saved');
        setShowDialog(false);
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to save user');
      },
    }),
  );

  const deleteUserMut = useMutation(
    trpc.admin.deleteUser.mutationOptions({
      onSuccess: () => {
        invalidateAdmin(qc, trpc);
        toast.success('User deleted');
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(err.message ?? 'Failed to delete user');
      },
    }),
  );

  function openAdd() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  }

  function openEdit(user: MockUser) {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, role: user.role, department: user.department });
    setShowDialog(true);
  }

  function handleSave() {
    saveUserMut.mutate(toAdminUserInput(form, editingUser?.id));
  }

  function handleDelete() {
    if (deleteTarget) {
      deleteUserMut.mutate({ userId: deleteTarget.id });
    }
  }

  const isSaving = saveUserMut.isPending;
  const isDeleting = deleteUserMut.isPending;
  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      [user.name, user.email, user.role, user.department]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [search, users]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {users.length} users registered
          </p>
          <button
            type="button"
            onClick={openAdd}
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            aria-label="Add new user"
          >
            <PlusIcon />
            Add User
          </button>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          aria-label="Search users"
        />

        {/* Users table */}
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-left text-sm" data-testid="users-table">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">Name</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">Email</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">Role</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">Department</th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--color-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[#f8f6f2]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{user.name}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{user.email}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{user.department}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:border-[rgba(0,117,74,0.3)] hover:bg-[var(--color-success)]"
                        aria-label={`Edit ${user.name}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(user)}
                        className="btn-press inline-flex min-h-[34px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.1)] bg-white px-3 text-xs font-semibold text-[var(--color-destructive)] transition-colors hover:border-[rgba(200,32,20,0.3)] hover:bg-red-50"
                        aria-label={`Delete ${user.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[#fafaf7] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
            No users match the search.
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
          onClick={() => setShowDialog(false)}
          role="presentation"
          data-testid="crud-sheet"
        >
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={editingUser ? 'Edit user' : 'Add user'}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              {editingUser ? 'Edit User' : 'Add User'}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="user-name" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
                  Name
                </label>
                <input
                  id="user-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div>
                <label htmlFor="user-email" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
                  Email
                </label>
                <input
                  id="user-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
              <div>
                <label htmlFor="user-role" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
                  Role
                </label>
                <select
                  id="user-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                >
                  <option value="lead">Lead</option>
                  <option value="head">Head</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <label htmlFor="user-dept" className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
                  Department
                </label>
                <input
                  id="user-dept"
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                disabled={isSaving}
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : editingUser ? 'Save Changes' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-sm rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm delete"
          >
            <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              Delete User?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Delete {deleteTarget.name}? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-destructive)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- Helper components ----

function RoleBadge({ role }: { readonly role: UserRole }) {
  const styles: Record<UserRole, { bg: string; text: string }> = {
    lead: { bg: 'var(--color-success)', text: 'var(--color-primary)' },
    head: { bg: '#e8e0f0', text: '#6b21a8' },
    admin: { bg: '#fef3c7', text: '#92400e' },
    viewer: { bg: 'var(--color-muted)', text: 'var(--color-muted-foreground)' },
  };
  const s = styles[role];

  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold capitalize"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {role}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" stroke="currentColor" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
