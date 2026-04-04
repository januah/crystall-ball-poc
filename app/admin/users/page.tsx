'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Toast, useToast } from '@/components/ui/toast';
import { UserPlus, Copy, X } from 'lucide-react';

const ROLES = [
  { id: 'admin',   label: 'Admin' },
  { id: 'analyst', label: 'Analyst' },
  { id: 'viewer',  label: 'Viewer' },
];

function genTempPassword() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function CreateUserModal({
  roleOptions,
  onClose,
  onCreated,
}: {
  roleOptions: any[];
  onClose: () => void;
  onCreated: (password: string) => void;
}) {
  const [form, setForm] = useState({ email: '', fullName: '', department: '', roleId: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.email || !form.roleId) {
      setError('Email and role are required.');
      return;
    }
    setLoading(true);
    setError('');
    const tempPassword = genTempPassword();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, password: tempPassword }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onCreated(tempPassword);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
      <div className="bg-card rounded-2xl border border-border p-8 w-full max-w-md shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Create User</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</div>}
        {[
          { key: 'email', label: 'Email', type: 'email', required: true },
          { key: 'fullName', label: 'Full Name', type: 'text' },
          { key: 'department', label: 'Department', type: 'text' },
        ].map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs text-muted-foreground">{f.label}{f.required && ' *'}</label>
            <Input
              type={f.type}
              value={(form as any)[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              className="dark:bg-input dark:border-border"
            />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Role *</label>
          <select
            value={form.roleId}
            onChange={(e) => setForm((prev) => ({ ...prev, roleId: e.target.value }))}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select role…</option>
            {roleOptions.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} className="dark:bg-accent dark:hover:bg-accent/80">Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating…' : 'Create User'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { toast, showToast, hideToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) return [];
      const { data } = await res.json();
      return data ?? [];
    },
  });

  // Fetch roles from DB (reuse users data structure or hardcode)
  const roleOptions = ROLES;

  const roleMutation = useMutation({
    mutationFn: async ({ id, roleId }: { id: string; roleId: string }) => {
      const res = await fetch(`/api/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });
      if (!res.ok) throw new Error('Failed to update role');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('Role updated.');
    },
    onError: () => showToast('Failed to update role.'),
  });

  const statusMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}/status`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to toggle status');
      const { data } = await res.json();
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast(`${data.full_name ?? 'User'} ${data.is_active ? 'activated' : 'deactivated'}.`);
    },
    onError: () => showToast('Failed to toggle status.'),
  });

  return (
    <div className="flex min-h-screen">
      {toast && <Toast message={toast} onClose={hideToast} />}
      {showCreate && (
        <CreateUserModal
          roleOptions={roleOptions}
          onClose={() => setShowCreate(false)}
          onCreated={(pw) => {
            setShowCreate(false);
            setTempPassword(pw);
            queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      )}
      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 w-full max-w-sm shadow-xl space-y-4 text-center">
            <h2 className="text-base font-bold text-slate-900">User Created</h2>
            <p className="text-xs text-slate-500">Share this temporary password with the user. It will not be shown again.</p>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
              <span className="font-mono text-sm text-slate-800 flex-1">{tempPassword}</span>
              <button onClick={() => { navigator.clipboard.writeText(tempPassword); showToast('Copied!'); }}>
                <Copy className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <Button onClick={() => setTempPassword('')} className="w-full">Done</Button>
          </div>
        </div>
      )}

      <Sidebar />
      <main className="flex-1 ml-[240px]">
        <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">User Management</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Manage team access and roles</p>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <UserPlus className="h-4 w-4" /> Invite User
            </Button>
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Users', value: users.length },
              { label: 'Active', value: users.filter((u: any) => u.is_active).length },
              { label: 'Inactive', value: users.filter((u: any) => !u.is_active).length },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Team Members</CardTitle></CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading users…</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600/20 text-violet-400 text-xs font-bold">
                              {(user.full_name ?? user.email ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium text-foreground">{user.full_name ?? '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell className="text-muted-foreground">{user.department ?? '—'}</TableCell>
                        <TableCell>
                          <select
                            value={user.role?.id ?? ''}
                            onChange={(e) => roleMutation.mutate({ id: user.id, roleId: e.target.value })}
                            className="appearance-none rounded-md border border-border bg-card px-3 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            {roleOptions.map((r) => (
                              <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'success' : 'outline'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleString('en-MY')
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={user.is_active ? 'danger' : 'ghost'}
                            onClick={() => statusMutation.mutate(user.id)}
                            disabled={statusMutation.isPending}
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
