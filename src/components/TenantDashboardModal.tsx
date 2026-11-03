import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Crown,
  Layers,
  Users,
  FileText,
  Plus,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Key,
  Smartphone,
  Globe,
  Radio,
  ArrowUpRight,
} from 'lucide-react';
import { Tenant, AuditLogEntry, RegattaRoomSummary } from '../types/regatta';
import { tenantService } from '../services/tenantService';
import { roomService } from '../services/roomService';
import { SubscriptionUpgradeModal } from './SubscriptionUpgradeModal';

interface TenantDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEvent?: (roomCode: string) => void;
  onCreateEvent?: () => void;
}

export const TenantDashboardModal: React.FC<TenantDashboardModalProps> = ({
  isOpen,
  onClose,
  onSelectEvent,
  onCreateEvent,
}) => {
  const [tenant, setTenant] = useState<Tenant | null>(() => tenantService.getCurrentTenant());
  const [activeTab, setActiveTab] = useState<'events' | 'members' | 'audit' | 'plan'>('events');
  const [events, setEvents] = useState<RegattaRoomSummary[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const unsub = tenantService.onTenantChange((t) => {
      setTenant(t);
    });
    return unsub;
  }, []);

  const refreshData = async () => {
    setLoading(true);
    await tenantService.fetchCurrentTenant();
    const rooms = await roomService.fetchMyRooms();
    setEvents(rooms);

    const memRes = await tenantService.fetchMembers();
    if (memRes.success && memRes.members) {
      setMembers(memRes.members);
    }

    const auditRes = await tenantService.fetchAuditLogs();
    if (auditRes.success && auditRes.logs) {
      setAuditLogs(auditRes.logs);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTier = tenant?.planTier || 'FREE';
  const limits = tenant?.limits || { maxActiveRooms: 1, maxBoatsPerRoom: 10, maxAdminSeats: 1, loraPriority: false, customBranding: false };
  const roomsUsed = events.length;
  const isRoomLimitReached = roomsUsed >= limits.maxActiveRooms;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-lb-slate-950/85 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-lb-slate-900 border border-ll-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-lt-slate-100">
        {/* Top Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-lb-slate-900 via-lb-0b1528 to-lb-slate-900 border-b border-ll-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-lb-cyan-500/10 border border-ll-cyan-500/30 text-lt-cyan-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-lt-white tracking-wide">
                  {tenant?.name || 'Organization Dashboard'}
                </h2>
                <span className={`text-xs font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                  currentTier === 'EVENT_PRO'
                    ? 'bg-lb-amber-500/20 text-lt-amber-300 border-ll-amber-500/40'
                    : currentTier === 'CLUB'
                    ? 'bg-lb-cyan-500/20 text-lt-cyan-300 border-ll-cyan-500/40'
                    : 'bg-lb-slate-800 text-lt-slate-300 border-ll-slate-700'
                }`}>
                  {currentTier} Plan
                </span>
              </div>
              <p className="text-xs text-lt-slate-400 mt-0.5 font-mono">
                Tenant ID: {tenant?.id || 'tenant-default'} · Slug: {tenant?.slug || 'rlyc'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              disabled={loading}
              className="p-1.5 text-lt-slate-400 hover:text-lt-white rounded-lg hover:bg-lb-slate-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-lt-slate-400 hover:text-lt-white rounded-lg hover:bg-lb-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Plan Quota Banner */}
        <div className="px-6 py-3.5 bg-lb-slate-950/70 border-b border-ll-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-lt-slate-400">Active Regattas:</span>{' '}
              <span className={`font-mono font-bold ${isRoomLimitReached ? 'text-lt-amber-400' : 'text-lt-white'}`}>
                {roomsUsed} / {limits.maxActiveRooms}
              </span>
            </div>
            <div>
              <span className="text-lt-slate-400">Fleet Limit:</span>{' '}
              <span className="font-mono font-bold text-lt-white">{limits.maxBoatsPerRoom} boats</span>
            </div>
            <div>
              <span className="text-lt-slate-400">Admin Seats:</span>{' '}
              <span className="font-mono font-bold text-lt-white">{members.filter(m => m.role === 'ADMIN').length} / {limits.maxAdminSeats}</span>
            </div>
          </div>

          <button
            onClick={() => setShowUpgradeModal(true)}
            className="py-1 px-3 rounded-lg bg-gradient-to-r from-lb-cyan-600 to-lb-blue-600 hover:from-lb-cyan-500 hover:to-lb-blue-500 text-lt-white font-mono text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5" />
            Manage Subscription
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-ll-slate-800 flex gap-2 pt-2 bg-lb-slate-900/50">
          <button
            onClick={() => setActiveTab('events')}
            className={`py-2 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'events'
                ? 'border-ll-cyan-400 text-lt-cyan-300 font-bold'
                : 'border-transparent text-lt-slate-400 hover:text-lt-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Events ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-2 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'members'
                ? 'border-ll-cyan-400 text-lt-cyan-300 font-bold'
                : 'border-transparent text-lt-slate-400 hover:text-lt-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Team Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'border-ll-cyan-400 text-lt-cyan-300 font-bold'
                : 'border-transparent text-lt-slate-400 hover:text-lt-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Audit Log ({auditLogs.length})
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: EVENTS */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-lt-white">Organization Regattas</h3>
                  <p className="text-xs text-lt-slate-400">Events hosted and managed by this organization.</p>
                </div>
                <button
                  onClick={() => {
                    if (isRoomLimitReached) {
                      setShowUpgradeModal(true);
                    } else {
                      onCreateEvent?.();
                    }
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isRoomLimitReached
                      ? 'bg-lb-amber-600/80 hover:bg-lb-amber-500 text-lt-slate-950 font-bold'
                      : 'bg-lb-cyan-500 hover:bg-lb-cyan-400 text-lt-slate-950 font-bold'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isRoomLimitReached ? 'Plan Limit Reached (Upgrade)' : 'Host New Event'}
                </button>
              </div>

              {events.length === 0 ? (
                <div className="p-8 text-center border border-ll-slate-800 rounded-xl bg-lb-slate-950/40">
                  <Layers className="w-8 h-8 text-lt-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-lt-slate-400">No events found for this organization.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {events.map((ev) => (
                    <div
                      key={ev.code}
                      className="p-4 rounded-xl border border-ll-slate-800 bg-lb-slate-950/40 hover:border-ll-slate-700 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono font-bold text-lt-cyan-400 text-sm">#{ev.code}</span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-lb-slate-800 text-lt-slate-300">
                            {ev.raceStatus}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-lt-white">{ev.title}</h4>
                        <p className="text-xs text-lt-slate-400 mb-3">{ev.locationName}</p>

                        <div className="flex items-center gap-3 text-xs text-lt-slate-400 font-mono mb-3">
                          <span>{ev.boatCount} registered boats</span>
                          <span>·</span>
                          <span>{ev.markCount} course marks</span>
                          <span>·</span>
                          <span>{ev.activeClients} live peers</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onSelectEvent?.(ev.code);
                          onClose();
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-lb-slate-800 hover:bg-lb-cyan-600 hover:text-lt-white text-lt-slate-300 font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        Enter Event Console
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEAM MEMBERS */}
          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-lt-white">Organization Team Members</h3>
                  <p className="text-xs text-lt-slate-400">Administrators, race officers, and assigned skippers.</p>
                </div>
              </div>

              <div className="border border-ll-slate-800 rounded-xl overflow-hidden bg-lb-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-lb-slate-900 border-b border-ll-slate-800 text-lt-slate-400 font-mono">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Club / Sail No</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ll-slate-800/60 font-mono">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-lb-slate-900/60">
                        <td className="p-3 font-sans font-medium text-lt-white">{m.full_name}</td>
                        <td className="p-3 text-lt-slate-400">{m.email}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            m.role === 'ADMIN' ? 'bg-lb-cyan-500/20 text-lt-cyan-300' : 'bg-lb-slate-800 text-lt-slate-300'
                          }`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="p-3 text-lt-slate-400">{m.sailing_club || '---'} {m.sail_number ? `(${m.sail_number})` : ''}</td>
                        <td className="p-3 text-lt-emerald-400 font-bold">{m.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-lt-white">Organization Regulatory Audit Trail</h3>
                  <p className="text-xs text-lt-slate-400">Immutable chronological log of all sensitive race committee and billing events.</p>
                </div>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-8 text-center border border-ll-slate-800 rounded-xl bg-lb-slate-950/40">
                  <FileText className="w-8 h-8 text-lt-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-lt-slate-400">No audit log entries recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg border border-ll-slate-800/80 bg-lb-slate-950/50 flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-lt-cyan-300">{log.action}</span>
                          {log.roomCode && (
                            <span className="font-mono px-1.5 py-0.2 rounded bg-lb-slate-800 text-xs text-lt-slate-400">
                              #{log.roomCode}
                            </span>
                          )}
                          <span className="text-xs font-mono px-1.5 py-0.2 rounded bg-lb-slate-800 text-lt-slate-400 flex items-center gap-1">
                            {log.platform === 'ANDROID' ? <Smartphone className="w-3 h-3 text-lt-emerald-400" /> : <Globe className="w-3 h-3 text-lt-cyan-400" />}
                            {log.platform}
                          </span>
                        </div>
                        <p className="text-lt-slate-400 text-xs">
                          By {log.userEmail || log.userId || 'System'} ({log.userRole})
                        </p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <pre className="mt-1.5 p-2 rounded bg-lb-slate-900 border border-ll-slate-800 text-xs text-lt-slate-300 font-mono overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                      <span className="text-xs font-mono text-lt-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showUpgradeModal && (
        <SubscriptionUpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentTier={currentTier}
          onSuccess={refreshData}
        />
      )}
    </div>
  );
};
