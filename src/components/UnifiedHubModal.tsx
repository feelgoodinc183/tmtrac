import React, { useState } from 'react';
import {
  X,
  Navigation,
  Compass,
  Zap,
  Radio,
  ShieldAlert,
  Bot,
  Database,
  QrCode,
  Link2,
  Bluetooth,
  Globe,
  Info,
  Clock,
  BarChart2,
  Signal,
  Building2,
} from 'lucide-react';
import {
  Boat,
  MeshtasticNode,
  RaceState,
  DeviceGpsState,
} from '../types/regatta';
import { safeFixed } from '../utils/formatters';
import { APP_VERSION } from '../appVersion';

export type HubTab = 'FLEET' | 'RACE' | 'RESULTS' | 'SYSTEM';

export interface UnifiedHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialHub?: HubTab;
  // Fleet Props
  boats: Boat[];
  nodes: MeshtasticNode[];
  deviceGps: DeviceGpsState;
  onToggleDeviceGps: () => void;
  hybridTrackerCount: number;
  onOpenBoatQr?: () => void;
  onOpenNodeBinding?: () => void;
  onOpenHardwareScan?: () => void;
  onOpenBoatEditor?: (boat?: Boat) => void;
  onSelectBoat?: (id: string) => void;
  onOpenHeadToHead?: () => void;
  // Race Props
  raceState: RaceState;
  viewMode: 'RC_CONSOLE' | 'SPECTATOR';
  onOpenVhfJuryModal?: () => void;
  onOpenChat?: () => void;
  // Results Props
  // System Props
  activeRoomCode: string;
  connectedPeerCount: number;
  onOpenSpectatorQr?: () => void;
  onOpenNmeaMalaysiaModal?: () => void;
  onOpenOfflineCache?: () => void;
  onOpenMqttInspector?: () => void;
  onOpenAbout?: () => void;
  onOpenTenantDashboard?: () => void;
  tenantName?: string;
  planTier?: string;
}

export const UnifiedHubModal: React.FC<UnifiedHubModalProps> = ({
  isOpen,
  onClose,
  initialHub = 'FLEET',
  boats,
  nodes,
  deviceGps,
  onToggleDeviceGps,
  hybridTrackerCount,
  onOpenBoatQr,
  onOpenNodeBinding,
  onOpenHardwareScan,
  onOpenBoatEditor,
  onSelectBoat,
  onOpenHeadToHead,
  raceState,
  viewMode,
  onOpenVhfJuryModal,
  onOpenChat,
  activeRoomCode,
  connectedPeerCount,
  onOpenSpectatorQr,
  onOpenNmeaMalaysiaModal,
  onOpenOfflineCache,
  onOpenMqttInspector,
  onOpenAbout,
  onOpenTenantDashboard,
  tenantName,
  planTier,
}) => {
  // Results moved out of the hub (race console / sidebar); old callers land on Fleet
  const normalizeTab = (t: HubTab): HubTab => (t === 'RESULTS' ? 'FLEET' : t);
  const [activeTab, setActiveTab] = useState<HubTab>(normalizeTab(initialHub as HubTab));

  // Sync initialHub when modal opens
  React.useEffect(() => {
    if (isOpen && initialHub) {
      setActiveTab(normalizeTab(initialHub as HubTab));
    }
  }, [isOpen, initialHub]);

  if (!isOpen) return null;

  return (
    <div
      id="unified-hub-backdrop"
      className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        id="unified-hub-card"
        className={`w-full max-w-4xl h-[92vh] max-h-[820px] rounded-2xl flex flex-col overflow-hidden border shadow-2xl transition-all ${
          'bg-surface text-ink border-line'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-line shrink-0 bg-canvas/80 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent/15 border border-accent/40 text-accent flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-ink break-words leading-tight">
                  Control Hub
                </h2>
                <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/30 shrink-0">
                  #{activeRoomCode}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-raised/70 text-ink text-xs shrink-0">
              <Zap className="w-3.5 h-3.5 text-success-ink" />
              <span>{connectedPeerCount} Live Devices</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="group p-1.5 sm:p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-raised active:scale-95 transition-all cursor-pointer shrink-0"
              title="Close Hub (Esc)"
              aria-label="Close Hub"
            >
              <X className="w-5 h-5 pointer-events-none transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* Hub tabs */}
        <div className="flex items-center px-3 sm:px-6 py-2 border-b border-line bg-canvas/50 gap-1 sm:gap-2 shrink-0 overflow-x-auto custom-scrollbar">
          <button
            id="hub-tab-fleet"
            role="tab"
            aria-selected={activeTab === 'FLEET'}
            onClick={() => setActiveTab('FLEET')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs  font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'FLEET'
                ? 'bg-accent text-on-accent '
                : 'bg-raised/60 text-ink hover:text-ink hover:bg-raised'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Fleet & Tracking</span>
            <span
              className={`text-xs px-1.5 py-0.2 rounded font-bold ${
                activeTab === 'FLEET' ? 'bg-on-accent/20 text-on-accent' : 'bg-accent/20 text-accent'
              }`}
            >
              {boats.length}
            </span>
          </button>

          <button
            id="hub-tab-race"
            role="tab"
            aria-selected={activeTab === 'RACE'}
            onClick={() => setActiveTab('RACE')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs  font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'RACE'
                ? 'bg-accent text-on-accent '
                : 'bg-raised/60 text-ink hover:text-ink hover:bg-raised'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Race tools</span>
            <span
              className={`w-2 h-2 rounded-full ${
                raceState.status === 'RACING'
                  ? 'bg-success-ink '
                  : raceState.startSequenceActive
                  ? 'bg-warning-ink '
                  : 'bg-ink'
              }`}
            />
          </button>

          <button
            id="hub-tab-system"
            role="tab"
            aria-selected={activeTab === 'SYSTEM'}
            onClick={() => setActiveTab('SYSTEM')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs  font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'SYSTEM'
                ? 'bg-accent text-on-accent '
                : 'bg-raised/60 text-ink hover:text-ink hover:bg-raised'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>System & Settings</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 custom-scrollbar space-y-5">
          {/* ========================================================
              HUB 1: FLEET & TRACKING
             ======================================================== */}
          {activeTab === 'FLEET' && (
            <div className="space-y-5 animate-fade-in">
              {/* Top Quick Action Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {/* 2. Device GPS Broadcast */}
                <div className="p-3 sm:p-4 rounded-xl bg-surface border border-line flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-muted font-bold">
                        Phone / Tablet GPS
                      </span>
                      <span
                        className={`text-xs  font-bold px-1.5 py-0.2 rounded ${
                          deviceGps.active
                            ? 'bg-success-ink/20 text-success-ink border border-success-ink/40'
                            : 'bg-raised text-ink-muted'
                        }`}
                      >
                        {deviceGps.active ? 'ACTIVE' : 'OFFLINE'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-ink mt-1">Device Tracker</h3>
                    <p className="text-xs text-ink-muted mt-0.5 leading-snug">
                      {deviceGps.active
                        ? `${safeFixed(deviceGps.speedKt, 1, '0.0')} kt · ${deviceGps.headingDeg ?? 0}°`
                        : `${hybridTrackerCount} hybrid devices live`}
                    </p>
                  </div>
                  <button
                    onClick={onToggleDeviceGps}
                    className={`w-full py-2 px-3 rounded-lg  font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      deviceGps.active
                        ? 'bg-danger/20 border border-danger-ink/50 text-danger-ink hover:bg-danger/30'
                        : 'bg-raised hover:bg-raised text-ink'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{deviceGps.active ? 'Stop Transmitting' : 'Start Device GPS'}</span>
                  </button>
                </div>

                {/* 3. Fleet QR Cards */}
                <div className="p-3 sm:p-4 rounded-xl bg-surface border border-line flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs text-ink-muted font-bold">
                      Check-In Cards
                    </span>
                    <h3 className="text-sm font-bold text-ink mt-1">Boat QRs</h3>
                    <p className="text-xs text-ink-muted mt-0.5 leading-snug">
                      Printable 1-tap QR cards for regatta registration
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenBoatQr?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-raised hover:bg-raised text-ink font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-accent" />
                    <span>Generate & Print QRs</span>
                  </button>
                </div>

                {/* 4. LoRa & BLE Hardware */}
                <div className="p-3 sm:p-4 rounded-xl bg-surface border border-line flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-muted font-bold">
                        Hardware Mesh
                      </span>
                      <span className="text-xs text-accent font-bold">
                        {nodes.length} Nodes
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-ink mt-1">LoRa / BLE Mesh</h3>
                    <p className="text-xs text-ink-muted mt-0.5 leading-snug">
                      Meshtastic radio binding & Bluetooth scanner
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        onClose();
                        onOpenNodeBinding?.();
                      }}
                      className="flex-1 py-2 px-2 rounded-lg bg-raised hover:bg-raised text-ink font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Bind Meshtastic nodes to boats"
                    >
                      <Link2 className="w-3 h-3 text-accent" />
                      <span>Bind</span>
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenHardwareScan?.();
                      }}
                      className="flex-1 py-2 px-2 rounded-lg bg-raised hover:bg-raised text-ink font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Scan Bluetooth / USB ports"
                    >
                      <Bluetooth className="w-3 h-3 text-accent" />
                      <span>BLE</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Head-to-Head Comparison Button (if available) */}
              {onOpenHeadToHead && boats.length >= 2 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-line">
                  <div className="flex items-center gap-2.5">
                    <BarChart2 className="w-4 h-4 text-accent" />
                    <div>
                      <span className="text-xs font-bold text-ink">Head-to-Head Telemetry Analysis</span>
                      <p className="text-xs text-ink-muted">Compare VMG, speeds, heading and tactical delta side-by-side</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenHeadToHead();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 border border-accent/50 text-accent text-xs font-bold transition-all cursor-pointer"
                  >
                    Compare Boats
                  </button>
                </div>
              )}

              {/* Active Fleet List Table */}
              <div className="rounded-xl border border-line bg-canvas/70 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface/70">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink">
                      Fleet Registry ({boats.length} Vessels)
                    </span>
                  </div>
                  {viewMode !== 'SPECTATOR' && onOpenBoatEditor && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenBoatEditor();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-accent hover:bg-accent/90 text-on-accent text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>Add boat</span>
                    </button>
                  )}
                </div>

                {boats.length === 0 ? (
                  <div className="p-8 text-center text-ink-muted text-xs">
                    No boats registered yet. Use "Add boat", or skippers can join themselves with Track in the header.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface/50 text-ink-muted border-b border-line text-xs">
                        <tr>
                          <th className="px-3 py-2">Vessel</th>
                          <th className="px-3 py-2">Class</th>
                          <th className="px-3 py-2">Handicap (1.000 Default)</th>
                          <th className="px-3 py-2">Live Speed</th>
                          <th className="px-3 py-2">Telemetry</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {boats.map((boat) => {
                          const boundNode = nodes.find((n) => n.id === boat.nodeId);
                          return (
                            <tr key={boat.id} className="hover:bg-raised/40 transition-colors">
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: boat.color || '#00D4FF' }}
                                  />
                                  <div>
                                    <div className="font-bold text-ink flex items-center gap-1.5">
                                      <span>{boat.name}</span>
                                      <span className="text-ink-muted text-xs">#{boat.sailNumber}</span>
                                    </div>
                                    <div className="text-xs text-ink-muted">
                                      {boat.skipper || 'Skipper Unassigned'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-ink">
                                {boat.class}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="font-bold text-accent">
                                  {boat.handicapSystem || 'IRC'} {safeFixed(boat.handicapRating, 3, '1.000')}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="font-bold text-ink">
                                  {safeFixed(boat.speedKt ?? boat.sog, 1, '0.0')} kt
                                </span>
                                <span className="text-xs text-ink-muted ml-1">
                                  {safeFixed(boat.headingDeg ?? boat.heading ?? boat.cog, 0, '0')}°
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                {boundNode ? (
                                  <span className="text-xs text-success-ink flex items-center gap-1">
                                    <Signal className="w-3 h-3" />
                                    <span>LoRa {boundNode.snr != null ? `${safeFixed(boundNode.snr, 1)}dB` : 'Active'}</span>
                                  </span>
                                ) : boat.nodeId ? (
                                  <span className="text-xs text-accent">GPS Mesh</span>
                                ) : (
                                  <span className="text-xs text-ink-muted">No tracker</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {onSelectBoat && (
                                    <button
                                      onClick={() => {
                                        onClose();
                                        onSelectBoat(boat.id);
                                      }}
                                      className="px-2 py-1 rounded bg-raised hover:bg-raised text-accent text-xs font-bold"
                                    >
                                      Locate
                                    </button>
                                  )}
                                  {viewMode !== 'SPECTATOR' && onOpenBoatEditor && (
                                    <button
                                      onClick={() => {
                                        onClose();
                                        onOpenBoatEditor(boat);
                                      }}
                                      className="px-2 py-1 rounded bg-raised hover:bg-raised text-ink hover:text-ink text-xs font-bold"
                                    >
                                      Edit
                                    </button>
                                  )}
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
            </div>
          )}

          {/* ========================================================
              HUB 2: RACE & COURSE
             ======================================================== */}
          {activeTab === 'RACE' && (
            <div className="space-y-5 animate-fade-in">
              {/* Race Tools Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 3. VHF Radio & Jury Protests */}
                <div className="p-3 sm:p-4 rounded-xl bg-surface border border-line flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs text-ink-muted font-bold">
                      Jury & Bulletins
                    </span>
                    <h3 className="text-sm font-bold text-ink mt-1">VHF & Protests</h3>
                    <p className="text-xs text-ink-muted mt-0.5 leading-snug">
                      VHF radio bulletins, jury notices & protest hearings
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenVhfJuryModal?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-raised hover:bg-raised text-ink font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>VHF / Jury Console</span>
                  </button>
                </div>

                {/* 4. AI Race Tactician */}
                <div className="p-3 sm:p-4 rounded-xl bg-surface border border-line flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs text-accent font-bold">
                      Tactical Intelligence
                    </span>
                    <h3 className="text-sm font-bold text-ink mt-1">AI Tactician</h3>
                    <p className="text-xs text-ink-muted mt-0.5 leading-snug">
                      AI race strategist, wind oscillation & layline analysis
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenChat?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-accent/20 hover:bg-accent/30 border border-accent/40 text-accent font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>Open AI Tactician</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              HUB 4: SYSTEM & CONNECTIVITY
             ======================================================== */}
          {activeTab === 'SYSTEM' && (
            <div className="space-y-5 animate-fade-in">
              {/* Organization & Club Tenant Settings (Moved from Header into System Settings) */}
              {onOpenTenantDashboard && (
                <div className="p-4 rounded-xl bg-surface border border-accent/30 hover:border-accent/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-accent font-bold">
                          Club / Organization Tenant
                        </span>
                        <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-accent/20 text-accent border border-accent/30">
                          {planTier || 'FREE'} PLAN
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-ink mt-0.5 truncate">
                        {tenantName || 'Royal Langkawi Yacht Club (RLYC)'}
                      </h3>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Manage club regattas, members, officer seats, audit logs & subscription tier
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenTenantDashboard();
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-accent hover:brightness-110 text-on-accent font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                    title="Open Organization & Plan Manager"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Open Club Dashboard</span>
                  </button>
                </div>
              )}

              {/* Multi-Tenant & Sharing Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. MQTT packet inspector (was only reachable from the status bar) */}
                <div className="p-3 sm:p-4 rounded-xl bg-surface border border-line flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs text-success-ink font-bold block mb-1">
                      Mesh diagnostics
                    </span>
                    <h3 className="text-sm font-bold text-ink">Packet inspector</h3>
                    <p className="text-xs text-ink-muted mt-1">Live MQTT and LoRa packets from the mesh</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenMqttInspector?.();
                    }}
                    className="w-full py-2 rounded-lg bg-raised hover:bg-raised text-ink text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    Open inspector
                  </button>
                </div>

                {/* 2. Spectator QR */}
                <div className="p-3 sm:p-4 rounded-xl bg-surface border border-line flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs text-accent font-bold">
                      Spectator Invite
                    </span>
                    <h3 className="text-sm font-bold text-ink mt-1">Spectator QR</h3>
                    <p className="text-xs text-ink-muted mt-0.5 leading-snug">
                      QR code & shareable link for live regatta viewing
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenSpectatorQr?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-raised hover:bg-raised text-ink font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-accent" />
                    <span>Share QR Link</span>
                  </button>
                </div>

                {/* 3. Malaysia LoRa & NMEA */}
                <div className="p-3 sm:p-4 rounded-xl bg-surface border border-line flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs text-success-ink font-bold">
                      Marine Telemetry
                    </span>
                    <h3 className="text-sm font-bold text-ink mt-1">Malaysia LoRa & NMEA</h3>
                    <p className="text-xs text-ink-muted mt-0.5 leading-snug">
                      433/919 MHz presets, NMEA 0183/2000 gateway & MQTT
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenNmeaMalaysiaModal?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-raised hover:bg-raised text-ink font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5 text-success-ink" />
                    <span>NMEA & Mesh Setup</span>
                  </button>
                </div>

                {/* 4. SQLite Offline DB */}
                <div className="p-3 sm:p-4 rounded-xl bg-surface border border-line flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-muted font-bold">
                        Offline Cache
                      </span>
                      <span className="text-xs text-success-ink font-bold">
                        {raceState.syncProgress}%
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-ink mt-1">SQLite Database</h3>
                    <p className="text-xs text-ink-muted mt-0.5 leading-snug">
                      Local SQLite caching & zero-loss cloud synchronization
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenOfflineCache?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-raised hover:bg-raised text-ink font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-accent" />
                    <span>Cache & Buffer</span>
                  </button>
                </div>
              </div>

              {/* Hardware Toggles & Settings Bar */}
              <div className="p-4 rounded-xl bg-surface border border-line space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* About Tom Manas Technologies */}
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAbout?.();
                    }}
                    className="p-3 rounded-xl border border-line bg-raised/70 hover:bg-raised text-ink hover:text-ink flex items-center gap-3 transition-all cursor-pointer"
                  >
                    <Info className="w-5 h-5 shrink-0 text-accent" />
                    <div className="text-left">
                      <div className="text-xs font-bold">About TMTRAC</div>
                      <div className="text-xs text-ink-muted">Tom Manas Technologies</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 sm:px-6 py-2 border-t border-line bg-canvas/80 flex items-center justify-between text-xs text-ink-muted shrink-0">
          <div className="flex items-center gap-2">
            <span>TMTRAC v{APP_VERSION}</span>
            <span>·</span>
            <span>Handicap Default: 1.000</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-raised hover:bg-raised text-ink text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
