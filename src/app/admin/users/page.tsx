'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  UserPlus, 
  ShieldCheck, 
  Key, 
  Check, 
  Copy, 
  UserCheck, 
  UserX, 
  Search,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/ToastContext';
import { COLLEGE_ROLES, UserRole, DEPARTMENT_CODES } from '@/config/collegeConfig';

interface ManagedUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
}

export default function UserManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Add User Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('DEPT_COORDINATOR');
  const [formDept, setFormDept] = useState('CSE');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Temporary Password Display Modal
  const [tempPassModal, setTempPassModal] = useState<{
    isOpen: boolean;
    email: string;
    tempPass: string;
  }>({ isOpen: false, email: '', tempPass: '' });
  const [copied, setCopied] = useState(false);

  // Status Toggle Dialog
  const [statusDialog, setStatusDialog] = useState<{
    isOpen: boolean;
    user: ManagedUser | null;
    targetStatus: boolean;
  }>({ isOpen: false, user: null, targetStatus: false });

  // Reset Password Dialog
  const [resetDialog, setResetDialog] = useState<{
    isOpen: boolean;
    user: ManagedUser | null;
  }>({ isOpen: false, user: null });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter !== 'all') params.set('role', roleFilter);
      params.set('limit', '50');

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load user accounts');
      }
      const json = await res.json();
      setUsers(json.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error loading users');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, toast]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'SUPER_ADMIN') {
      router.push('/');
    } else if (status === 'authenticated') {
      const timer = setTimeout(() => {
        void fetchUsers();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [status, session, router, fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFormSubmitting(true);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          department: formRole === 'DEPT_COORDINATOR' ? formDept : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create user');
      }

      setIsAddOpen(false);
      setFormName('');
      setFormEmail('');
      toast.success('User account created successfully');

      // Show temporary password modal
      setTempPassModal({
        isOpen: true,
        email: formEmail.trim(),
        tempPass: json.temporaryPassword,
      });

      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusDialog.user) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/users/${statusDialog.user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: statusDialog.targetStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update user status');

      toast.success(
        statusDialog.targetStatus ? 'User reactivated successfully' : 'User deactivated successfully'
      );
      setStatusDialog({ isOpen: false, user: null, targetStatus: false });
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetDialog.user) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/users/${resetDialog.user._id}/reset-password`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to reset password');

      setResetDialog({ isOpen: false, user: null });
      setTempPassModal({
        isOpen: true,
        email: resetDialog.user.email,
        tempPass: json.temporaryPassword,
      });
      toast.success('Temporary password generated');
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tempPassModal.tempPass);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'loading') {
    return <div className="p-8 text-center text-sm text-slate-500">Authenticating...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <span>User Access & Role Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision staff accounts, assign departmental scopes, and manage credentials with full audit trails.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsAddOpen(true)}
          className="shadow-xs cursor-pointer"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          <span>Provision New User</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-800"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-slate-700 font-semibold"
        >
          <option value="all">All Roles</option>
          {COLLEGE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Department Scope</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Security Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading user directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No user accounts match your search filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">{u.name}</div>
                      <div className="text-[11px] text-slate-400">{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          u.role === 'SUPER_ADMIN'
                            ? 'purple'
                            : u.role === 'TPO'
                            ? 'info'
                            : u.role === 'DEPT_COORDINATOR'
                            ? 'warning'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      {u.department ? (
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">
                          {u.department}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Universal / Campus</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            u.isActive ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="font-semibold text-slate-700">
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                        {u.mustChangePassword && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-semibold ml-1">
                            Pending First Login
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResetDialog({ isOpen: true, user: u })}
                          className="h-8 text-xs cursor-pointer"
                        >
                          <Key className="h-3 w-3 mr-1 text-slate-400" />
                          <span>Reset Password</span>
                        </Button>

                        {session?.user?.id !== u._id && (
                          <Button
                            variant={u.isActive ? 'outline' : 'primary'}
                            size="sm"
                            onClick={() =>
                              setStatusDialog({
                                isOpen: true,
                                user: u,
                                targetStatus: !u.isActive,
                              })
                            }
                            className={`h-8 text-xs cursor-pointer ${
                              u.isActive ? 'text-red-600 border-red-200 hover:bg-red-50' : ''
                            }`}
                          >
                            {u.isActive ? (
                              <>
                                <UserX className="h-3 w-3 mr-1" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3 w-3 mr-1" />
                                <span>Reactivate</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision User Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Provision New Institutional User"
        description="Creates an authenticated account with forced password change on first login."
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Prof. Jane Doe"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Institutional Email</label>
            <input
              type="email"
              required
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="jane.doe@dypcet.ac.in"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Role Assignment</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-slate-800 font-semibold"
              >
                {COLLEGE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {formRole === 'DEPT_COORDINATOR' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department Scope</label>
                <select
                  value={formDept}
                  onChange={(e) => setFormDept(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 text-slate-800 font-semibold"
                >
                  {DEPARTMENT_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsAddOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={formSubmitting}>
              Generate Temporary Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Temporary Password Display Modal (Shown Once) */}
      <Modal
        isOpen={tempPassModal.isOpen}
        onClose={() => setTempPassModal({ isOpen: false, email: '', tempPass: '' })}
        title="Temporary Credentials Generated"
        description="Provide this temporary password securely to the user. It cannot be retrieved again."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              The user will be required to change this password immediately upon their first login.
            </span>
          </div>

          <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between font-mono text-sm tracking-wider">
            <span>{tempPassModal.tempPass}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 cursor-pointer h-8"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>

          <div className="text-right pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => setTempPassModal({ isOpen: false, email: '', tempPass: '' })}
              className="w-full"
            >
              I Have Saved This Password
            </Button>
          </div>
        </div>
      </Modal>

      {/* Status Toggle Dialog */}
      <ConfirmDialog
        isOpen={statusDialog.isOpen}
        onClose={() => setStatusDialog({ isOpen: false, user: null, targetStatus: false })}
        onConfirm={handleToggleStatus}
        loading={actionLoading}
        title={statusDialog.targetStatus ? 'Reactivate User Account?' : 'Deactivate User Account?'}
        description={`Are you sure you want to ${
          statusDialog.targetStatus ? 'reactivate' : 'deactivate'
        } ${statusDialog.user?.email}? ${
          statusDialog.targetStatus
            ? 'The user will regain immediate access to the system.'
            : 'The user will be instantly blocked from logging in or using API endpoints.'
        }`}
        confirmText={statusDialog.targetStatus ? 'Reactivate Account' : 'Deactivate Account'}
        variant={statusDialog.targetStatus ? 'primary' : 'danger'}
      />

      {/* Password Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={resetDialog.isOpen}
        onClose={() => setResetDialog({ isOpen: false, user: null })}
        onConfirm={handleResetPassword}
        loading={actionLoading}
        title="Reset User Password?"
        description={`This will generate a new temporary password for ${resetDialog.user?.email} and invalidate their current password. They will be forced to change it on their next login.`}
        confirmText="Generate New Temporary Password"
        variant="primary"
      />
    </div>
  );
}
