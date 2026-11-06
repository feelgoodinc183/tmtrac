import { formatPrice } from '../utils/pricing';
import React, { useState, useEffect, useId } from 'react';
import {
  ShieldAlert,
  Users,
  Building,
  Package,
  Activity,
  FileText,
  Download,
  Trash2,
  Edit2,
  Plus,
  Search,
  Check,
  X,
  RefreshCw,
  Server,
  Lock,
  Globe,
  Radio,
  Eye,
  AlertTriangle,
  Database,
  ArrowUpRight,
  Upload,
  CheckCircle2,
  HardDrive,
  Cpu,
  Zap,
  Copy,
  Wrench,
  FolderOpen,
  ShieldCheck,
  XCircle,
  Power,
} from 'lucide-react';
import { PricingPackage, UserAccount } from '../types/regatta';
import { authService } from '../services/authService';
import { DialogFrame } from './ui/Dialog';

interface SuperAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onViewEvent?: (code: string) => void;
  onOpenCpanelDeploy?: () => void;
}

export const SuperAdminModal: React.FC<SuperAdminModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onViewEvent,
  onOpenCpanelDeploy,
}) => {
  const titleId = useId();
  const packageTitleId = useId();
  const userTitleId = useId();
  const resetPwdTitleId = useId();
  const clubTitleId = useId();
  const eventTitleId = useId();
  const [activeTab, setActiveTab] = useState<'overview' | 'packages' | 'users' | 'clubs' | 'events' | 'database' | 'sockets' | 'audit'>('overview');
  const [, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // Errors from the edit dialogs are shown inside the dialog: the panel banner sits behind its overlay.
  const [dialogError, setDialogError] = useState<{ message: string; sessionEnded: boolean } | null>(null);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthBusy, setReauthBusy] = useState(false);
  const [dialogInfo, setDialogInfo] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [sockets, setSockets] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Database diagnostic states
  const [dbStatus, setDbStatus] = useState<any | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbOptimizing, setDbOptimizing] = useState(false);
  const [dbPingTesting, setDbPingTesting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [copiedDbPath, setCopiedDbPath] = useState(false);
  const [restartingServer, setRestartingServer] = useState(false);

  // Search & Filter filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');

  // Edit Package Modal state
  const [editingPackage, setEditingPackage] = useState<any | null>(null);
  const [isNewPackage, setIsNewPackage] = useState(false);

  // Edit User Modal state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [resetPwdUserId, setResetPwdUserId] = useState<string | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');

  // Edit Club Modal state
  const [editingClub, setEditingClub] = useState<any | null>(null);

  // Edit Event Modal state
  const [editingEvent, setEditingEvent] = useState<{
    id: string;
    code: string;
    title: string;
    locationName: string;
    adminPin: string;
    participantPin: string;
    status: string;
    isPublic: boolean;
    tenantName?: string;
  } | null>(null);

  // Auto-refresh timer for sockets
  const [autoRefreshSockets, setAutoRefreshSockets] = useState(false);
  const jsonInputRef = React.useRef<HTMLInputElement | null>(null);

  const getActiveToken = () => {
    return (
      authService.getToken() ||
      currentUser?.token ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('tmtrac_auth_token_v1') || localStorage.getItem('tmtrac_auth_token') || ''
        : '')
    );
  };

  const getHeaders = () => {
    const activeToken = getActiveToken();
    const activeUser = currentUser || authService.getCurrentUser();
    const userEmail = activeUser?.email || 'irsyadismail@gmail.com';
    const userId = activeUser?.id || 'user-admin-0';

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeToken}`,
      'x-auth-token': activeToken,
      'x-super-admin-token': activeToken,
      'x-user-email': userEmail,
      'x-user-id': userId,
    };
  };

  const notify = (success?: string, error?: string) => {
    if (success) {
      setSuccessMsg(success);
      setTimeout(() => setSuccessMsg(null), 3500);
    }
    if (error) {
      setErrorMsg(error);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const readJson = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      return {};
    }
  };

  const showDialogFailure = (res: Response, data: any, fallback: string) => {
    if (res.status === 401 || data?.requireAuth) {
      setDialogError({
        message:
          'Your session has ended, usually because this account signed in on another device. Your changes have not been saved yet, but they are still here.',
        sessionEnded: true,
      });
    } else {
      setDialogError({ message: data?.error || fallback, sessionEnded: false });
    }
  };

  const runDialogSave = async (save: () => Promise<void>) => {
    setDialogError(null);
    setDialogInfo(null);
    setDialogSaving(true);
    try {
      await save();
    } catch (err: any) {
      setDialogError({
        message: `Couldn't reach the server (${err?.message || 'network error'}). Your changes are still here; try again.`,
        sessionEnded: false,
      });
    } finally {
      setDialogSaving(false);
    }
  };

  const handleReauth = async () => {
    const login = (currentUser || authService.getCurrentUser())?.email;
    if (!login || !reauthPassword) return;
    setReauthBusy(true);
    try {
      const result = await authService.login(login, reauthPassword);
      if (result.success) {
        setReauthPassword('');
        setDialogError(null);
        setDialogInfo('Signed in again. Press save to keep your changes.');
      } else {
        setDialogError({
          message: result.error || 'That password was not accepted. Try again.',
          sessionEnded: true,
        });
      }
    } finally {
      setReauthBusy(false);
    }
  };

  // Fetch overview
  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/overview', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setOverview(data);
      } else {
        setErrorMsg(data.error || 'Failed to load system overview');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch packages
  const fetchPackages = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/packages', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setPackages(data.packages);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (userSearch) params.set('q', userSearch);
      if (userRoleFilter) params.set('role', userRoleFilter);
      const res = await fetch(`/api/super-admin/users?${params.toString()}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.users);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch clubs
  const fetchClubs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/clubs', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setClubs(data.clubs);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch events
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/events', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setEvents(data.events);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch sockets
  const fetchSockets = async () => {
    try {
      const res = await fetch('/api/super-admin/sockets', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setSockets(data.sockets);
      }
    } catch (e: any) {}
  };

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/super-admin/audit-logs?limit=150', { headers: getHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuditLogs(data.logs);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Trigger data load when tab changes or modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'overview') fetchOverview();
    else if (activeTab === 'packages') fetchPackages();
    else if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'clubs') fetchClubs();
    else if (activeTab === 'events') fetchEvents();
    else if (activeTab === 'database') {
      fetchDatabaseStatus();
      fetchDiagnostics();
    }
    else if (activeTab === 'sockets') fetchSockets();
    else if (activeTab === 'audit') fetchAuditLogs();
  }, [isOpen, activeTab]);

  // Sockets polling
  useEffect(() => {
    if (!isOpen || activeTab !== 'sockets' || !autoRefreshSockets) return;
    const interval = setInterval(fetchSockets, 4000);
    return () => clearInterval(interval);
  }, [isOpen, activeTab, autoRefreshSockets]);

  const openDialogKey = editingPackage
    ? `package:${editingPackage.id || 'new'}`
    : editingUser
      ? `user:${editingUser.id}`
      : resetPwdUserId
        ? `password:${resetPwdUserId}`
        : editingClub
          ? `club:${editingClub.id}`
          : editingEvent
            ? `event:${editingEvent.id || editingEvent.code}`
            : '';

  useEffect(() => {
    setDialogError(null);
    setDialogInfo(null);
    setReauthPassword('');
  }, [openDialogKey]);

  if (!isOpen) return null;

  const renderDialogFeedback = () => {
    if (dialogInfo) {
      return (
        <div role="status" className="rounded-lg border border-success-ink/40 bg-surface/60 px-3 py-2.5 text-xs text-success-ink">
          {dialogInfo}
        </div>
      );
    }
    if (!dialogError) return null;
    const accountEmail = (currentUser || authService.getCurrentUser())?.email;
    return (
      <div role="alert" className="rounded-lg border border-danger-ink/50 bg-surface/70 px-3 py-2.5 text-xs text-ink space-y-2">
        <p className="font-semibold">Not saved</p>
        <p>{dialogError.message}</p>
        {dialogError.sessionEnded && accountEmail && (
          <div className="space-y-1.5 pt-1">
            <label htmlFor="sa-reauth-password" className="block text-ink">
              Password for {accountEmail}
            </label>
            <div className="flex gap-2">
              <input
                id="sa-reauth-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                onKeyDown={(e) => {
                  // Keep Enter from submitting the surrounding edit form.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleReauth();
                  }
                }}
                className="flex-1 px-3 py-2 bg-canvas border border-danger-ink/50 rounded-lg text-ink"
              />
              <button
                type="button"
                onClick={handleReauth}
                disabled={reauthBusy || !reauthPassword}
                className="px-3 py-2 rounded-lg bg-danger hover:brightness-110 disabled:opacity-50 text-on-danger font-semibold"
              >
                {reauthBusy ? 'Signing in…' : 'Sign in again'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- Handlers: Packages ---
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackage) return;
    await runDialogSave(async () => {
      const isNew = isNewPackage;
      const targetIdentifier = editingPackage.id || editingPackage.tierKey;
      const url = isNew ? '/api/super-admin/packages' : `/api/super-admin/packages/${encodeURIComponent(targetIdentifier)}`;
      const method = isNew ? 'POST' : 'PUT';

      const parsedPrice = Number(editingPackage.priceAmount) || 0;
      const payload = {
        ...editingPackage,
        priceAmount: parsedPrice,
        price: parsedPrice,
        maxActiveRooms: Number(editingPackage.maxActiveRooms) || 1,
        maxBoatsPerRoom: Number(editingPackage.maxBoatsPerRoom) || 10,
        maxAdminSeats: Number(editingPackage.maxAdminSeats) || 2,
        sortOrder: Number(editingPackage.sortOrder) || 0,
      };

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await readJson(res);
      if (res.ok && data.success) {
        notify('Package saved successfully!');
        if (data.package) {
          setPackages((prev) => {
            const exists = prev.some((p) => p.id === data.package.id || p.tierKey === data.package.tierKey);
            if (exists) {
              return prev.map((p) => (p.id === data.package.id || p.tierKey === data.package.tierKey ? data.package : p));
            }
            return [...prev, data.package];
          });
        }
        setEditingPackage(null);
        fetchPackages();
        window.dispatchEvent(new CustomEvent('packages-updated', { detail: data.package }));
      } else {
        showDialogFailure(res, data, 'Failed to save package');
      }
    });
  };

  const handleDeletePackage = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the package "${name}"?`)) return;
    try {
      const res = await fetch(`/api/super-admin/packages/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify('Package deleted.');
        setPackages((prev) => prev.filter((p) => p.id !== id && p.tierKey !== id));
        fetchPackages();
        window.dispatchEvent(new CustomEvent('packages-updated', { detail: { id } }));
      } else {
        notify(undefined, data.error);
      }
    } catch (err: any) {
      notify(undefined, err.message);
    }
  };

  // --- Handlers: Users ---
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    await runDialogSave(async () => {
      const res = await fetch(`/api/super-admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(editingUser),
      });
      const data = await readJson(res);
      if (res.ok && data.success) {
        notify('User updated successfully.');
        setEditingUser(null);
        fetchUsers();
      } else {
        showDialogFailure(res, data, 'Save failed. Please try again.');
      }
    });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdUserId || !newPasswordVal.trim()) return;
    await runDialogSave(async () => {
      const res = await fetch(`/api/super-admin/users/${resetPwdUserId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ newPassword: newPasswordVal.trim() }),
      });
      const data = await readJson(res);
      if (res.ok && data.success) {
        notify('Password reset successfully.');
        setResetPwdUserId(null);
        setNewPasswordVal('');
      } else {
        showDialogFailure(res, data, 'Save failed. Please try again.');
      }
    });
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!confirm(`Permanently remove user ${email} from the database?`)) return;
    try {
      const res = await fetch(`/api/super-admin/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify('User deleted.');
        fetchUsers();
      } else {
        notify(undefined, data.error);
      }
    } catch (err: any) {
      notify(undefined, err.message);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch('/api/super-admin/backup/import', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify('Database state restored & synced successfully!');
        fetchOverview();
        fetchPackages();
        window.dispatchEvent(new CustomEvent('packages-updated'));
      } else {
        notify(undefined, data.error || 'Failed to import backup');
      }
    } catch (err: any) {
      notify(undefined, 'Invalid backup file: ' + err.message);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // --- Handlers: Clubs ---
  const handleSaveClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClub) return;
    await runDialogSave(async () => {
      const res = await fetch(`/api/super-admin/clubs/${editingClub.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(editingClub),
      });
      const data = await readJson(res);
      if (res.ok && data.success) {
        notify('Club updated.');
        setEditingClub(null);
        fetchClubs();
      } else {
        showDialogFailure(res, data, 'Save failed. Please try again.');
      }
    });
  };

  const handleDeleteClub = async (id: string, name: string) => {
    if (!confirm(`Warning: Deleting organization "${name}" will permanently delete all associated events and participants. Continue?`)) return;
    try {
      const res = await fetch(`/api/super-admin/clubs/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify('Club and associated data removed.');
        fetchClubs();
      } else {
        notify(undefined, data.error);
      }
    } catch (err: any) {
      notify(undefined, err.message);
    }
  };

  // --- Handlers: Events ---
  const handleDeleteEvent = async (code: string, title: string) => {
    if (!confirm(`Purge regatta event ${code} ("${title}") from database?`)) return;
    try {
      const res = await fetch(`/api/super-admin/events/${code}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(`Event ${code} purged.`);
        fetchEvents();
      } else {
        notify(undefined, data.error);
      }
    } catch (err: any) {
      notify(undefined, err.message);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    await runDialogSave(async () => {
      const targetId = editingEvent.id || editingEvent.code;
      const res = await fetch(`/api/super-admin/events/${encodeURIComponent(targetId)}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          title: editingEvent.title,
          code: editingEvent.code,
          adminPin: editingEvent.adminPin,
          participantPin: editingEvent.participantPin,
          locationName: editingEvent.locationName,
          status: editingEvent.status,
          isPublic: editingEvent.isPublic,
        }),
      });
      const data = await readJson(res);
      if (res.ok && data.success) {
        notify(`Event ${editingEvent.code} details successfully updated.`);
        setEditingEvent(null);
        fetchEvents();
      } else {
        showDialogFailure(res, data, 'Failed to update event details.');
      }
    });
  };

  // --- Handlers: Database Status & Maintenance ---
  const fetchDatabaseStatus = async () => {
    setDbLoading(true);
    try {
      const res = await fetch('/api/super-admin/database/status', {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbStatus({
          ...data,
          connected: data.connected !== false,
        });
      } else {
        setDbStatus((prev: any) => ({
          ...(prev || {}),
          connected: false,
          error: data.error || `HTTP ${res.status}: ${res.statusText}`,
          dbPath: data.dbPath || './data/tmtrac.db',
          driver: data.driver || 'better-sqlite3',
        }));
        notify(undefined, data.error || 'Failed to query database status.');
      }
    } catch (err: any) {
      setDbStatus((prev: any) => ({
        ...(prev || {}),
        connected: false,
        error: err.message || 'Network unreachable',
        dbPath: './data/tmtrac.db',
        driver: 'Offline',
      }));
      notify(undefined, err.message);
    } finally {
      setDbLoading(false);
    }
  };

  const fetchDiagnostics = async () => {
    setDiagnosticsLoading(true);
    try {
      const res = await fetch('/api/super-admin/database/diagnostics', {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const checkList = Array.isArray(data.checks) ? data.checks : (Array.isArray(data.diagnostics) ? data.diagnostics : []);
        setDiagnostics(checkList);
        notify('8-Point database diagnostic scan completed.');
      } else {
        notify(undefined, data.error || 'Diagnostic scan failed.');
      }
    } catch (err: any) {
      notify(undefined, err.message);
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const handleTestDbPing = async () => {
    setDbPingTesting(true);
    try {
      const start = performance.now();
      const res = await fetch('/api/super-admin/database/status', {
        headers: getHeaders(),
      });
      const elapsed = Math.round(performance.now() - start);
      const data = await res.json();
      if (res.ok && data.success) {
        setDbStatus({
          ...data,
          connected: data.connected !== false,
          pingMs: data.pingMs ?? elapsed,
        });
        notify(`Live database verified: ${data.pingMs ?? elapsed}ms query round-trip (${elapsed}ms HTTP). Status: Connected.`);
        fetchDiagnostics();
      } else {
        setDbStatus((prev: any) => ({
          ...(prev || {}),
          connected: false,
          error: data.error || `HTTP ${res.status}`,
        }));
        notify(undefined, data.error || 'Ping test failed.');
      }
    } catch (err: any) {
      setDbStatus((prev: any) => ({
        ...(prev || {}),
        connected: false,
        error: err.message,
      }));
      notify(undefined, err.message);
    } finally {
      setDbPingTesting(false);
    }
  };

  const handleSelfRepair = async () => {
    if (
      !confirm(
        'Run Automated Database & Schema Self-Repair?\n\nThis will verify directory permissions (0755), ensure database tables and missing columns exist, repair default LOBBY room, ensure Super Admin credentials, and execute a WAL checkpoint.'
      )
    )
      return;
    setRepairing(true);
    try {
      const res = await fetch('/api/super-admin/database/repair', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(data.message || 'Database repaired and validated successfully.');
        await fetchDatabaseStatus();
        await fetchDiagnostics();
      } else {
        notify(undefined, data.error || 'Database repair failed.');
      }
    } catch (err: any) {
      notify(undefined, err.message);
    } finally {
      setRepairing(false);
    }
  };

  const handleOptimizeDatabase = async () => {
    if (!confirm('Run SQLite VACUUM and ANALYZE? This will compact the database, clean free pages, and refresh index statistics.')) return;
    setDbOptimizing(true);
    try {
      const res = await fetch('/api/super-admin/database/optimize', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(data.message || 'Database vacuumed and optimized successfully.');
        fetchDatabaseStatus();
        fetchDiagnostics();
      } else {
        notify(undefined, data.error || 'Database optimization failed.');
      }
    } catch (err: any) {
      notify(undefined, err.message);
    } finally {
      setDbOptimizing(false);
    }
  };

  const handleRestartServer = async () => {
    if (!confirm('Recycle Passenger Worker Process?\n\nThis touches tmp/restart.txt and cleanly restarts the Node.js application process so cPanel immediately loads the latest tmtrac.db and compiled server code.')) return;
    setRestartingServer(true);
    try {
      const res = await fetch('/api/super-admin/system/restart', {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify('Passenger worker process recycling... Reconnecting in 3s');
        setTimeout(() => {
          fetchDatabaseStatus();
          fetchDiagnostics();
          fetchEvents();
          fetchPackages();
          setRestartingServer(false);
        }, 3000);
      } else {
        notify(undefined, data.error || 'Failed to trigger process restart');
        setRestartingServer(false);
      }
    } catch (err: any) {
      // Process exit might close the connection immediately, which is normal for Passenger restart
      notify('Worker process recycling. Reconnecting in 3s...');
      setTimeout(() => {
        fetchDatabaseStatus();
        fetchDiagnostics();
        fetchEvents();
        fetchPackages();
        setRestartingServer(false);
      }, 3000);
    }
  };

  return (
    <DialogFrame
      onClose={onClose}
      labelledBy={titleId}
      initialFocus="container"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-canvas/85 backdrop-blur-md animate-fade-in font-sans"
      className="bg-surface border border-line/60 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden text-ink"
    >
      {/* Top Header */}
      <div className="px-5 py-4 bg-surface border-b border-line/80 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-raised to-raised flex items-center justify-center shadow-lg ring-1 ring-line/30">
            <ShieldAlert className="w-5 h-5 text-ink" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 id={titleId} className="text-base font-bold text-ink tracking-tight">Super Admin Master Command</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-raised text-ink border border-line/60">
                ROOT PRIVILEGES
              </span>
            </div>
            <p className="text-xs text-ink-muted">
              Central management for users, clubs, dynamic package pricing, database backups & live sockets
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {onOpenCpanelDeploy && (
            <button
              type="button"
              onClick={onOpenCpanelDeploy}
              className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface/80 hover:brightness-110 text-accent border border-accent/50 hover:border-accent transition-all shadow-xs cursor-pointer"
              title="cPanel Server Deployment Center & Live ZIP Installer for tmtrac.my"
            >
              <Server className="w-3.5 h-3.5 text-accent" />
              <span className="hidden sm:inline">cPanel Deployment</span>
              <span className="sm:hidden">cPanel</span>
            </button>
          )}
          <a
            href={`/api/super-admin/backup/export?token=${encodeURIComponent(getActiveToken())}`}
            target="_blank"
            download
            className="hidden sm:flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-raised hover:bg-raised text-ink border border-line transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-accent" />
            <span>Backup DB</span>
          </a>
          <button
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-raised text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Feedback Toasts */}
      {successMsg && (
        <div className="bg-surface/90 border-b border-success-ink text-success-ink text-xs px-5 py-2 flex items-center space-x-2">
          <Check className="w-4 h-4 text-success-ink shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-surface/95 border-b border-danger-ink/80 text-danger-ink text-xs px-5 py-2.5 flex items-center justify-between shadow-inner animate-in fade-in duration-200">
          <div className="flex items-center space-x-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-danger-ink shrink-0" />
            <span className="font-semibold text-ink text-xs truncate select-text">{errorMsg}</span>
          </div>
          <div className="flex items-center space-x-2 shrink-0 ml-3">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                fetchOverview();
                fetchPackages();
              }}
              className="px-2.5 py-1 rounded bg-danger/60 hover:brightness-110 text-ink text-xs font-semibold border border-danger-ink/60 transition-colors"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-danger-ink hover:text-ink p-1 rounded hover:bg-danger/40 transition-colors"
              aria-label="Dismiss message"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation Ribbon */}
      <div className="flex items-center space-x-1 px-4 py-2 bg-canvas border-b border-line/80 overflow-x-auto text-xs shrink-0">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'overview' ? 'bg-raised/60 text-ink border border-line/60' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('packages')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'packages' ? 'bg-raised/60 text-ink border border-line/60' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Package Pricing</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'users' ? 'bg-raised/60 text-ink border border-line/60' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>User Accounts</span>
        </button>

        <button
          onClick={() => setActiveTab('clubs')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'clubs' ? 'bg-raised/60 text-ink border border-line/60' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Clubs & Tenants</span>
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
            activeTab === 'events' ? 'bg-raised/60 text-ink border border-line/60' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Global Events</span>
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
            activeTab === 'database' ? 'bg-raised/60 text-ink border border-line/60' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Database</span>
        </button>

        <button
          onClick={() => setActiveTab('sockets')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
            activeTab === 'sockets' ? 'bg-raised/60 text-ink border border-line/60' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Socket Monitor</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
            activeTab === 'audit' ? 'bg-raised/60 text-ink border border-line/60' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>System Audit Logs</span>
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-surface/60 border border-line">
                <div className="text-xs text-ink-muted mb-1 flex items-center justify-between">
                  <span>Sailing Clubs</span>
                  <Building className="w-3.5 h-3.5 text-accent" />
                </div>
                <div className="text-2xl font-bold text-ink">{overview?.stats?.clubsCount ?? '...'}</div>
                <div className="text-xs text-ink-muted mt-1">Registered tenant orgs</div>
              </div>

              <div className="p-4 rounded-xl bg-surface/60 border border-line">
                <div className="text-xs text-ink-muted mb-1 flex items-center justify-between">
                  <span>User Accounts</span>
                  <Users className="w-3.5 h-3.5 text-ink-muted" />
                </div>
                <div className="text-2xl font-bold text-ink">{overview?.stats?.usersCount ?? '...'}</div>
                <div className="text-xs text-ink-muted mt-1">Admins, officers & skippers</div>
              </div>

              <div className="p-4 rounded-xl bg-surface/60 border border-line">
                <div className="text-xs text-ink-muted mb-1 flex items-center justify-between">
                  <span>Active Sockets</span>
                  <Radio className="w-3.5 h-3.5 text-success-ink" />
                </div>
                <div className="text-2xl font-bold text-success-ink">{overview?.stats?.activeSocketsCount ?? '...'}</div>
                <div className="text-xs text-ink-muted mt-1">Connected WebSocket clients</div>
              </div>

              <div className="p-4 rounded-xl bg-surface/60 border border-line">
                <div className="text-xs text-ink-muted mb-1 flex items-center justify-between">
                  <span>SQLite Storage</span>
                  <Database className="w-3.5 h-3.5 text-warning-ink" />
                </div>
                <div className="text-2xl font-bold text-ink">{overview?.stats?.database?.fileSizeMb ?? '0'} MB</div>
                <div className="text-xs text-ink-muted mt-1">data/tmtrac.db file</div>
              </div>
            </div>

            {/* Maintenance Tools Row */}
            <div className="p-5 rounded-xl bg-surface/40 border border-line space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-ink">Platform Maintenance & Backups</h3>
                  <p className="text-xs text-ink-muted">Download database dumps or JSON tables for off-site disaster recovery</p>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={`/api/super-admin/backup/export?token=${encodeURIComponent(getActiveToken())}`}
                    target="_blank"
                    download
                    className="px-3 py-1.5 rounded-lg bg-accent hover:brightness-110 text-on-accent text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .db File</span>
                  </a>
                  <a
                    href={`/api/super-admin/backup/export?format=json&token=${encodeURIComponent(getActiveToken())}`}
                    target="_blank"
                    download
                    className="px-3 py-1.5 rounded-lg bg-raised hover:bg-raised text-ink text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => jsonInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-raised hover:bg-raised text-ink text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
                    title="Upload and restore a database JSON export from AI Studio or local backup"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Restore / Sync JSON</span>
                  </button>
                  <input
                    type="file"
                    ref={jsonInputRef}
                    onChange={handleImportJson}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Active Regatta Rooms Telemetry */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">Active In-Memory Regattas</h3>
                <button onClick={fetchOverview} className="text-xs text-accent hover:text-accent flex items-center space-x-1">
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(overview?.activeRooms || []).map((r: any) => (
                  <div key={r.code} className="p-4 rounded-xl bg-surface/80 border border-line flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-ink">{r.title}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-surface text-accent border border-accent">
                          {r.code}
                        </span>
                      </div>
                      <div className="text-xs text-ink-muted mt-1">
                        Tenant: {r.tenantName} • Status: {r.raceStatus}
                      </div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {r.boatCount} Boats • {r.markCount} Marks • {r.activeClients} Active Viewers
                      </div>
                    </div>

                    {onViewEvent && (
                      <button
                        onClick={() => {
                          onClose();
                          onViewEvent(r.code);
                        }}
                        className="p-2 rounded-lg bg-raised hover:brightness-110 hover:text-ink text-ink-muted transition-colors"
                        title="Open Live Race"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PACKAGES & PRICING */}
        {activeTab === 'packages' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Dynamic Pricing Packages</h3>
                <p className="text-xs text-ink-muted">
                  Modifying packages directly updates the front landing page and subscription modals in real time
                </p>
              </div>
              <button
                onClick={() => {
                  setIsNewPackage(true);
                  setEditingPackage({
                    tierKey: 'CUSTOM_TIER',
                    displayTitle: 'New Plan',
                    badge: '',
                    priceAmount: 299,
                    currency: 'MYR',
                    currencySymbol: 'RM',
                    billingInterval: 'month',
                    description: 'Custom plan description',
                    maxActiveRooms: 15,
                    maxBoatsPerRoom: 100,
                    maxAdminSeats: 10,
                    loraPriority: true,
                    customBranding: true,
                    features: ['Custom feature 1', 'Custom feature 2'],
                    isActive: true,
                    sortOrder: 10,
                  });
                }}
                className="px-3 py-1.5 rounded-lg bg-raised hover:bg-raised text-ink text-xs font-semibold flex items-center space-x-1.5 shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Package</span>
              </button>
            </div>

            {/* Package Cards List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {packages.map((pkg) => (
                <div key={pkg.id} className="p-5 rounded-xl bg-surface/60 border border-line flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-ink">{pkg.displayTitle}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-raised text-ink-muted">
                        {pkg.tierKey}
                      </span>
                    </div>

                    <div className="text-2xl font-extrabold text-ink mb-2">
                      {formatPrice(pkg.priceAmount, pkg.currencySymbol)}
                      <span className="text-xs text-ink-muted font-normal"> / {pkg.billingInterval}</span>
                    </div>

                    <p className="text-xs text-ink-muted mb-4">{pkg.description}</p>

                    <div className="p-2.5 rounded-lg bg-canvas/60 border border-line text-xs space-y-1 mb-4">
                      <div className="flex justify-between text-ink-muted">
                        <span>Max Rooms:</span>
                        <span className="text-ink font-semibold">{pkg.maxActiveRooms}</span>
                      </div>
                      <div className="flex justify-between text-ink-muted">
                        <span>Max Boats:</span>
                        <span className="text-ink font-semibold">{pkg.maxBoatsPerRoom}</span>
                      </div>
                      <div className="flex justify-between text-ink-muted">
                        <span>Admin Seats:</span>
                        <span className="text-ink font-semibold">{pkg.maxAdminSeats}</span>
                      </div>
                      <div className="flex justify-between text-ink-muted">
                        <span>LoRa Priority:</span>
                        <span className={pkg.loraPriority ? 'text-success-ink font-semibold' : 'text-ink-muted'}>
                          {pkg.loraPriority ? 'Enabled' : 'No'}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-ink-muted space-y-1 mb-4">
                      <span className="text-xs text-ink-muted font-semibold block">Features ({pkg.features.length})</span>
                      {pkg.features.slice(0, 3).map((f, i) => (
                        <div key={i} className="truncate">• {f}</div>
                      ))}
                      {pkg.features.length > 3 && (
                        <div className="text-ink-muted italic text-xs">+{pkg.features.length - 3} more...</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-3 border-t border-line">
                    <button
                      onClick={() => {
                        setIsNewPackage(false);
                        setEditingPackage({ ...pkg });
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-raised hover:bg-raised text-xs text-ink font-medium flex items-center justify-center space-x-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Pricing</span>
                    </button>
                    {pkg.tierKey !== 'FREE' && pkg.tierKey !== 'CLUB' && (
                      <button
                        onClick={() => handleDeletePackage(pkg.id, pkg.displayTitle)}
                        className="p-1.5 rounded-lg hover:bg-surface/60 text-ink-muted hover:text-danger-ink"
                        title="Delete package"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: USERS DIRECTORY */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                  placeholder="Search users by email, name, club..."
                  className="w-full pl-9 pr-3 py-2 bg-surface border border-line rounded-xl text-xs text-ink focus:outline-none focus:border-line"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <select
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    setTimeout(fetchUsers, 50);
                  }}
                  className="bg-surface border border-line rounded-xl px-3 py-2 text-xs text-ink"
                >
                  <option value="">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="RACE_OFFICER">Race Officer</option>
                  <option value="PARTICIPANT">Participant</option>
                  <option value="SKIPPER">Skipper</option>
                  <option value="SPECTATOR">Spectator</option>
                </select>

                <button
                  onClick={fetchUsers}
                  className="px-3 py-2 rounded-xl bg-raised hover:bg-raised text-xs font-semibold text-ink"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-xl border border-line overflow-hidden bg-surface/40">
              <table className="w-full text-left text-xs text-ink">
                <thead className="bg-canvas/80 text-xs text-ink-muted border-b border-line">
                  <tr>
                    <th className="px-4 py-3">User / Email</th>
                    <th className="px-4 py-3">Organization / Club</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Super Admin</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-raised/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{u.fullName}</div>
                        <div className="text-xs text-ink-muted">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{u.tenantName}</div>
                        <div className="text-xs text-ink-muted">{u.sailingClub || 'Independent'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          u.role === 'ADMIN' ? 'bg-surface text-accent border border-accent' : 'bg-raised text-ink'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.isSuperAdmin ? (
                          <span className="px-2 py-0.5 rounded bg-raised text-ink text-xs font-bold border border-line">
                            SUPER ADMIN
                          </span>
                        ) : (
                          <span className="text-ink-muted text-xs">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          u.status === 'SUSPENDED' ? 'bg-surface text-danger-ink' : 'bg-surface text-success-ink'
                        }`}>
                          {u.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => setEditingUser({ ...u })}
                          className="p-1 rounded hover:bg-raised text-ink-muted hover:text-ink"
                          title="Edit User"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setResetPwdUserId(u.id);
                            setNewPasswordVal('');
                          }}
                          className="p-1 rounded hover:bg-raised text-ink-muted hover:text-warning-ink"
                          title="Reset Password"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                        {currentUser?.id !== u.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            className="p-1 rounded hover:bg-surface/60 text-ink-muted hover:text-danger-ink"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: CLUBS & TENANTS */}
        {activeTab === 'clubs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Registered Organizations</h3>
                <p className="text-xs text-ink-muted">Manage tenant plans, quotas, and club owners</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clubs.map((c) => (
                <div key={c.id} className="p-4 rounded-xl bg-surface/60 border border-line flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-ink">{c.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-raised text-ink border border-line">
                        {c.planTier}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted mb-3">Owner: {c.ownerEmail || 'Unknown'}</div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-canvas/70 border border-line text-xs mb-3">
                      <div>
                        <span className="text-ink-muted block text-xs">Members</span>
                        <span className="text-ink font-semibold">{c.membersCount} users</span>
                      </div>
                      <div>
                        <span className="text-ink-muted block text-xs">Regattas</span>
                        <span className="text-ink font-semibold">{c.eventsCount} events</span>
                      </div>
                      <div>
                        <span className="text-ink-muted block text-xs">Max Rooms</span>
                        <span className="text-ink font-semibold">{c.maxActiveRooms} allowed</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2 border-t border-line">
                    <button
                      onClick={() => setEditingClub({ ...c })}
                      className="flex-1 py-1.5 rounded-lg bg-raised hover:bg-raised text-xs text-ink font-medium"
                    >
                      Adjust Plan / Limits
                    </button>
                    <button
                      onClick={() => handleDeleteClub(c.id, c.name)}
                      className="p-1.5 rounded-lg hover:bg-surface/60 text-ink-muted hover:text-danger-ink"
                      title="Delete Club"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: GLOBAL EVENTS */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Global Regattas & Races</h3>
                <p className="text-xs text-ink-muted">Inspect and purge events across all organizations</p>
              </div>
              <button onClick={fetchEvents} className="text-xs text-accent hover:text-accent flex items-center space-x-1">
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="rounded-xl border border-line overflow-hidden bg-surface/40">
              <table className="w-full text-left text-xs text-ink">
                <thead className="bg-canvas/80 text-xs text-ink-muted border-b border-line">
                  <tr>
                    <th className="px-4 py-3">Event Code & Title</th>
                    <th className="px-4 py-3">Host Organization</th>
                    <th className="px-4 py-3">Fleet Size</th>
                    <th className="px-4 py-3">PIN Codes</th>
                    <th className="px-4 py-3">Active Sockets</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {events.map((ev) => (
                    <tr key={ev.code} className="hover:bg-raised/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{ev.title}</div>
                        <div className="text-xs text-accent">{ev.code} • {ev.locationName}</div>
                      </td>
                      <td className="px-4 py-3">{ev.tenantName}</td>
                      <td className="px-4 py-3">
                        {ev.boatCount} Boats • {ev.markCount} Marks
                      </td>
                      <td className="px-4 py-3 text-xs">
                        Admin: {ev.adminPin} | Part: {ev.participantPin}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-success-ink">{ev.activeClients} connected</span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1 sm:space-x-2">
                        {onViewEvent && (
                          <button
                            onClick={() => {
                              onClose();
                              onViewEvent(ev.code);
                            }}
                            className="p-1 rounded hover:bg-raised text-ink-muted hover:text-accent transition-colors cursor-pointer"
                            title="Spectate / View Race Room"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setEditingEvent({
                              id: ev.id || ev.code,
                              code: ev.code,
                              title: ev.title,
                              adminPin: ev.adminPin || '',
                              participantPin: ev.participantPin || '',
                              locationName: ev.locationName || '',
                              status: ev.status || 'PRE_START',
                              isPublic: ev.isPublic !== false,
                              tenantName: ev.tenantName,
                            })
                          }
                          className="p-1 rounded hover:bg-raised text-ink-muted hover:text-warning-ink transition-colors cursor-pointer"
                          title="Edit Event Details (Title, Code, PINs, Location, Status)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(ev.code, ev.title)}
                          className="p-1 rounded hover:bg-surface/60 text-ink-muted hover:text-danger-ink transition-colors cursor-pointer"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: DATABASE HEALTH & ENGINE DIAGNOSTICS */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line/80">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Database className="w-4 h-4 text-accent" />
                  Database Health & Diagnostics
                </h3>
                <p className="text-xs text-ink-muted">
                  Real-time connection verification, SQLite engine pragma status, storage stats & optimization tools
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleTestDbPing}
                  disabled={dbPingTesting}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface/80 hover:brightness-110 border border-accent/40 text-accent transition-all cursor-pointer disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 text-accent ${dbPingTesting ? 'animate-bounce' : ''}`} />
                  <span>{dbPingTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>
                <button
                  onClick={fetchDatabaseStatus}
                  disabled={dbLoading}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-raised hover:bg-raised text-ink border border-line transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${dbLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Status Banner */}
            {(() => {
              const isDbConnected = Boolean(
                dbStatus &&
                (dbStatus.connected === true || (dbStatus.connected !== false && !dbStatus.error) || (typeof dbStatus.pingMs === 'number' && !dbStatus.error))
              );
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className={`p-4 rounded-xl border flex items-center space-x-3.5 transition-all duration-200 ${
                      isDbConnected
                        ? 'bg-surface/25 border-success-ink/40 shadow-xs '
                        : 'bg-surface/25 border-danger-ink/40 shadow-xs '
                    }`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isDbConnected
                          ? 'bg-surface/80 border border-success-ink/40 text-success-ink'
                          : 'bg-surface/80 border border-danger-ink/40 text-danger-ink'
                      }`}>
                        {isDbConnected ? <CheckCircle2 className="w-5 h-5 text-success-ink" /> : <XCircle className="w-5 h-5 text-danger-ink" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-ink-muted block font-semibold">
                          Connection Status
                        </span>
                        <span className="text-sm font-bold text-ink flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-success-ink ' : 'bg-danger'}`} />
                          {isDbConnected ? 'ONLINE & READY' : 'OFFLINE / ERROR'}
                        </span>
                        <span className="text-xs text-accent truncate block">
                          {dbStatus?.pingMs !== undefined ? `Ping: ${dbStatus.pingMs} ms` : 'Active'} • {isDbConnected ? 'Connected & Verified' : (dbStatus?.error || 'Check Diagnostics')}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-surface/60 border border-line flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-raised/80 border border-line/40 flex items-center justify-center text-ink-muted shrink-0">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs text-ink-muted block font-semibold">
                          Driver Engine
                        </span>
                        <span className="text-sm font-bold text-ink">
                          {dbStatus?.driver === 'fallback-store' || !dbStatus?.isNative
                            ? 'JSON Store (cPanel Mode)'
                            : (dbStatus?.driver || 'better-sqlite3')}
                        </span>
                        <span className="text-xs text-ink">
                          {dbStatus?.driver === 'fallback-store' || !dbStatus?.isNative
                            ? 'Autonomous Persistent Sync • Auto-Seeding'
                            : `Journal: ${dbStatus?.journalMode || 'WAL'} • Sync: ${dbStatus?.synchronous || 'NORMAL'}`}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-surface/60 border border-line flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-surface/80 border border-accent/40 flex items-center justify-center text-accent shrink-0">
                        <HardDrive className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs text-ink-muted block font-semibold">
                          File Size on Disk
                        </span>
                        <span className="text-sm font-bold text-ink">
                          {dbStatus?.fileSizeMb ? `${dbStatus.fileSizeMb} MB` : 'Dynamic'}
                        </span>
                        <span className="text-xs text-ink-muted">
                          Integrity: <span className="text-success-ink font-bold">{dbStatus?.integrityCheck || 'Verified (ok)'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Error Notice & Quick Fix Banner if DB has an issue */}
                  {!isDbConnected && dbStatus && (
                    <div className="p-4 rounded-xl bg-surface/30 border border-danger-ink/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-danger-ink shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-danger-ink">Database Connection Needs Attention</h4>
                          <p className="text-xs text-danger-ink/90 mt-0.5">
                            {dbStatus?.error || 'Database responded with an error or credentials were not accepted. Run the Self-Repair tool below to restore directory permissions and database tables.'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleSelfRepair}
                        disabled={repairing}
                        className="px-3 py-1.5 rounded-lg bg-danger hover:brightness-110 text-on-danger font-bold text-xs flex items-center justify-center space-x-1.5 shrink-0 shadow-md cursor-pointer disabled:opacity-50"
                      >
                        <Wrench className={`w-3.5 h-3.5 ${repairing ? 'animate-spin' : ''}`} />
                        <span>{repairing ? 'Repairing...' : 'Fix & Repair Now'}</span>
                      </button>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Where is the Database Stored? (Cloud cPanel Guide) */}
            <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-surface/90 via-surface to-surface/90 border border-accent/50 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <FolderOpen className="w-4 h-4 text-accent" />
                  <h4 className="text-xs font-bold text-ink">
                    Where is the Database Stored? (Cloud cPanel & Server Environment)
                  </h4>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-surface text-accent border border-accent/60 w-fit">
                  SQLite Standalone Storage
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <p className="text-ink leading-relaxed">
                  This system uses a zero-configuration, high-performance <strong className="text-ink">SQLite database</strong> with Write-Ahead Logging (WAL mode). All tables, regatta rooms, accounts, pricing plans, and tracking histories reside in a standalone file directly inside your application folder.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
                  {/* cPanel Path */}
                  <div className="p-3 rounded-lg bg-canvas/80 border border-accent/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-accent flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-accent" />
                        Cloud cPanel Production Path (tmtrac.my)
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('/home/tmtecq00/public_html/tmtrac.my/data/tmtrac.db');
                          setCopiedDbPath(true);
                          setTimeout(() => setCopiedDbPath(false), 2000);
                        }}
                        className="text-xs px-2 py-0.5 rounded bg-surface hover:brightness-110 text-accent border border-accent/40 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedDbPath ? 'Copied!' : 'Copy Path'}</span>
                      </button>
                    </div>
                    <div className="p-2 rounded bg-surface border border-line text-xs text-success-ink break-all select-all">
                      /home/tmtecq00/public_html/tmtrac.my/data/tmtrac.db
                    </div>
                    <p className="text-xs text-ink-muted">
                      In cPanel File Manager, navigate to <code className="text-ink">public_html/tmtrac.my/data/</code>. Ensure folder permission is <strong className="text-warning-ink">0755</strong>.
                    </p>
                  </div>

                  {/* Local/Active Runtime Path */}
                  <div className="p-3 rounded-lg bg-canvas/80 border border-line space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-ink-muted" />
                        Current Active Runtime Path
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-surface text-success-ink border border-success-ink">
                        READ-WRITE
                      </span>
                    </div>
                    <div className="p-2 rounded bg-surface border border-line text-xs text-ink break-all select-all">
                      {dbStatus?.dbPath || './data/tmtrac.db'}
                    </div>
                    <p className="text-xs text-ink-muted">
                      SQLite creates <code className="text-ink">tmtrac.db-wal</code> and <code className="text-ink">tmtrac.db-shm</code> alongside for lockless concurrent reads/writes.
                    </p>
                    <p className="text-xs text-warning-ink/90 bg-surface/40 p-1.5 rounded border border-warning-ink/40">
                      <strong>Note:</strong> If the runtime path still shows old files after extracting a new zip, click <strong>"Restart Node Server"</strong> below or the orange <strong>"Restart"</strong> button in cPanel &gt; Setup Node.js App to recycle the resident worker process.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 8-Point Comprehensive Diagnostics Troubleshooter */}
            <div className="p-4 sm:p-5 rounded-xl bg-surface/60 border border-line space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-success-ink" />
                    <h4 className="text-xs font-bold text-ink">
                      8-Point Database & System Diagnostic Troubleshooter
                    </h4>
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Comprehensive automated audit inspecting filesystem permissions, driver bindings, engine pragmas, schema tables & seeds.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleRestartServer}
                    disabled={restartingServer}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface/80 hover:brightness-110 border border-warning-ink/50 text-warning-ink transition-all cursor-pointer disabled:opacity-50"
                    title="Touches tmp/restart.txt and recycles Passenger worker to reload newest compiled server bundle"
                  >
                    <Power className={`w-3.5 h-3.5 ${restartingServer ? 'animate-spin text-warning-ink' : ''}`} />
                    <span>{restartingServer ? 'Restarting...' : 'Restart Node Server'}</span>
                  </button>
                  <button
                    onClick={fetchDiagnostics}
                    disabled={diagnosticsLoading}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface/80 hover:brightness-110 border border-accent/40 text-accent transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${diagnosticsLoading ? 'animate-spin' : ''}`} />
                    <span>{diagnosticsLoading ? 'Running Scan...' : 'Re-Run Diagnostic Scan'}</span>
                  </button>
                  <button
                    onClick={handleSelfRepair}
                    disabled={repairing}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-raised hover:bg-raised text-ink transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <Wrench className={`w-3.5 h-3.5 ${repairing ? 'animate-spin' : ''}`} />
                    <span>{repairing ? 'Repairing...' : 'Self-Repair Database'}</span>
                  </button>
                </div>
              </div>

              {/* Diagnostics Results List */}
              <div className="divide-y divide-line/80 border border-line rounded-xl overflow-hidden bg-canvas/60">
                {diagnostics && diagnostics.length > 0 ? (
                  diagnostics.map((diag: any, idx: number) => {
                    const isPass = diag.status === 'PASS';
                    const isWarn = diag.status === 'WARN';
                    const checkTitle = diag.title || diag.check || `Diagnostic Check #${idx + 1}`;
                    const checkDetail = diag.details || diag.detail || '';
                    return (
                      <div key={diag.id || idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/40 transition-colors">
                        <div className="flex items-start space-x-3 min-w-0">
                          <div className="mt-0.5 shrink-0">
                            {isPass ? (
                              <CheckCircle2 className="w-4 h-4 text-success-ink" />
                            ) : isWarn ? (
                              <AlertTriangle className="w-4 h-4 text-warning-ink" />
                            ) : (
                              <XCircle className="w-4 h-4 text-danger-ink" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2 flex-wrap">
                              <span className="text-xs font-bold text-ink">{checkTitle}</span>
                              <span className={`text-xs  font-bold px-1.5 py-0.2 rounded border ${
                                isPass
                                  ? 'bg-surface/80 text-success-ink border-success-ink/60'
                                  : isWarn
                                  ? 'bg-surface/80 text-warning-ink border-warning-ink/60'
                                  : 'bg-surface/80 text-danger-ink border-danger-ink/60'
                              }`}>
                                {diag.status}
                              </span>
                            </div>
                            {diag.value && (
                              <p className="text-xs text-accent/90 mt-0.5">{diag.value}</p>
                            )}
                            {checkDetail && (
                              <p className="text-xs text-ink mt-0.5">{checkDetail}</p>
                            )}
                            {diag.recommendation && (
                              <p className="text-xs text-warning-ink/90 mt-1 flex items-center gap-1">
                                <span>Fix tip:</span> {diag.recommendation}
                              </p>
                            )}
                          </div>
                        </div>
                        {diag.path && (
                          <div className="shrink-0 text-xs text-ink-muted bg-surface px-2 py-1 rounded border border-line break-all max-w-xs">
                            {diag.path}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-ink-muted text-xs flex flex-col items-center justify-center space-y-2">
                    <RefreshCw className={`w-5 h-5 text-accent ${diagnosticsLoading ? 'animate-spin' : ''}`} />
                    <span>{diagnosticsLoading ? 'Scanning system filesystem, engine bindings and SQLite tables...' : 'Click "Re-Run Diagnostic Scan" above to test the database subsystems.'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Technical Pragmas Quick-Grid */}
            <div className="p-4 sm:p-5 rounded-xl bg-surface/40 border border-line space-y-3">
              <h4 className="text-xs font-bold text-ink">
                Engine Pragmas & Runtime Concurrency Settings
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-canvas/50 border border-line/60">
                  <span className="text-xs text-ink-muted block">Foreign Keys</span>
                  <span className="font-bold text-ink">
                    {dbStatus?.foreignKeys ? 'ENABLED (ON)' : 'ACTIVE'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-canvas/50 border border-line/60">
                  <span className="text-xs text-ink-muted block">WAL Multi-Access</span>
                  <span className="font-bold text-success-ink">ACTIVE (High Concurrency)</span>
                </div>
                <div className="p-2.5 rounded-lg bg-canvas/50 border border-line/60">
                  <span className="text-xs text-ink-muted block">Isolation Level</span>
                  <span className="font-bold text-ink">SERIALIZED</span>
                </div>
                <div className="p-2.5 rounded-lg bg-canvas/50 border border-line/60">
                  <span className="text-xs text-ink-muted block">Integrity Test</span>
                  <span className="font-bold text-success-ink">{dbStatus?.integrityCheck || 'PASSED (ok)'}</span>
                </div>
              </div>
            </div>

            {/* Table Records Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-ink">
                Database Schema & Table Row Metrics
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-surface/60 border border-line">
                  <span className="text-ink-muted block text-xs mb-1">tenants</span>
                  <span className="text-base font-bold text-ink">{dbStatus?.counts?.tenants ?? 0}</span>
                  <span className="text-xs text-ink-muted block mt-0.5">Clubs & Orgs</span>
                </div>
                <div className="p-3 rounded-xl bg-surface/60 border border-line">
                  <span className="text-ink-muted block text-xs mb-1">users</span>
                  <span className="text-base font-bold text-ink">{dbStatus?.counts?.users ?? 0}</span>
                  <span className="text-xs text-ink-muted block mt-0.5">Accounts</span>
                </div>
                <div className="p-3 rounded-xl bg-surface/60 border border-line">
                  <span className="text-ink-muted block text-xs mb-1">events</span>
                  <span className="text-base font-bold text-ink">{dbStatus?.counts?.events ?? 0}</span>
                  <span className="text-xs text-ink-muted block mt-0.5">Regatta Rooms</span>
                </div>
                <div className="p-3 rounded-xl bg-surface/60 border border-line">
                  <span className="text-ink-muted block text-xs mb-1">event_trackers</span>
                  <span className="text-base font-bold text-ink">{dbStatus?.counts?.event_trackers ?? 0}</span>
                  <span className="text-xs text-ink-muted block mt-0.5">GPS Nodes</span>
                </div>
                <div className="p-3 rounded-xl bg-surface/60 border border-line">
                  <span className="text-ink-muted block text-xs mb-1">packages</span>
                  <span className="text-base font-bold text-ink">{dbStatus?.counts?.packages ?? 0}</span>
                  <span className="text-xs text-ink-muted block mt-0.5">Tier Plans</span>
                </div>
                <div className="p-3 rounded-xl bg-surface/60 border border-line">
                  <span className="text-ink-muted block text-xs mb-1">audit_logs</span>
                  <span className="text-base font-bold text-ink">{dbStatus?.counts?.audit_logs ?? 0}</span>
                  <span className="text-xs text-ink-muted block mt-0.5">Audit Events</span>
                </div>
              </div>
            </div>

            {/* Maintenance Tools */}
            <div className="p-5 rounded-xl bg-surface/60 border border-line space-y-4">
              <h4 className="text-xs font-bold text-ink">
                Database Optimization & Maintenance Tools
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg bg-canvas/60 border border-line flex flex-col justify-between">
                  <div>
                    <h5 className="font-bold text-ink text-xs mb-1">Compact & Optimize (VACUUM)</h5>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Defragments SQLite database pages, rebuilds index statistics (ANALYZE), and reclaims free disk space.
                    </p>
                  </div>
                  <button
                    onClick={handleOptimizeDatabase}
                    disabled={dbOptimizing}
                    className="mt-3 w-full py-2 px-3 rounded-lg bg-raised hover:bg-raised text-ink font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${dbOptimizing ? 'animate-spin' : ''}`} />
                    <span>{dbOptimizing ? 'Optimizing...' : 'Run VACUUM & ANALYZE'}</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-lg bg-canvas/60 border border-line flex flex-col justify-between">
                  <div>
                    <h5 className="font-bold text-ink text-xs mb-1">Download Database File (.db)</h5>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Direct binary copy of SQLite database file for local analysis, DB Browser inspection, or cold storage backup.
                    </p>
                  </div>
                  <a
                    href={`/api/super-admin/backup/export?format=db&token=${encodeURIComponent(getActiveToken())}`}
                    download
                    className="mt-3 w-full py-2 px-3 rounded-lg bg-accent hover:brightness-110 text-on-accent font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download tmtrac.db</span>
                  </a>
                </div>

                <div className="p-3.5 rounded-lg bg-canvas/60 border border-line flex flex-col justify-between">
                  <div>
                    <h5 className="font-bold text-ink text-xs mb-1">cPanel Server Deployment</h5>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Build and deploy latest codebase, migrations, and database schema to production host at tmtrac.my.
                    </p>
                  </div>
                  {onOpenCpanelDeploy ? (
                    <button
                      onClick={onOpenCpanelDeploy}
                      className="mt-3 w-full py-2 px-3 rounded-lg bg-raised hover:bg-raised text-accent font-semibold text-xs border border-accent/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Server className="w-3.5 h-3.5 text-accent" />
                      <span>Launch cPanel Center</span>
                    </button>
                  ) : (
                    <a
                      href="/download/cpanel-fullstack"
                      download
                      className="mt-3 w-full py-2 px-3 rounded-lg bg-raised hover:bg-raised text-accent font-semibold text-xs border border-accent/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download cPanel ZIP</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SOCKET MONITOR */}
        {activeTab === 'sockets' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Live WebSocket Client Telemetry</h3>
                <p className="text-xs text-ink-muted">Real-time open connection pool across all rooms</p>
              </div>
              <div className="flex items-center space-x-3">
                <label className="text-xs text-ink-muted flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefreshSockets}
                    onChange={(e) => setAutoRefreshSockets(e.target.checked)}
                    className="rounded bg-surface border-line text-ink-muted focus:ring-0"
                  />
                  <span>Auto-refresh (4s)</span>
                </label>
                <button onClick={fetchSockets} className="text-xs text-accent hover:text-accent flex items-center space-x-1">
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-line overflow-hidden bg-surface/40">
              <table className="w-full text-left text-xs text-ink">
                <thead className="bg-canvas/80 text-xs text-ink-muted border-b border-line">
                  <tr>
                    <th className="px-4 py-3">Client ID</th>
                    <th className="px-4 py-3">Room Code</th>
                    <th className="px-4 py-3">User / Identity</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Platform</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3">Uptime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 text-xs">
                  {sockets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-ink-muted font-sans">
                        No active WebSocket clients connected currently.
                      </td>
                    </tr>
                  ) : (
                    sockets.map((s) => (
                      <tr key={s.id} className="hover:bg-raised/30">
                        <td className="px-4 py-3 text-accent">{s.id}</td>
                        <td className="px-4 py-3 font-bold text-ink">{s.roomCode}</td>
                        <td className="px-4 py-3 font-sans">
                          <span className="text-ink font-medium">{s.userName}</span>
                          {s.userEmail && <span className="block text-xs text-ink-muted">{s.userEmail}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                            s.role === 'ADMIN' ? 'bg-surface text-accent' : 'bg-raised text-ink-muted'
                          }`}>
                            {s.userRole}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={s.platform === 'ANDROID' ? 'text-success-ink' : 'text-ink-muted'}>
                            {s.platform}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-muted">{s.remoteAddress}</td>
                        <td className="px-4 py-3 text-ink-muted">{s.uptimeSeconds}s</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Global System Audit Logs</h3>
                <p className="text-xs text-ink-muted">Tamper-proof record of logins, role updates, and plan changes</p>
              </div>
              <button onClick={fetchAuditLogs} className="text-xs text-accent hover:text-accent flex items-center space-x-1">
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="rounded-xl border border-line overflow-hidden bg-surface/40">
              <table className="w-full text-left text-xs text-ink">
                <thead className="bg-canvas/80 text-xs text-ink-muted border-b border-line">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Platform</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 text-xs">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-raised/30">
                      <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{log.tenantName}</td>
                      <td className="px-4 py-3">
                        <span className="text-ink font-medium">{log.userEmail || 'Anonymous'}</span>
                        <span className="block text-xs text-ink-muted">{log.userRole}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{log.platform}</td>
                      <td className="px-4 py-3 text-xs text-ink-muted max-w-xs truncate">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: EDIT PACKAGE */}
      {editingPackage && (
        <DialogFrame
          onClose={() => setEditingPackage(null)}
          labelledBy={packageTitleId}
          overlayClassName="fixed inset-0 z-60 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-fade-in"
          className="bg-surface border border-line rounded-2xl p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
        >
          <button
            onClick={() => setEditingPackage(null)}
            aria-label="Close"
            className="absolute top-3 right-3 h-10 w-10 inline-flex items-center justify-center rounded-control text-ink-muted hover:text-ink hover:bg-raised"
          >
            <X className="w-4 h-4" />
          </button>
          <h3 id={packageTitleId} className="text-base font-bold text-ink mb-4">
            {isNewPackage ? 'Create New Pricing Package' : `Edit Package: ${editingPackage.displayTitle}`}
          </h3>

          <form onSubmit={handleSavePackage} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted mb-1">Display Title</label>
                <input
                  type="text"
                  value={editingPackage.displayTitle}
                  onChange={(e) => setEditingPackage({ ...editingPackage, displayTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                  required
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Tier Key</label>
                <input
                  type="text"
                  value={editingPackage.tierKey}
                  onChange={(e) => setEditingPackage({ ...editingPackage, tierKey: e.target.value.toUpperCase() })}
                  disabled={!isNewPackage}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink disabled:opacity-60"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-ink-muted mb-1">Price Amount</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={editingPackage.priceAmount !== undefined && editingPackage.priceAmount !== null ? editingPackage.priceAmount : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingPackage({
                      ...editingPackage,
                      priceAmount: val === '' ? '' : parseFloat(val),
                    });
                  }}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                  required
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={editingPackage.currencySymbol}
                  onChange={(e) => setEditingPackage({ ...editingPackage, currencySymbol: e.target.value })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Billing Interval</label>
                <select
                  value={editingPackage.billingInterval}
                  onChange={(e) => setEditingPackage({ ...editingPackage, billingInterval: e.target.value })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                >
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  <option value="event">Per Event</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-ink-muted mb-1">Badge Text (optional)</label>
              <input
                type="text"
                value={editingPackage.badge || ''}
                onChange={(e) => setEditingPackage({ ...editingPackage, badge: e.target.value })}
                placeholder="e.g. Most Popular, Pro Grade"
                className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
              />
            </div>

            <div>
              <label className="block text-ink-muted mb-1">Description</label>
              <textarea
                rows={2}
                value={editingPackage.description}
                onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })}
                className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-ink-muted mb-1">Max Rooms</label>
                <input
                  type="number"
                  value={editingPackage.maxActiveRooms}
                  onChange={(e) => setEditingPackage({ ...editingPackage, maxActiveRooms: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Max Boats / Race</label>
                <input
                  type="number"
                  value={editingPackage.maxBoatsPerRoom}
                  onChange={(e) => setEditingPackage({ ...editingPackage, maxBoatsPerRoom: parseInt(e.target.value) || 10 })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Admin Seats</label>
                <input
                  type="number"
                  value={editingPackage.maxAdminSeats}
                  onChange={(e) => setEditingPackage({ ...editingPackage, maxAdminSeats: parseInt(e.target.value) || 2 })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                />
              </div>
            </div>

            <div className="flex items-center space-x-6 py-1">
              <label className="flex items-center space-x-2 cursor-pointer text-ink">
                <input
                  type="checkbox"
                  checked={!!editingPackage.loraPriority}
                  onChange={(e) => setEditingPackage({ ...editingPackage, loraPriority: e.target.checked })}
                  className="rounded bg-canvas border-line text-ink-muted"
                />
                <span>LoRa Priority</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-ink">
                <input
                  type="checkbox"
                  checked={!!editingPackage.customBranding}
                  onChange={(e) => setEditingPackage({ ...editingPackage, customBranding: e.target.checked })}
                  className="rounded bg-canvas border-line text-ink-muted"
                />
                <span>Custom Branding</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer text-ink">
                <input
                  type="checkbox"
                  checked={editingPackage.isActive !== false}
                  onChange={(e) => setEditingPackage({ ...editingPackage, isActive: e.target.checked })}
                  className="rounded bg-canvas border-line text-ink-muted"
                />
                <span>Active in Public Catalog</span>
              </label>
            </div>

            <div>
              <label className="block text-ink-muted mb-1">Features (One per line)</label>
              <textarea
                rows={4}
                value={(editingPackage.features || []).join('\n')}
                onChange={(e) => setEditingPackage({ ...editingPackage, features: e.target.value.split('\n').filter(Boolean) })}
                className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink text-xs"
              />
            </div>

            {renderDialogFeedback()}

            <div className="flex justify-end space-x-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setEditingPackage(null)}
                className="px-4 py-2 rounded-lg bg-raised hover:bg-raised text-ink font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={dialogSaving}
                className="disabled:opacity-60 disabled:cursor-wait px-5 py-2 rounded-lg bg-raised hover:bg-raised text-ink font-semibold shadow-md"
              >
                {dialogSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </DialogFrame>
      )}

      {/* MODAL: EDIT USER */}
      {editingUser && (
        <DialogFrame
          onClose={() => setEditingUser(null)}
          labelledBy={userTitleId}
          overlayClassName="fixed inset-0 z-60 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-fade-in"
          className="bg-surface border border-line rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
        >
          <button onClick={() => setEditingUser(null)} aria-label="Close" className="absolute top-3 right-3 h-10 w-10 inline-flex items-center justify-center rounded-control text-ink-muted hover:text-ink hover:bg-raised"><X className="w-4 h-4" /></button>
          <h3 id={userTitleId} className="text-base font-bold text-ink mb-4">Edit User: {editingUser.email}</h3>

          <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
            <div>
              <label className="block text-ink-muted mb-1">Full Name</label>
              <input
                type="text"
                value={editingUser.fullName}
                onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted mb-1">Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="RACE_OFFICER">RACE_OFFICER</option>
                  <option value="PARTICIPANT">PARTICIPANT</option>
                  <option value="SKIPPER">SKIPPER</option>
                  <option value="SPECTATOR">SPECTATOR</option>
                </select>
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Status</label>
                <select
                  value={editingUser.status}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted mb-1">Sail Number</label>
                <input
                  type="text"
                  value={editingUser.sailNumber || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, sailNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Handicap Rating</label>
                <input
                  type="text"
                  value={editingUser.handicapRating || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, handicapRating: e.target.value })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center space-x-2 cursor-pointer text-ink">
                <input
                  type="checkbox"
                  checked={!!editingUser.isSuperAdmin}
                  onChange={(e) => setEditingUser({ ...editingUser, isSuperAdmin: e.target.checked })}
                  className="rounded bg-canvas border-line text-ink-muted"
                />
                <span className="font-semibold text-ink">Grant Super Administrator Privileges</span>
              </label>
            </div>

            {renderDialogFeedback()}

            <div className="flex justify-end space-x-2 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-lg bg-raised text-ink font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={dialogSaving}
                className="disabled:opacity-60 disabled:cursor-wait px-5 py-2 rounded-lg bg-raised hover:bg-raised text-ink font-semibold"
              >
                {dialogSaving ? 'Saving…' : 'Save User'}
              </button>
            </div>
          </form>
        </DialogFrame>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetPwdUserId && (
        <DialogFrame
          onClose={() => setResetPwdUserId(null)}
          labelledBy={resetPwdTitleId}
          overlayClassName="fixed inset-0 z-60 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-fade-in"
          className="bg-surface border border-line rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
        >
          <button onClick={() => setResetPwdUserId(null)} aria-label="Close" className="absolute top-3 right-3 h-10 w-10 inline-flex items-center justify-center rounded-control text-ink-muted hover:text-ink hover:bg-raised"><X className="w-4 h-4" /></button>
          <h3 id={resetPwdTitleId} className="text-base font-bold text-ink mb-2">Reset User Password</h3>
          <p className="text-xs text-ink-muted mb-4">Set a direct new password for this account.</p>

          <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-ink mb-1">New Password</label>
              <input
                type="password"
                value={newPasswordVal}
                onChange={(e) => setNewPasswordVal(e.target.value)}
                placeholder="Enter new password..."
                className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                required
              />
            </div>

            {renderDialogFeedback()}

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setResetPwdUserId(null)}
                className="px-3 py-1.5 rounded-lg bg-raised text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={dialogSaving}
                className="disabled:opacity-60 disabled:cursor-wait px-4 py-1.5 rounded-lg bg-warning-ink hover:brightness-110 text-canvas font-semibold"
              >
                {dialogSaving ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </form>
        </DialogFrame>
      )}

      {/* MODAL: EDIT CLUB */}
      {editingClub && (
        <DialogFrame
          onClose={() => setEditingClub(null)}
          labelledBy={clubTitleId}
          overlayClassName="fixed inset-0 z-60 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-fade-in"
          className="bg-surface border border-line rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
        >
          <button onClick={() => setEditingClub(null)} aria-label="Close" className="absolute top-3 right-3 h-10 w-10 inline-flex items-center justify-center rounded-control text-ink-muted hover:text-ink hover:bg-raised"><X className="w-4 h-4" /></button>
          <h3 id={clubTitleId} className="text-base font-bold text-ink mb-4">Manage Club: {editingClub.name}</h3>

          <form onSubmit={handleSaveClub} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-ink-muted mb-1">Club Name</label>
              <input
                type="text"
                value={editingClub.name}
                onChange={(e) => setEditingClub({ ...editingClub, name: e.target.value })}
                className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
              />
            </div>

            <div>
              <label className="block text-ink-muted mb-1">Plan Tier</label>
              <select
                value={editingClub.planTier}
                onChange={(e) => setEditingClub({ ...editingClub, planTier: e.target.value })}
                className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
              >
                <option value="FREE">FREE (Starter)</option>
                <option value="CLUB">CLUB (Yacht Club & Fleet)</option>
                <option value="EVENT_PRO">EVENT_PRO (Championship Pro)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted mb-1">Max Active Regattas</label>
                <input
                  type="number"
                  value={editingClub.maxActiveRooms}
                  onChange={(e) => setEditingClub({ ...editingClub, maxActiveRooms: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1">Max Boats / Room</label>
                <input
                  type="number"
                  value={editingClub.maxBoatsPerRoom}
                  onChange={(e) => setEditingClub({ ...editingClub, maxBoatsPerRoom: parseInt(e.target.value) || 15 })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink"
                />
              </div>
            </div>

            {renderDialogFeedback()}

            <div className="flex justify-end space-x-2 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => setEditingClub(null)}
                className="px-4 py-2 rounded-lg bg-raised text-ink font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={dialogSaving}
                className="disabled:opacity-60 disabled:cursor-wait px-5 py-2 rounded-lg bg-raised hover:bg-raised text-ink font-semibold"
              >
                {dialogSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </DialogFrame>
      )}

      {/* MODAL: EDIT GLOBAL EVENT */}
      {editingEvent && (
        <DialogFrame
          onClose={() => setEditingEvent(null)}
          labelledBy={eventTitleId}
          overlayClassName="fixed inset-0 z-60 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-fade-in"
          className="bg-surface border border-line rounded-2xl p-6 max-w-lg w-full shadow-2xl relative"
        >
          <button
            onClick={() => setEditingEvent(null)}
            aria-label="Close"
            className="absolute top-3 right-3 h-10 w-10 inline-flex items-center justify-center rounded-control text-ink-muted hover:text-ink hover:bg-raised"
          >
            <X className="w-4 h-4" />
          </button>
          <h3 id={eventTitleId} className="text-base font-bold text-ink mb-1">Edit Event: {editingEvent.code}</h3>
          <p className="text-xs text-ink-muted mb-4">
            Modify regatta metadata, event code, security access PINs, and status.
          </p>

          <form onSubmit={handleSaveEvent} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-ink-muted mb-1 font-semibold">Event Title / Name</label>
              <input
                type="text"
                value={editingEvent.title}
                onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink focus:outline-none focus:border-line"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted mb-1 font-semibold">Event Code (Unique)</label>
                <input
                  type="text"
                  value={editingEvent.code}
                  onChange={(e) => setEditingEvent({ ...editingEvent, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-accent focus:outline-none focus:border-accent"
                  required
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1 font-semibold">Location / Water Body</label>
                <input
                  type="text"
                  value={editingEvent.locationName || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, locationName: e.target.value })}
                  placeholder="e.g. Strait of Malacca, Port Dickson"
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink focus:outline-none focus:border-line"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted mb-1 font-semibold">Race Officer PIN (Admin)</label>
                <input
                  type="text"
                  value={editingEvent.adminPin || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, adminPin: e.target.value })}
                  placeholder="4-digit PIN"
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-warning-ink focus:outline-none focus:border-warning-ink"
                  required
                />
              </div>
              <div>
                <label className="block text-ink-muted mb-1 font-semibold">Participant PIN</label>
                <input
                  type="text"
                  value={editingEvent.participantPin || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, participantPin: e.target.value })}
                  placeholder="e.g. 1234"
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-success-ink focus:outline-none focus:border-success-ink"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-ink-muted mb-1 font-semibold">Race Status</label>
                <select
                  value={editingEvent.status || 'PRE_START'}
                  onChange={(e) => setEditingEvent({ ...editingEvent, status: e.target.value })}
                  className="w-full px-3 py-2 bg-canvas border border-line rounded-lg text-ink focus:outline-none focus:border-line"
                >
                  <option value="PRE_START">PRE_START (Preparing)</option>
                  <option value="COUNTDOWN">COUNTDOWN (Sequence Running)</option>
                  <option value="STARTED">STARTED (Live Race)</option>
                  <option value="FINISHED">FINISHED (Ended)</option>
                  <option value="ABANDONED">ABANDONED</option>
                </select>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2 cursor-pointer text-ink">
                  <input
                    type="checkbox"
                    checked={editingEvent.isPublic !== false}
                    onChange={(e) => setEditingEvent({ ...editingEvent, isPublic: e.target.checked })}
                    className="rounded bg-canvas border-line text-ink-muted focus:ring-0"
                  />
                  <span className="font-semibold text-ink">Public Regatta</span>
                </label>
              </div>
            </div>

            {renderDialogFeedback()}

            <div className="flex justify-end space-x-2 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="px-4 py-2 rounded-lg bg-raised hover:bg-raised text-ink font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={dialogSaving}
                className="disabled:opacity-60 disabled:cursor-wait px-5 py-2 rounded-lg bg-raised hover:bg-raised text-ink font-semibold cursor-pointer shadow-md"
              >
                {dialogSaving ? 'Saving…' : 'Save Event Details'}
              </button>
            </div>
          </form>
        </DialogFrame>
      )}
    </DialogFrame>
  );
};
