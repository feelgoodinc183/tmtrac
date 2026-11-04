import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Search,
  KeyRound,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Crown,
  Anchor,
  X,
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
      <div className="p-8 text-center bg-canvas/60 border border-danger-ink/30 rounded-2xl text-ink">
        <ShieldAlert className="w-10 h-10 text-danger-ink mx-auto mb-3" />
        <h3 className="text-base font-bold text-ink mb-1">Access Restricted</h3>
        <p className="text-xs text-ink-muted">
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
          className={`p-3 rounded-xl border text-xs  flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-surface/60 border-success-ink/50 text-success-ink'
              : 'bg-surface/60 border-danger-ink/50 text-danger-ink'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-ink-muted hover:text-ink">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-3.5 rounded-xl bg-canvas/80 border border-line">
          <div className="flex items-center justify-between text-ink-muted text-xs mb-1">
            <span>Total Accounts</span>
            <Users className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink">{totalUsers}</div>
          <div className="text-xs text-ink-muted">Registered users</div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-canvas/80 border border-line">
          <div className="flex items-center justify-between text-ink-muted text-xs mb-1">
            <span>Admins</span>
            <Crown className="w-3.5 h-3.5 text-warning-ink" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-warning-ink">{adminCount}</div>
          <div className="text-xs text-ink-muted">Full system access</div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-canvas/80 border border-line">
          <div className="flex items-center justify-between text-ink-muted text-xs mb-1">
            <span>Race Officers</span>
            <Shield className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-accent">{officerCount}</div>
          <div className="text-xs text-ink-muted">Room creators</div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-canvas/80 border border-line">
          <div className="flex items-center justify-between text-ink-muted text-xs mb-1">
            <span>Skippers</span>
            <Anchor className="w-3.5 h-3.5 text-success-ink" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-success-ink">{skipperCount}</div>
          <div className="text-xs text-ink-muted">Racers & Boats</div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3 sm:p-3.5 rounded-xl bg-canvas/80 border border-line">
          <div className="flex items-center justify-between text-ink-muted text-xs mb-1">
            <span>Suspended</span>
            <ShieldAlert className="w-3.5 h-3.5 text-danger-ink" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-danger-ink">{suspendedCount}</div>
          <div className="text-xs text-ink-muted">Locked sessions</div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col gap-2.5 bg-canvas/60 p-3 rounded-xl border border-line">
        {/* Full-width Stretched Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="admin-search-users"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, @username, email, or club..."
            className="w-full bg-surface border border-line/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent transition-colors shadow-inner"
          />
        </div>

        {/* Second Row: Role & Status Filters nicely aligned alongside Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap flex-1 sm:flex-initial">
            <select
              id="admin-filter-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-surface border border-line/80 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent cursor-pointer min-w-[125px] transition-colors"
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
              className="bg-surface border border-line/80 rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent cursor-pointer min-w-[115px] transition-colors"
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
              className="p-2 bg-surface hover:bg-raised border border-line rounded-xl text-ink hover:text-ink transition-colors"
              title="Refresh Users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-accent' : ''}`} />
            </button>

            <button
              id="admin-add-user-btn"
              onClick={() => setShowAddUserModal(true)}
              className="px-3.5 py-2 bg-accent hover:brightness-110 text-on-accent rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>
        </div>
      </div>

      {/* Users Table / Directory */}
      <div className="border border-line rounded-2xl bg-canvas/40 overflow-hidden">
        {loading && userList.length === 0 ? (
          <div className="p-8 text-center text-ink-muted text-xs">
            Loading registered users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-ink-muted text-xs">
            No registered users found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line bg-surface/80 text-ink-muted text-xs">
                  <th className="py-3 px-4">User Details</th>
                  <th className="py-3 px-3">Club & Boat</th>
                  <th className="py-3 px-3">Role & Authority</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Rooms Hosted</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser.id;
                  const isUniversalMaster = u.email?.toLowerCase().trim() === 'irsyadismail@gmail.com';
                  const isSuspended = u.status === 'SUSPENDED';

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-surface/50 transition-colors ${
                        isSuspended ? 'opacity-60 bg-surface/10' : ''
                      }`}
                    >
                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isUniversalMaster
                                ? 'bg-warning-ink/20 text-warning-ink border border-warning-ink'
                                : u.role === 'ADMIN'
                                ? 'bg-warning-ink/20 text-warning-ink border border-warning-ink/30'
                                : u.role === 'RACE_OFFICER'
                                ? 'bg-accent/20 text-accent border border-accent/30'
                                : 'bg-raised text-ink border border-line'
                            }`}
                          >
                            {u.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-ink flex items-center gap-1.5 truncate">
                              <span>{u.fullName}</span>
                              {isUniversalMaster ? (
                                <span className="px-1.5 py-0.2 rounded bg-warning-ink/30 text-warning-ink border border-warning-ink/50 text-xs font-bold">
                                  UNIVERSAL ADMIN
                                </span>
                              ) : isSelf ? (
                                <span className="px-1.5 py-0.2 rounded bg-surface text-accent border border-accent text-xs">
                                  YOU
                                </span>
                              ) : null}
                            </div>
                            {u.requestedRole === 'RACE_OFFICER' && (
                              <div className="mt-0.5 inline-block px-1.5 py-0.5 rounded bg-surface text-accent border border-accent text-xs">
                                WANTS RACE OFFICER: set role below to approve
                              </div>
                            )}
                            <div className="text-ink-muted text-xs flex items-center gap-2">
                              <span>@{u.username}</span>
                              <span>•</span>
                              <span className="text-ink-muted truncate">{u.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Club & Sail */}
                      <td className="py-3 px-3">
                        <div className="text-ink truncate max-w-[180px]">{u.sailingClub || '—'}</div>
                        <div className="text-ink-muted text-xs">
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
                          className={`px-2 py-1 rounded-lg text-xs  font-semibold border focus:outline-none transition-colors ${
                            u.role === 'ADMIN'
                              ? 'bg-surface/50 border-warning-ink/50 text-warning-ink'
                              : u.role === 'RACE_OFFICER'
                              ? 'bg-surface/50 border-accent/50 text-accent'
                              : u.role === 'SKIPPER'
                              ? 'bg-surface/50 border-success-ink/50 text-success-ink'
                              : 'bg-raised border-line text-ink'
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
                          className={`px-2 py-1 rounded-lg  text-xs font-bold flex items-center gap-1 transition-all ${
                            isSuspended
                              ? 'bg-danger/20 text-danger-ink border border-danger-ink/40 hover:bg-danger/30'
                              : 'bg-success-ink/20 text-success-ink border border-success-ink/40 hover:bg-success-ink/30'
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
                      <td className="py-3 px-3 text-center text-ink">
                        <span className="px-2 py-0.5 rounded bg-surface border border-line">
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
                            className="p-1.5 rounded-lg bg-surface hover:bg-raised text-ink hover:text-warning-ink border border-line transition"
                            title="Reset User Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            id={`admin-delete-user-btn-${u.id}`}
                            onClick={() => setDeleteTarget(u)}
                            disabled={isSelf || isUniversalMaster}
                            className={`p-1.5 rounded-lg bg-surface hover:bg-surface text-ink hover:text-danger-ink border border-line transition ${
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
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddUserModal(false);
          }}
        >
          <div className="bg-surface border border-line rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink font-bold">
                <UserPlus className="w-5 h-5 text-accent" />
                <span>Create User Account</span>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-4 sm:p-5 space-y-3">
              <div>
                <label className="block text-xs text-ink-muted mb-1">Full Name</label>
                <input
                  id="admin-new-user-fullname"
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Commander Sarah Jenkins"
                  className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Username</label>
                  <input
                    id="admin-new-user-username"
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. sarah_j"
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Role</label>
                  <select
                    id="admin-new-user-role"
                    value={newUserRole}
                    onChange={(e) =>
                      setNewUserRole(e.target.value as 'ADMIN' | 'RACE_OFFICER' | 'SKIPPER' | 'SPECTATOR')
                    }
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
                  >
                    <option value="RACE_OFFICER">RACE_OFFICER</option>
                    <option value="SKIPPER">SKIPPER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SPECTATOR">SPECTATOR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-1">Email Address</label>
                <input
                  id="admin-new-user-email"
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. sarah@marine.org"
                  className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-1">Initial Password</label>
                <input
                  id="admin-new-user-password"
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Sailing Club</label>
                  <input
                    id="admin-new-user-club"
                    type="text"
                    value={newUserClub}
                    onChange={(e) => setNewUserClub(e.target.value)}
                    placeholder="e.g. RLYC"
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Sail Number</label>
                  <input
                    id="admin-new-user-sail"
                    type="text"
                    value={newUserSailNumber}
                    onChange={(e) => setNewUserSailNumber(e.target.value)}
                    placeholder="e.g. MAS 77"
                    className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-raised hover:bg-raised text-ink text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-4 py-2 rounded-xl bg-accent hover:brightness-110 text-on-accent text-xs font-semibold shadow"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setResetPasswordTarget(null);
          }}
        >
          <div className="bg-surface border border-line rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink font-bold">
                <KeyRound className="w-5 h-5 text-warning-ink" />
                <span>Reset User Password</span>
              </div>
              <button
                onClick={() => setResetPasswordTarget(null)}
                className="text-ink-muted hover:text-ink p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-ink">
              Set a new password for <span className="font-bold text-ink">@{resetPasswordTarget.username}</span> ({resetPasswordTarget.fullName}).
            </p>

            <form onSubmit={handleConfirmResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs text-ink-muted mb-1">New Password</label>
                <input
                  id="admin-reset-pwd-input"
                  type="password"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password (min 4 characters)"
                  className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPasswordTarget(null)}
                  className="px-3.5 py-2 rounded-xl bg-raised hover:bg-raised text-ink text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword || !newPasswordInput}
                  className="px-4 py-2 rounded-xl bg-warning-ink hover:brightness-110 text-canvas text-xs font-semibold shadow"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="bg-surface border border-danger-ink/60 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/20 text-danger-ink border border-danger-ink/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">Delete User Account?</h3>
                <p className="text-xs text-ink-muted">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 bg-surface/30 border border-danger-ink/40 rounded-xl text-xs text-ink">
              Are you sure you want to delete account <span className="text-ink font-bold">@{deleteTarget.username}</span> ({deleteTarget.email})? All active sessions will be terminated.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 rounded-xl bg-raised hover:bg-raised text-ink text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeletingUser}
                className="px-4 py-2 rounded-xl bg-danger hover:brightness-110 text-on-danger text-xs font-semibold shadow"
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
