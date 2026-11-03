import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Search,
  Filter,
  KeyRound,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Crown,
  Anchor,
  Flag,
  X,
  Mail,
  Lock,
  Compass,
} from 'lucide-react';
import { UserAccount } from '../types/regatta';
import { authService } from '../services/authService';

interface AdminUserManagementProps {
  currentUser: UserAccount;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ currentUser }) => {
  const [userList, setUserList] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals & Action States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<UserAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);

  // New user form state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserClub, setNewUserClub] = useState('');
  const [newUserSailNumber, setNewUserSailNumber] = useState('');
  const [newUserRole, setNewUserRole] = useState<'ADMIN' | 'RACE_OFFICER' | 'SKIPPER' | 'SPECTATOR'>('RACE_OFFICER');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Password reset state
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Delete state
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Toast / Feedback message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadUsers = async () => {
    setLoading(true);
    const res = await authService.fetchAllUsers();
    setLoading(false);
    if (res.success && res.users) {
      setUserList(res.users);
    } else {
      showToast('error', res.error || 'Failed to load user directory.');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'RACE_OFFICER' | 'SKIPPER' | 'SPECTATOR') => {
    const res = await authService.adminUpdateRole(userId, newRole);
    if (res.success) {
      showToast('success', `Role updated to ${newRole}`);
      loadUsers();
    } else {
      showToast('error', res.error || 'Failed to update role.');
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    const newStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    const res = await authService.adminToggleStatus(user.id, newStatus);
    if (res.success) {
      showToast('success', `Account @${user.username} is now ${newStatus}`);
      loadUsers();
    } else {
      showToast('error', res.error || 'Failed to update user status.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingUser(true);
    const res = await authService.adminCreateUser({
      email: newUserEmail,
      username: newUsername,
      fullName: newFullName,
      password: newUserPassword,
      sailingClub: newUserClub,
      sailNumber: newUserSailNumber,
      role: newUserRole,
    });
    setIsSubmittingUser(false);
    if (res.success) {
      showToast('success', `User @${newUsername} created successfully`);
      setShowAddUserModal(false);
      setNewUserEmail('');
      setNewUsername('');
      setNewFullName('');
      setNewUserPassword('');
      setNewUserClub('');
      setNewUserSailNumber('');
      loadUsers();
    } else {
      showToast('error', res.error || 'Failed to create user account.');
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTarget) return;
    setIsResettingPassword(true);
    const res = await authService.adminResetPassword(resetPasswordTarget.id, newPasswordInput);
    setIsResettingPassword(false);
    if (res.success) {
      showToast('success', res.message || 'Password reset successfully.');
      setResetPasswordTarget(null);
      setNewPasswordInput('');
    } else {
      showToast('error', res.error || 'Failed to reset password.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeletingUser(true);
    const res = await authService.adminDeleteUser(deleteTarget.id);
    setIsDeletingUser(false);
    if (res.success) {
      showToast('success', res.message || 'User deleted successfully.');
      setDeleteTarget(null);
      loadUsers();
    } else {
      showToast('error', res.error || 'Failed to delete user.');
    }
  };

  // Filtered users
  const filteredUsers = userList.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.sailingClub && u.sailingClub.toLowerCase().includes(q)) ||
      (u.sailNumber && u.sailNumber.toLowerCase().includes(q));

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && (u.status === 'ACTIVE' || !u.status)) ||
      (statusFilter === 'SUSPENDED' && u.status === 'SUSPENDED');

    return matchesQuery && matchesRole && matchesStatus;
  });

  // Metrics
  const totalUsers = userList.length;
  const adminCount = userList.filter((u) => u.role === 'ADMIN').length;
  const officerCount = userList.filter((u) => u.role === 'RACE_OFFICER').length;
  const skipperCount = userList.filter((u) => u.role === 'SKIPPER').length;
  const suspendedCount = userList.filter((u) => u.status === 'SUSPENDED').length;

  // Club admins manage their own club; the server decides exactly which users each admin may see and change
  const canManageUsers = currentUser.role === 'ADMIN' || !!currentUser.isSuperAdmin || currentUser.email?.toLowerCase().trim() === 'irsyadismail@gmail.com';
  if (!canManageUsers) {
    return (
      <div className="p-8 text-center bg-lb-slate-950/60 border border-ll-red-500/30 rounded-2xl text-lt-slate-300">
        <ShieldAlert className="w-10 h-10 text-lt-red-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-lt-white mb-1">Access Restricted</h3>
        <p className="text-xs text-lt-slate-400 font-mono">
          Only club admins can manage members.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-lb-emerald-950/60 border-ll-emerald-500/50 text-lt-emerald-300'
              : 'bg-lb-red-950/60 border-ll-red-500/50 text-lt-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-lt-slate-400 hover:text-lt-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-3.5 rounded-xl bg-lb-slate-950/80 border border-ll-slate-800">
          <div className="flex items-center justify-between text-lt-slate-400 text-xs mb-1">
            <span>Total Accounts</span>
            <Users className="w-3.5 h-3.5 text-lt-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-lt-white">{totalUsers}</div>
          <div className="text-xs text-lt-slate-500">Registered users</div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-lb-slate-950/80 border border-ll-slate-800">
          <div className="flex items-center justify-between text-lt-slate-400 text-xs mb-1">
            <span>Admins</span>
            <Crown className="w-3.5 h-3.5 text-lt-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-lt-amber-400">{adminCount}</div>
          <div className="text-xs text-lt-slate-500">Full system access</div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-lb-slate-950/80 border border-ll-slate-800">
          <div className="flex items-center justify-between text-lt-slate-400 text-xs mb-1">
            <span>Race Officers</span>
            <Shield className="w-3.5 h-3.5 text-lt-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-lt-cyan-400">{officerCount}</div>
          <div className="text-xs text-lt-slate-500">Room creators</div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-lb-slate-950/80 border border-ll-slate-800">
          <div className="flex items-center justify-between text-lt-slate-400 text-xs mb-1">
            <span>Skippers</span>
            <Anchor className="w-3.5 h-3.5 text-lt-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-lt-emerald-400">{skipperCount}</div>
          <div className="text-xs text-lt-slate-500">Racers & Boats</div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3 sm:p-3.5 rounded-xl bg-lb-slate-950/80 border border-ll-slate-800">
          <div className="flex items-center justify-between text-lt-slate-400 text-xs mb-1">
            <span>Suspended</span>
            <ShieldAlert className="w-3.5 h-3.5 text-lt-red-400" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-bold text-lt-red-400">{suspendedCount}</div>
          <div className="text-xs text-lt-slate-500">Locked sessions</div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col gap-2.5 bg-lb-slate-950/60 p-3 rounded-xl border border-ll-slate-800">
        {/* Full-width Stretched Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-lt-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="admin-search-users"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, @username, email, or club..."
            className="w-full bg-lb-slate-900 border border-ll-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-lt-white placeholder-lt-slate-500 focus:outline-none focus:border-ll-cyan-500 transition-colors shadow-inner"
          />
        </div>

        {/* Second Row: Role & Status Filters nicely aligned alongside Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap flex-1 sm:flex-initial">
            <select
              id="admin-filter-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-lb-slate-900 border border-ll-slate-700/80 rounded-xl px-3 py-2 text-xs text-lt-slate-200 focus:outline-none focus:border-ll-cyan-500 cursor-pointer min-w-[125px] transition-colors"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admins</option>
              <option value="RACE_OFFICER">Race Officers</option>
              <option value="SKIPPER">Skippers</option>
              <option value="SPECTATOR">Spectators</option>
            </select>

            <select
              id="admin-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-lb-slate-900 border border-ll-slate-700/80 rounded-xl px-3 py-2 text-xs text-lt-slate-200 focus:outline-none focus:border-ll-cyan-500 cursor-pointer min-w-[115px] transition-colors"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button
              id="admin-refresh-users-btn"
              onClick={loadUsers}
              disabled={loading}
              className="p-2 bg-lb-slate-900 hover:bg-lb-slate-800 border border-ll-slate-700 rounded-xl text-lt-slate-300 hover:text-lt-white transition-colors"
              title="Refresh Users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-lt-cyan-400' : ''}`} />
            </button>

            <button
              id="admin-add-user-btn"
              onClick={() => setShowAddUserModal(true)}
              className="px-3.5 py-2 bg-lb-cyan-600 hover:bg-lb-cyan-500 text-lt-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>
        </div>
      </div>

      {/* Users Table / Directory */}
      <div className="border border-ll-slate-800 rounded-2xl bg-lb-slate-950/40 overflow-hidden">
        {loading && userList.length === 0 ? (
          <div className="p-8 text-center text-lt-slate-400 font-mono text-xs">
            Loading registered users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-lt-slate-400 font-mono text-xs">
            No registered users found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-ll-slate-800 bg-lb-slate-900/80 text-lt-slate-400 font-mono text-xs">
                  <th className="py-3 px-4">User Details</th>
                  <th className="py-3 px-3">Club & Boat</th>
                  <th className="py-3 px-3">Role & Authority</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Rooms Hosted</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ll-slate-800/60">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser.id;
                  const isUniversalMaster = u.email?.toLowerCase().trim() === 'irsyadismail@gmail.com';
                  const isSuspended = u.status === 'SUSPENDED';

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-lb-slate-900/50 transition-colors ${
                        isSuspended ? 'opacity-60 bg-lb-red-950/10' : ''
                      }`}
                    >
                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isUniversalMaster
                                ? 'bg-lb-amber-500/20 text-lt-amber-300 border border-ll-amber-400'
                                : u.role === 'ADMIN'
                                ? 'bg-lb-amber-500/20 text-lt-amber-400 border border-ll-amber-500/30'
                                : u.role === 'RACE_OFFICER'
                                ? 'bg-lb-cyan-500/20 text-lt-cyan-400 border border-ll-cyan-500/30'
                                : 'bg-lb-slate-800 text-lt-slate-300 border border-ll-slate-700'
                            }`}
                          >
                            {u.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-lt-white flex items-center gap-1.5 truncate">
                              <span>{u.fullName}</span>
                              {isUniversalMaster ? (
                                <span className="px-1.5 py-0.2 rounded bg-lb-amber-500/30 text-lt-amber-300 border border-ll-amber-400/50 font-mono text-xs font-bold">
                                  UNIVERSAL ADMIN
                                </span>
                              ) : isSelf ? (
                                <span className="px-1.5 py-0.2 rounded bg-lb-cyan-950 text-lt-cyan-300 border border-ll-cyan-800 font-mono text-xs">
                                  YOU
                                </span>
                              ) : null}
                            </div>
                            {u.requestedRole === 'RACE_OFFICER' && (
                              <div className="mt-0.5 inline-block px-1.5 py-0.5 rounded bg-lb-cyan-950 text-lt-cyan-300 border border-ll-cyan-800 font-mono text-xs">
                                WANTS RACE OFFICER: set role below to approve
                              </div>
                            )}
                            <div className="text-lt-slate-400 font-mono text-xs flex items-center gap-2">
                              <span>@{u.username}</span>
                              <span>•</span>
                              <span className="text-lt-slate-500 truncate">{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Club & Sail */}
                      <td className="py-3 px-3">
                        <div className="text-lt-slate-300 truncate max-w-[180px]">{u.sailingClub || '—'}</div>
                        <div className="text-lt-slate-500 font-mono text-xs">
                          {u.sailNumber ? `Sail: ${u.sailNumber}` : 'No boat assigned'}
                        </div>
                      </td>

                      {/* Role Dropdown */}
                      <td className="py-3 px-3">
                        <select
                          id={`admin-role-select-${u.id}`}
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(
                              u.id,
                              e.target.value as 'ADMIN' | 'RACE_OFFICER' | 'SKIPPER' | 'SPECTATOR'
                            )
                          }
                          disabled={isSelf || isUniversalMaster}
                          className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold border focus:outline-none transition-colors ${
                            u.role === 'ADMIN'
                              ? 'bg-lb-amber-950/50 border-ll-amber-600/50 text-lt-amber-300'
                              : u.role === 'RACE_OFFICER'
                              ? 'bg-lb-cyan-950/50 border-ll-cyan-600/50 text-lt-cyan-300'
                              : u.role === 'SKIPPER'
                              ? 'bg-lb-emerald-950/50 border-ll-emerald-600/50 text-lt-emerald-300'
                              : 'bg-lb-slate-800 border-ll-slate-700 text-lt-slate-300'
                          } ${isSelf || isUniversalMaster ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="RACE_OFFICER">RACE_OFFICER</option>
                          <option value="SKIPPER">SKIPPER</option>
                          <option value="SPECTATOR">SPECTATOR</option>
                        </select>
                      </td>

                      {/* Status & Toggle */}
                      <td className="py-3 px-3">
                        <button
                          id={`admin-toggle-status-${u.id}`}
                          onClick={() => handleToggleStatus(u)}
                          disabled={isSelf || isUniversalMaster}
                          className={`px-2 py-1 rounded-lg font-mono text-xs font-bold flex items-center gap-1 transition-all ${
                            isSuspended
                              ? 'bg-lb-red-500/20 text-lt-red-400 border border-ll-red-500/40 hover:bg-lb-red-500/30'
                              : 'bg-lb-emerald-500/20 text-lt-emerald-400 border border-ll-emerald-500/40 hover:bg-lb-emerald-500/30'
                          } ${isSelf || isUniversalMaster ? 'cursor-not-allowed opacity-60' : ''}`}
                          title={
                            isUniversalMaster
                              ? 'Universal master admin cannot be suspended'
                              : isSelf
                              ? 'You cannot suspend yourself'
                              : 'Toggle Active / Suspended status'
                          }
                        >
                          {isSuspended ? (
                            <>
                              <XCircle className="w-3 h-3" />
                              <span>SUSPENDED</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>ACTIVE</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Rooms Hosted */}
                      <td className="py-3 px-3 text-center font-mono text-lt-slate-300">
                        <span className="px-2 py-0.5 rounded bg-lb-slate-900 border border-ll-slate-800">
                          {u.roomsHostedCount || 0}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`admin-reset-pwd-btn-${u.id}`}
                            onClick={() => {
                              setResetPasswordTarget(u);
                              setNewPasswordInput('');
                            }}
                            className="p-1.5 rounded-lg bg-lb-slate-900 hover:bg-lb-slate-800 text-lt-slate-300 hover:text-lt-amber-400 border border-ll-slate-800 transition"
                            title="Reset User Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            id={`admin-delete-user-btn-${u.id}`}
                            onClick={() => setDeleteTarget(u)}
                            disabled={isSelf || isUniversalMaster}
                            className={`p-1.5 rounded-lg bg-lb-slate-900 hover:bg-lb-red-950 text-lt-slate-300 hover:text-lt-red-400 border border-ll-slate-800 transition ${
                              isSelf || isUniversalMaster ? 'opacity-30 cursor-not-allowed' : ''
                            }`}
                            title={
                              isUniversalMaster
                                ? 'Universal master admin cannot be deleted'
                                : isSelf
                                ? 'Cannot delete self'
                                : 'Permanently Delete User'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUB-MODAL 1: ADD NEW USER */}
      {showAddUserModal && (
        <div
          id="admin-add-user-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-lb-slate-950/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddUserModal(false);
          }}
        >
          <div className="bg-lb-slate-900 border border-ll-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-ll-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-lt-white font-bold">
                <UserPlus className="w-5 h-5 text-lt-cyan-400" />
                <span>Create User Account</span>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-lt-slate-400 hover:text-lt-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-4 sm:p-5 space-y-3">
              <div>
                <label className="block text-xs text-lt-slate-400 mb-1">Full Name</label>
                <input
                  id="admin-new-user-fullname"
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Commander Sarah Jenkins"
                  className="w-full bg-lb-slate-950 border border-ll-slate-700 rounded-xl px-3 py-2 text-xs text-lt-white placeholder-lt-slate-500 focus:outline-none focus:border-ll-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-lt-slate-400 mb-1">Username</label>
                  <input
                    id="admin-new-user-username"
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. sarah_j"
                    className="w-full bg-lb-slate-950 border border-ll-slate-700 rounded-xl px-3 py-2 text-xs text-lt-white placeholder-lt-slate-500 focus:outline-none focus:border-ll-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-lt-slate-400 mb-1">Role</label>
                  <select
                    id="admin-new-user-role"
                    value={newUserRole}
                    onChange={(e) =>
                      setNewUserRole(e.target.value as 'ADMIN' | 'RACE_OFFICER' | 'SKIPPER' | 'SPECTATOR')
                    }
                    className="w-full bg-lb-slate-950 border border-ll-slate-700 rounded-xl px-3 py-2 text-xs text-lt-white focus:outline-none focus:border-ll-cyan-500 font-mono"
                  >
                    <option value="RACE_OFFICER">RACE_OFFICER</option>
                    <option value="SKIPPER">SKIPPER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SPECTATOR">SPECTATOR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-lt-slate-400 mb-1">Email Address</label>
                <input
                  id="admin-new-user-email"
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. sarah@marine.org"
                  className="w-full bg-lb-slate-950 border border-ll-slate-700 rounded-xl px-3 py-2 text-xs text-lt-white placeholder-lt-slate-500 focus:outline-none focus:border-ll-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-lt-slate-400 mb-1">Initial Password</label>
                <input
                  id="admin-new-user-password"
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="w-full bg-lb-slate-950 border border-ll-slate-700 rounded-xl px-3 py-2 text-xs text-lt-white placeholder-lt-slate-500 focus:outline-none focus:border-ll-cyan-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-lt-slate-400 mb-1">Sailing Club</label>
                  <input
                    id="admin-new-user-club"
                    type="text"
                    value={newUserClub}
                    onChange={(e) => setNewUserClub(e.target.value)}
                    placeholder="e.g. RLYC"
                    className="w-full bg-lb-slate-950 border border-ll-slate-700 rounded-xl px-3 py-2 text-xs text-lt-white placeholder-lt-slate-500 focus:outline-none focus:border-ll-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-lt-slate-400 mb-1">Sail Number</label>
                  <input
                    id="admin-new-user-sail"
                    type="text"
                    value={newUserSailNumber}
                    onChange={(e) => setNewUserSailNumber(e.target.value)}
                    placeholder="e.g. MAS 77"
                    className="w-full bg-lb-slate-950 border border-ll-slate-700 rounded-xl px-3 py-2 text-xs text-lt-white placeholder-lt-slate-500 focus:outline-none focus:border-ll-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-ll-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-lb-slate-800 hover:bg-lb-slate-700 text-lt-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-4 py-2 rounded-xl bg-lb-cyan-600 hover:bg-lb-cyan-500 text-lt-white text-xs font-semibold shadow"
                >
                  {isSubmittingUser ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: RESET PASSWORD */}
      {resetPasswordTarget && (
        <div
          id="admin-reset-pwd-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-lb-slate-950/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setResetPasswordTarget(null);
          }}
        >
          <div className="bg-lb-slate-900 border border-ll-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lt-white font-bold">
                <KeyRound className="w-5 h-5 text-lt-amber-400" />
                <span>Reset User Password</span>
              </div>
              <button
                onClick={() => setResetPasswordTarget(null)}
                className="text-lt-slate-400 hover:text-lt-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-lt-slate-300">
              Set a new password for <span className="font-bold text-lt-white">@{resetPasswordTarget.username}</span> ({resetPasswordTarget.fullName}).
            </p>

            <form onSubmit={handleConfirmResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs text-lt-slate-400 mb-1">New Password</label>
                <input
                  id="admin-reset-pwd-input"
                  type="password"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password (min 4 characters)"
                  className="w-full bg-lb-slate-950 border border-ll-slate-700 rounded-xl px-3 py-2 text-xs text-lt-white placeholder-lt-slate-500 focus:outline-none focus:border-ll-cyan-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordTarget(null)}
                  className="px-3.5 py-2 rounded-xl bg-lb-slate-800 hover:bg-lb-slate-700 text-lt-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword || !newPasswordInput}
                  className="px-4 py-2 rounded-xl bg-lb-amber-600 hover:bg-lb-amber-500 text-lt-white text-xs font-semibold shadow"
                >
                  {isResettingPassword ? 'Updating...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 3: DELETE CONFIRMATION */}
      {deleteTarget && (
        <div
          id="admin-delete-user-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-lb-slate-950/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="bg-lb-slate-900 border border-ll-red-900/60 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lb-red-500/20 text-lt-red-400 border border-ll-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-lt-white">Delete User Account?</h3>
                <p className="text-xs text-lt-slate-400">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 bg-lb-red-950/30 border border-ll-red-900/40 rounded-xl text-xs text-lt-slate-300">
              Are you sure you want to delete account <span className="font-mono text-lt-white font-bold">@{deleteTarget.username}</span> ({deleteTarget.email})? All active sessions will be terminated.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 rounded-xl bg-lb-slate-800 hover:bg-lb-slate-700 text-lt-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingUser}
                className="px-4 py-2 rounded-xl bg-lb-red-600 hover:bg-lb-red-500 text-lt-white text-xs font-semibold shadow"
              >
                {isDeletingUser ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
