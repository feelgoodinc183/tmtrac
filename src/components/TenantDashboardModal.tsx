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
  Smartphone,
  Globe,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/85 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-line/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-ink">
        {/* Top Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-surface via-surface to-surface border-b border-line flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-ink">
                  {tenant?.name || 'Organization Dashboard'}
                </h2>
                <span className={`text-xs  px-2 py-0.5 rounded font-bold  border ${
                  currentTier === 'EVENT_PRO'
                    ? 'bg-warning-ink/20 text-warning-ink border-warning-ink/40'
                    : currentTier === 'CLUB'
                    ? 'bg-accent/20 text-accent border-accent/40'
                    : 'bg-raised text-ink border-line'
                }`}>
                  {currentTier} Plan
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Tenant ID: {tenant?.id || 'tenant-default'} · Slug: {tenant?.slug || 'rlyc'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              disabled={loading}
              className="p-1.5 text-ink-muted hover:text-ink rounded-lg hover:bg-raised transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-ink-muted hover:text-ink rounded-lg hover:bg-raised transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Plan Quota Banner */}
        <div className="px-6 py-3.5 bg-canvas/70 border-b border-line flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-ink-muted">Active Regattas:</span>{' '}
              <span className={` font-bold ${isRoomLimitReached ? 'text-warning-ink' : 'text-ink'}`}>
                {roomsUsed} / {limits.maxActiveRooms}
              </span>
            </div>
            <div>
              <span className="text-ink-muted">Fleet Limit:</span>{' '}
              <span className="font-bold text-ink">{limits.maxBoatsPerRoom} boats</span>
            </div>
            <div>
              <span className="text-ink-muted">Admin Seats:</span>{' '}
              <span className="font-bold text-ink">{members.filter(m => m.role === 'ADMIN').length} / {limits.maxAdminSeats}</span>
            </div>
          </div>

          <button
            onClick={() => setShowUpgradeModal(true)}
            className="py-1 px-3 rounded-lg bg-gradient-to-r from-accent to-accent hover:from-accent hover:to-accent text-ink text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5" />
            Manage Subscription
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-line flex gap-2 pt-2 bg-surface/50">
          <button
            onClick={() => setActiveTab('events')}
            className={`py-2 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'events'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Events ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-2 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'members'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Team Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'border-accent text-accent font-bold'
                : 'border-transparent text-ink-muted hover:text-ink'
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
                  <h3 className="text-sm font-bold text-ink">Organization Regattas</h3>
                  <p className="text-xs text-ink-muted">Events hosted and managed by this organization.</p>
                </div>
                <button
                  onClick={() => {
                    if (isRoomLimitReached) {
                      setShowUpgradeModal(true);
                    } else {
                      onCreateEvent?.();
                    }
                  }}
                  className={`py-1.5 px-3 rounded-lg text-xs  font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isRoomLimitReached
                      ? 'bg-warning-ink/80 hover:brightness-110 text-canvas font-bold'
                      : 'bg-accent hover:brightness-110 text-on-accent font-bold'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isRoomLimitReached ? 'Plan Limit Reached (Upgrade)' : 'Host New Event'}
                </button>
              </div>

              {events.length === 0 ? (
                <div className="p-8 text-center border border-line rounded-xl bg-canvas/40">
                  <Layers className="w-8 h-8 text-ink-muted mx-auto mb-2" />
                  <p className="text-xs text-ink-muted">No events found for this organization.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {events.map((ev) => (
                    <div
                      key={ev.code}
                      className="p-4 rounded-xl border border-line bg-canvas/40 hover:border-line transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-accent text-sm">#{ev.code}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-raised text-ink">
                            {ev.raceStatus}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-ink">{ev.title}</h4>
                        <p className="text-xs text-ink-muted mb-3">{ev.locationName}</p>

                        <div className="flex items-center gap-3 text-xs text-ink-muted mb-3">
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
                        className="w-full py-2 px-3 rounded-lg bg-raised hover:brightness-110 hover:text-ink text-ink text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
                  <h3 className="text-sm font-bold text-ink">Organization Team Members</h3>
                  <p className="text-xs text-ink-muted">Administrators, race officers, and assigned skippers.</p>
                </div>
              </div>

              <div className="border border-line rounded-xl overflow-hidden bg-canvas/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface border-b border-line text-ink-muted">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Club / Sail No</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-surface/60">
                        <td className="p-3 font-sans font-medium text-ink">{m.full_name}</td>
                        <td className="p-3 text-ink-muted">{m.email}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            m.role === 'ADMIN' ? 'bg-accent/20 text-accent' : 'bg-raised text-ink'
                          }`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="p-3 text-ink-muted">{m.sailing_club || '---'} {m.sail_number ? `(${m.sail_number})` : ''}</td>
                        <td className="p-3 text-success-ink font-bold">{m.status}</td>
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
                  <h3 className="text-sm font-bold text-ink">Organization Regulatory Audit Trail</h3>
                  <p className="text-xs text-ink-muted">Immutable chronological log of all sensitive race committee and billing events.</p>
                </div>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-8 text-center border border-line rounded-xl bg-canvas/40">
                  <FileText className="w-8 h-8 text-ink-muted mx-auto mb-2" />
                  <p className="text-xs text-ink-muted">No audit log entries recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg border border-line/80 bg-canvas/50 flex items-start justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-accent">{log.action}</span>
                          {log.roomCode && (
                            <span className="px-1.5 py-0.2 rounded bg-raised text-xs text-ink-muted">
                              #{log.roomCode}
                            </span>
                          )}
                          <span className="text-xs px-1.5 py-0.2 rounded bg-raised text-ink-muted flex items-center gap-1">
                            {log.platform === 'ANDROID' ? <Smartphone className="w-3 h-3 text-success-ink" /> : <Globe className="w-3 h-3 text-accent" />}
                            {log.platform}
                          </span>
                        </div>
                        <p className="text-ink-muted text-xs">
                          By {log.userEmail || log.userId || 'System'} ({log.userRole})
                        </p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <pre className="mt-1.5 p-2 rounded bg-surface border border-line text-xs text-ink overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                      <span className="text-xs text-ink-muted whitespace-nowrap">
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
