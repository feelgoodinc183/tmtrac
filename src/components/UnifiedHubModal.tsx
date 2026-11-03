import React, { useState } from 'react';
import {
  X,
  Navigation,
  Compass,
  Zap,
  Radio,
  Trophy,
  Route,
  Layers,
  ShieldAlert,
  Bot,
  RotateCcw,
  Database,
  Sun,
  Volume2,
  VolumeX,
  User,
  LogIn,
  QrCode,
  Link2,
  Bluetooth,
  Globe,
  Info,
  CheckCircle2,
  Play,
  Square,
  AlertTriangle,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sparkles,
  BarChart2,
  Signal,
  Battery,
  ShieldCheck,
  Lock,
  Building2,
} from 'lucide-react';
import {
  Boat,
  MeshtasticNode,
  RaceClassDefinition,
  RaceState,
  CourseMark,
  DeviceGpsState,
  UserAccount,
  CompletedRace,
} from '../types/regatta';
import { formatTime, safeFixed } from '../utils/formatters';
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
  onOpenSkipperCheckIn?: () => void;
  onOpenBoatQr?: () => void;
  onOpenNodeBinding?: () => void;
  onOpenHardwareScan?: () => void;
  onOpenBoatEditor?: (boat?: Boat) => void;
  onSelectBoat?: (id: string) => void;
  onOpenHeadToHead?: () => void;
  // Race Props
  raceState: RaceState;
  raceClasses: RaceClassDefinition[];
  marks: CourseMark[];
  viewMode: 'RC_CONSOLE' | 'SPECTATOR';
  onStartSequence?: (minutes?: number) => void;
  onStopSequence?: () => void;
  onPostpone?: () => void;
  onGeneralRecall?: () => void;
  onAbandon?: () => void;
  onSelectClass?: (clsName: string) => void;
  onOpenCourseProfiles?: () => void;
  onOpenClassManager?: () => void;
  onOpenVhfJuryModal?: () => void;
  onOpenChat?: () => void;
  // Results Props
  onOpenResults?: () => void;
  showReplayBar?: boolean;
  onToggleReplayBar?: () => void;
  seriesRaces?: CompletedRace[];
  // System Props
  activeRoomCode: string;
  connectedPeerCount: number;
  onOpenLobby?: () => void;
  onOpenSpectatorQr?: () => void;
  onOpenNmeaMalaysiaModal?: () => void;
  onOpenOfflineCache?: () => void;
  onOpenMqttInspector?: () => void;
  directSunlightMode: boolean;
  onToggleSunlightMode: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  currentUser?: UserAccount | null;
  onOpenDashboard?: () => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
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
  onOpenSkipperCheckIn,
  onOpenBoatQr,
  onOpenNodeBinding,
  onOpenHardwareScan,
  onOpenBoatEditor,
  onSelectBoat,
  onOpenHeadToHead,
  raceState,
  raceClasses,
  marks,
  viewMode,
  onStartSequence,
  onStopSequence,
  onPostpone,
  onGeneralRecall,
  onAbandon,
  onSelectClass,
  onOpenCourseProfiles,
  onOpenClassManager,
  onOpenVhfJuryModal,
  onOpenChat,
  onOpenResults,
  showReplayBar,
  onToggleReplayBar,
  seriesRaces = [],
  activeRoomCode,
  connectedPeerCount,
  onOpenLobby,
  onOpenSpectatorQr,
  onOpenNmeaMalaysiaModal,
  onOpenOfflineCache,
  onOpenMqttInspector,
  directSunlightMode,
  onToggleSunlightMode,
  isMuted,
  onToggleMute,
  currentUser,
  onOpenDashboard,
  onOpenAuth,
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
      className="fixed inset-0 z-50 bg-lb-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        id="unified-hub-card"
        className={`w-full max-w-4xl h-[92vh] max-h-[820px] rounded-2xl flex flex-col overflow-hidden border shadow-2xl transition-all ${
          'bg-lb-0e131f text-lt-e8eaed border-ll-1e293b'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-ll-1e293b shrink-0 bg-lb-0a0f1a/80 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-lb-00d4ff/15 border border-ll-00d4ff/40 text-lt-00d4ff flex items-center justify-center shrink-0">
              <Compass className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2 className="text-sm sm:text-base font-bold font-google tracking-tight text-lt-white break-words leading-tight">
                  Control Hub
                </h2>
                <span className="text-xs font-mono font-bold text-lt-00d4ff bg-lb-00d4ff/10 px-2 py-0.5 rounded border border-ll-00d4ff/30 shrink-0">
                  #{activeRoomCode}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-lb-1e293b/70 text-lt-slate-300 text-xs font-mono shrink-0">
              <Zap className="w-3.5 h-3.5 text-lt-emerald-400 animate-pulse" />
              <span>{connectedPeerCount} Live Devices</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="group p-1.5 sm:p-2 rounded-lg text-lt-slate-400 hover:text-lt-white hover:bg-lb-1e293b active:scale-95 transition-all cursor-pointer shrink-0"
              title="Close Hub (Esc)"
              aria-label="Close Hub"
            >
              <X className="w-5 h-5 pointer-events-none transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* 4 Primary Segmented Hub Tabs */}
        <div className="flex items-center px-3 sm:px-6 py-2 border-b border-ll-1e293b bg-lb-0a0f1a/50 gap-1 sm:gap-2 shrink-0 overflow-x-auto custom-scrollbar">
          <button
            id="hub-tab-fleet"
            onClick={() => setActiveTab('FLEET')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'FLEET'
                ? 'bg-lb-00d4ff text-lt-black shadow-[0_0_12px_rgba(0,212,255,0.35)]'
                : 'bg-lb-1e293b/60 text-lt-slate-300 hover:text-lt-white hover:bg-lb-1e293b'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Fleet & Tracking</span>
            <span
              className={`text-xs px-1.5 py-0.2 rounded font-bold ${
                activeTab === 'FLEET' ? 'bg-lb-black/20 text-lt-black' : 'bg-lb-00d4ff/20 text-lt-00d4ff'
              }`}
            >
              {boats.length}
            </span>
          </button>

          <button
            id="hub-tab-race"
            onClick={() => setActiveTab('RACE')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'RACE'
                ? 'bg-lb-fbbc04 text-lt-black shadow-[0_0_12px_rgba(251,188,4,0.35)]'
                : 'bg-lb-1e293b/60 text-lt-slate-300 hover:text-lt-white hover:bg-lb-1e293b'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Race tools</span>
            <span
              className={`w-2 h-2 rounded-full ${
                raceState.status === 'RACING'
                  ? 'bg-lb-emerald-400 animate-pulse'
                  : raceState.startSequenceActive
                  ? 'bg-lb-amber-400 animate-pulse'
                  : 'bg-lb-slate-400'
              }`}
            />
          </button>

          <button
            id="hub-tab-system"
            onClick={() => setActiveTab('SYSTEM')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
              activeTab === 'SYSTEM'
                ? 'bg-lb-cyan-500 text-lt-black shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                : 'bg-lb-1e293b/60 text-lt-slate-300 hover:text-lt-white hover:bg-lb-1e293b'
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
                <div className="p-3 sm:p-4 rounded-xl bg-lb-121826 border border-ll-1e293b flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider text-lt-slate-400 font-bold">
                        Phone / Tablet GPS
                      </span>
                      <span
                        className={`text-xs font-mono font-bold px-1.5 py-0.2 rounded ${
                          deviceGps.active
                            ? 'bg-lb-emerald-500/20 text-lt-emerald-400 border border-ll-emerald-500/40'
                            : 'bg-lb-slate-800 text-lt-slate-400'
                        }`}
                      >
                        {deviceGps.active ? 'ACTIVE' : 'OFFLINE'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-lt-white mt-1">Device Tracker</h3>
                    <p className="text-xs text-lt-slate-400 mt-0.5 leading-snug">
                      {deviceGps.active
                        ? `${safeFixed(deviceGps.speedKt, 1, '0.0')} kt · ${deviceGps.headingDeg ?? 0}°`
                        : `${hybridTrackerCount} hybrid devices live`}
                    </p>
                  </div>
                  <button
                    onClick={onToggleDeviceGps}
                    className={`w-full py-2 px-3 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      deviceGps.active
                        ? 'bg-lb-rose-500/20 border border-ll-rose-500/50 text-lt-rose-300 hover:bg-lb-rose-500/30'
                        : 'bg-lb-1e293b hover:bg-lb-334155 text-lt-slate-200'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{deviceGps.active ? 'Stop Transmitting' : 'Start Device GPS'}</span>
                  </button>
                </div>

                {/* 3. Fleet QR Cards */}
                <div className="p-3 sm:p-4 rounded-xl bg-lb-121826 border border-ll-1e293b flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-lt-slate-400 font-bold">
                      Check-In Cards
                    </span>
                    <h3 className="text-sm font-bold text-lt-white mt-1">Boat QRs</h3>
                    <p className="text-xs text-lt-slate-400 mt-0.5 leading-snug">
                      Printable 1-tap QR cards for regatta registration
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenBoatQr?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-lb-1e293b hover:bg-lb-334155 text-lt-slate-200 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-lt-cyan-400" />
                    <span>Generate & Print QRs</span>
                  </button>
                </div>

                {/* 4. LoRa & BLE Hardware */}
                <div className="p-3 sm:p-4 rounded-xl bg-lb-121826 border border-ll-1e293b flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider text-lt-slate-400 font-bold">
                        Hardware Mesh
                      </span>
                      <span className="text-xs font-mono text-lt-00d4ff font-bold">
                        {nodes.length} Nodes
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-lt-white mt-1">LoRa / BLE Mesh</h3>
                    <p className="text-xs text-lt-slate-400 mt-0.5 leading-snug">
                      Meshtastic radio binding & Bluetooth scanner
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        onClose();
                        onOpenNodeBinding?.();
                      }}
                      className="flex-1 py-2 px-2 rounded-lg bg-lb-1e293b hover:bg-lb-334155 text-lt-slate-200 font-mono font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Bind Meshtastic nodes to boats"
                    >
                      <Link2 className="w-3 h-3 text-lt-00d4ff" />
                      <span>Bind</span>
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenHardwareScan?.();
                      }}
                      className="flex-1 py-2 px-2 rounded-lg bg-lb-1e293b hover:bg-lb-334155 text-lt-slate-200 font-mono font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Scan Bluetooth / USB ports"
                    >
                      <Bluetooth className="w-3 h-3 text-lt-cyan-400" />
                      <span>BLE</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Head-to-Head Comparison Button (if available) */}
              {onOpenHeadToHead && boats.length >= 2 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-lb-121826 border border-ll-1e293b">
                  <div className="flex items-center gap-2.5">
                    <BarChart2 className="w-4 h-4 text-lt-00d4ff" />
                    <div>
                      <span className="text-xs font-bold text-lt-white font-mono">Head-to-Head Telemetry Analysis</span>
                      <p className="text-xs text-lt-slate-400">Compare VMG, speeds, heading and tactical delta side-by-side</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenHeadToHead();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-lb-00d4ff/20 hover:bg-lb-00d4ff/30 border border-ll-00d4ff/50 text-lt-00d4ff font-mono text-xs font-bold transition-all cursor-pointer"
                  >
                    Compare Boats
                  </button>
                </div>
              )}

              {/* Active Fleet List Table */}
              <div className="rounded-xl border border-ll-1e293b bg-lb-0a0f1a/70 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-ll-1e293b bg-lb-121826/70">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono uppercase tracking-wider text-lt-slate-200">
                      Fleet Registry ({boats.length} Vessels)
                    </span>
                  </div>
                  {viewMode !== 'SPECTATOR' && onOpenBoatEditor && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenBoatEditor();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-lb-00d4ff hover:bg-lb-00d4ff/90 text-lt-black text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>Add boat</span>
                    </button>
                  )}
                </div>

                {boats.length === 0 ? (
                  <div className="p-8 text-center text-lt-slate-400 font-mono text-xs">
                    No boats registered yet. Use "Add boat", or skippers can join themselves with Track in the header.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-lb-121826/50 text-lt-slate-400 border-b border-ll-1e293b text-xs">
                        <tr>
                          <th className="px-3 py-2">Vessel</th>
                          <th className="px-3 py-2">Class</th>
                          <th className="px-3 py-2">Handicap (1.000 Default)</th>
                          <th className="px-3 py-2">Live Speed</th>
                          <th className="px-3 py-2">Telemetry</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ll-1e293b">
                        {boats.map((boat) => {
                          const boundNode = nodes.find((n) => n.id === boat.nodeId);
                          return (
                            <tr key={boat.id} className="hover:bg-lb-1e293b/40 transition-colors">
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: boat.color || '#00D4FF' }}
                                  />
                                  <div>
                                    <div className="font-bold text-lt-white flex items-center gap-1.5">
                                      <span>{boat.name}</span>
                                      <span className="text-lt-slate-400 text-xs">#{boat.sailNumber}</span>
                                    </div>
                                    <div className="text-xs text-lt-slate-400">
                                      {boat.skipper || 'Skipper Unassigned'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-lt-slate-300">
                                {boat.raceClass || 'Class 1'}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="font-bold text-lt-00d4ff">
                                  {boat.handicapSystem || 'IRC'} {safeFixed(boat.handicapRating, 3, '1.000')}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="font-bold text-lt-white">
                                  {safeFixed(boat.speedKt ?? boat.sog, 1, '0.0')} kt
                                </span>
                                <span className="text-xs text-lt-slate-400 ml-1">
                                  {safeFixed(boat.headingDeg ?? boat.heading ?? boat.cog, 0, '0')}°
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                {boundNode ? (
                                  <span className="text-xs text-lt-emerald-400 flex items-center gap-1">
                                    <Signal className="w-3 h-3" />
                                    <span>LoRa {boundNode.snr != null ? `${safeFixed(boundNode.snr, 1)}dB` : 'Active'}</span>
                                  </span>
                                ) : boat.nodeId ? (
                                  <span className="text-xs text-lt-cyan-300">GPS Mesh</span>
                                ) : (
                                  <span className="text-xs text-lt-slate-500">Sim / Unbound</span>
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
                                      className="px-2 py-1 rounded bg-lb-1e293b hover:bg-lb-334155 text-lt-00d4ff text-xs font-bold"
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
                                      className="px-2 py-1 rounded bg-lb-1e293b hover:bg-lb-334155 text-lt-slate-300 hover:text-lt-white text-xs font-bold"
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
                <div className="p-3 sm:p-4 rounded-xl bg-lb-121826 border border-ll-1e293b flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-lt-purple-400 font-bold">
                      Jury & Bulletins
                    </span>
                    <h3 className="text-sm font-bold text-lt-white mt-1">VHF & Protests</h3>
                    <p className="text-xs text-lt-slate-400 mt-0.5 leading-snug">
                      VHF radio bulletins, jury notices & protest hearings
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenVhfJuryModal?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-lb-1e293b hover:bg-lb-334155 text-lt-purple-300 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>VHF / Jury Console</span>
                  </button>
                </div>

                {/* 4. AI Race Tactician */}
                <div className="p-3 sm:p-4 rounded-xl bg-lb-121826 border border-ll-1e293b flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-lt-blue-400 font-bold">
                      Tactical Intelligence
                    </span>
                    <h3 className="text-sm font-bold text-lt-white mt-1">AI Tactician</h3>
                    <p className="text-xs text-lt-slate-400 mt-0.5 leading-snug">
                      AI race strategist, wind oscillation & layline analysis
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenChat?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-lb-blue-600/20 hover:bg-lb-blue-600/30 border border-ll-blue-500/40 text-lt-blue-300 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
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
                <div className="p-4 rounded-xl bg-lb-121826 border border-ll-cyan-500/30 hover:border-ll-cyan-400/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-lb-cyan-500/15 border border-ll-cyan-500/30 text-lt-cyan-400 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono uppercase tracking-wider text-lt-cyan-400 font-bold">
                          Club / Organization Tenant
                        </span>
                        <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-lb-cyan-500/20 text-lt-cyan-300 uppercase font-mono border border-ll-cyan-500/30">
                          {planTier || 'FREE'} PLAN
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-lt-white mt-0.5 truncate">
                        {tenantName || 'Royal Langkawi Yacht Club (RLYC)'}
                      </h3>
                      <p className="text-xs text-lt-slate-400 mt-0.5">
                        Manage club regattas, members, officer seats, audit logs & subscription tier
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenTenantDashboard();
                    }}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-lb-cyan-600 hover:bg-lb-cyan-500 text-lt-white font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-ll-cyan-600/20 shrink-0"
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
                <div className="p-3 sm:p-4 rounded-xl bg-lb-121826 border border-ll-1e293b flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono text-lt-00ff9d font-bold uppercase tracking-wider block mb-1">
                      Mesh diagnostics
                    </span>
                    <h3 className="text-sm font-bold text-lt-white">Packet inspector</h3>
                    <p className="text-xs text-lt-slate-400 mt-1">Live MQTT and LoRa packets from the mesh</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenMqttInspector?.();
                    }}
                    className="w-full py-2 rounded-lg bg-lb-1e293b hover:bg-lb-334155 text-lt-slate-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    Open inspector
                  </button>
                </div>

                {/* 2. Spectator QR */}
                <div className="p-3 sm:p-4 rounded-xl bg-lb-121826 border border-ll-1e293b flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-lt-cyan-400 font-bold">
                      Spectator Invite
                    </span>
                    <h3 className="text-sm font-bold text-lt-white mt-1">Spectator QR</h3>
                    <p className="text-xs text-lt-slate-400 mt-0.5 leading-snug">
                      QR code & shareable link for live regatta viewing
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenSpectatorQr?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-lb-1e293b hover:bg-lb-334155 text-lt-slate-200 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-lt-cyan-400" />
                    <span>Share QR Link</span>
                  </button>
                </div>

                {/* 3. Malaysia LoRa & NMEA */}
                <div className="p-3 sm:p-4 rounded-xl bg-lb-121826 border border-ll-1e293b flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono uppercase tracking-wider text-lt-emerald-400 font-bold">
                      Marine Telemetry
                    </span>
                    <h3 className="text-sm font-bold text-lt-white mt-1">Malaysia LoRa & NMEA</h3>
                    <p className="text-xs text-lt-slate-400 mt-0.5 leading-snug">
                      433/919 MHz presets, NMEA 0183/2000 gateway & MQTT
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenNmeaMalaysiaModal?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-lb-1e293b hover:bg-lb-334155 text-lt-slate-200 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5 text-lt-emerald-400" />
                    <span>NMEA & Mesh Setup</span>
                  </button>
                </div>

                {/* 4. SQLite Offline DB */}
                <div className="p-3 sm:p-4 rounded-xl bg-lb-121826 border border-ll-1e293b flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider text-lt-slate-400 font-bold">
                        Offline Cache
                      </span>
                      <span className="text-xs font-mono text-lt-emerald-400 font-bold">
                        {raceState.syncProgress}%
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-lt-white mt-1">SQLite Database</h3>
                    <p className="text-xs text-lt-slate-400 mt-0.5 leading-snug">
                      Local SQLite caching & zero-loss cloud synchronization
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenOfflineCache?.();
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-lb-1e293b hover:bg-lb-334155 text-lt-slate-200 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-lt-00d4ff" />
                    <span>Cache & Buffer</span>
                  </button>
                </div>
              </div>

              {/* Hardware Toggles & Settings Bar */}
              <div className="p-4 rounded-xl bg-lb-121826 border border-ll-1e293b space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* About Tom Manas Technologies */}
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAbout?.();
                    }}
                    className="p-3 rounded-xl border border-ll-334155 bg-lb-1e293b/70 hover:bg-lb-283548 text-lt-slate-300 hover:text-lt-white flex items-center gap-3 transition-all cursor-pointer"
                  >
                    <Info className="w-5 h-5 shrink-0 text-lt-00d4ff" />
                    <div className="text-left">
                      <div className="text-xs font-bold font-mono">About TMTRAC</div>
                      <div className="text-xs text-lt-slate-400">Tom Manas Technologies</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 sm:px-6 py-2 border-t border-ll-1e293b bg-lb-0a0f1a/80 flex items-center justify-between text-xs font-mono text-lt-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span>TMTRAC v{APP_VERSION}</span>
            <span>·</span>
            <span>Handicap Default: 1.000</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-lb-1e293b hover:bg-lb-334155 text-lt-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
