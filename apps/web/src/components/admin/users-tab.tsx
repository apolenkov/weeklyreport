'use client';

import { useState } from 'react';

import type { MockUser, UserRole } from './mock-data';
import { MOCK_USERS } from './mock-data';

type UserFormData = {
  name: string;
  email: string;
  role: UserRole;
  department: string;
};

const EMPTY_FORM: UserFormData = { name: '', email: '', role: 'lead', department: 'CoreDev' };

export function UsersTab() {
  const [users, setUsers] = useState<MockUser[]>(MOCK_USERS);
  const [editingUser, setEditingUser] = useState<MockUser | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MockUser | null>(null);
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM);

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
    if (editingUser) {
      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, ...form } : u)),
      );
    } else {
      const newUser: MockUser = {
        id: `u${Date.now()}`,
        ...form,
      };
      setUsers((prev) => [...prev, newUser]);
    }
    setShowDialog(false);
  }

  function handleDelete() {
    if (deleteTarget) {
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
  }

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
            className="btn-press inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            aria-label="Add new user"
          >
            <PlusIcon />
            Add User
          </button>
        </div>

        {/* Users table */}
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
          <table className="w-full text-left text-sm">
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
              {users.map((user) => (
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
                        className="btn-press rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
                        aria-label={`Edit ${user.name}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(user)}
                        className="btn-press rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium text-[var(--color-destructive)] transition-colors hover:bg-red-50"
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
      </div>

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div
            className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={editingUser ? 'Edit user' : 'Add user'}
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
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
              >
                {editingUser ? 'Save Changes' : 'Add User'}
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
                className="btn-press rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-destructive)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                Delete
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
