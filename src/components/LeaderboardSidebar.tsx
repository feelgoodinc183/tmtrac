import React, { useState, useMemo } from 'react';
import { Boat, MeshtasticNode, RaceClass, RaceClassDefinition, RaceState, DeviceGpsState } from '../types/regatta';
import {
  Sailboat,
  Trophy,
  Radio,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Cpu,
  Database,
  Crosshair,
  Eye,
  Bluetooth,
  Navigation,
  Wifi,
  Smartphone,
  Tablet,
  Laptop,
  Trash2,
  Sparkles,
  Plus,
  Edit2,
  Clock,
  Layers,
  Link2,
  PanelLeftClose,
  X,
  Gauge,
  Thermometer,
  Droplets,
  Wind,
  ArrowUpDown,
  SlidersHorizontal,
  Check,
  QrCode,
} from 'lucide-react';
import { formatLastHeard, safeFixed } from '../utils/formatters';
import { deduplicateNodes, isNodeWithin240Hours } from '../services/meshtasticBleMqttService';

interface LeaderboardSidebarProps {
  boats: Boat[];
  nodes: MeshtasticNode[];
  raceState: RaceState;
  selectedBoatId: string | null;
  onSelectBoat: (boatId: string) => void;
  onOpenNodeBinding?: (nodeId?: string, boatId?: string) => void;
  onOpenHardwareScan?: () => void;
  onOpenHybridTrackers?: () => void;
  followedTargetId: string | null;
  onToggleFollow: (id: string, name: string) => void;
  onOpenNodeInspector: (node: MeshtasticNode | null, boat: Boat | null) => void;
  deviceGps?: DeviceGpsState;
  onToggleDeviceGps?: () => void;
  onDeleteNode?: (nodeId: string) => void;
  onClearDemoNodes?: () => void;
  onOpenAddBoat?: () => void;
  onEditBoat?: (boat: Boat) => void;
  onDeleteBoat?: (boatId: string) => void;
  onClearDemoBoats?: () => void;
  onOpenBoatQr?: (boatId: string) => void;
  onOpenSkipperCheckIn?: (boatId?: string) => void;
  raceClasses?: RaceClassDefinition[];
  onOpenClassManager?: () => void;
  onOpenResults?: () => void;
  onEndRace?: (forClass?: string) => void;
  onCollapse?: () => void;
  viewMode?: 'RC_CONSOLE' | 'SPECTATOR';
  onClose?: () => void;
  isOverlay?: boolean;
  isAdmin?: boolean;
}

export const LeaderboardSidebar: React.FC<LeaderboardSidebarProps> = ({
  boats,
  nodes,
  raceState,
  selectedBoatId,
  onSelectBoat,
  onOpenNodeBinding,
  onOpenHardwareScan,
  onOpenHybridTrackers,
  followedTargetId,
  onToggleFollow,
  onOpenNodeInspector,
  deviceGps,
  onToggleDeviceGps,
  onDeleteNode,
  onClearDemoNodes,
  onOpenAddBoat,
  onEditBoat,
  onDeleteBoat,
  onClearDemoBoats,
  onOpenBoatQr,
  onOpenSkipperCheckIn,
  raceClasses = [],
  onOpenClassManager,
  onOpenResults,
  onEndRace,
  onCollapse,
  viewMode = 'RC_CONSOLE',
  onClose,
  isOverlay = false,
  isAdmin = false,
}) => {
  const [activeTab, setActiveTab] = useState<'LEADERBOARD' | 'MESH_NODES'>('LEADERBOARD');
  const [filterClass, setFilterClass] = useState<RaceClass | 'ALL'>('ALL');

  // Mesh Topo Filter & Sort States
  const [nodeFilter, setNodeFilter] = useState<'ALL' | 'WEB_GPS' | 'PHONE_GPS' | 'BLE' | 'LORA_MESH'>('ALL');
  const [nodeSort, setNodeSort] = useState<'RECENT' | 'NAME' | 'BATTERY' | 'SIGNAL' | 'SPEED' | 'BOUND'>('RECENT');

  // Filter boats by class
  const filteredBoats = boats.filter(
    (b) => filterClass === 'ALL' || b.class === filterClass
  );

  // Deduplicate and filter nodes (removing local mobile device when its tracking is off)
  const uniqueNodes = useMemo(() => {
    let list = deduplicateNodes(nodes);
    if (deviceGps && !deviceGps.active) {
      const localShort = (deviceGps.profile?.deviceId || '').slice(-4).toUpperCase();
      list = list.filter((n) => {
        if (n.isDeviceGps && (n.id.includes(localShort) || n.longName.includes('(This Device)'))) {
          return false;
        }
        return true;
      });
    }
    return list;
  }, [nodes, deviceGps?.active, deviceGps?.profile?.deviceId]);

  // Compute node counts per category
  const nodeCounts = useMemo(() => {
    let all = uniqueNodes.length;
    let web = 0;
    let phone = 0;
    let ble = 0;
    let lora = 0;

    for (const n of uniqueNodes) {
      const isBle = n.isBluetoothConnected || n.connectionType === 'BLE';
      const isPhone = n.connectionType === 'PHONE' || n.connectionType === 'TABLET';
      const isDeviceGps = n.isDeviceGps || n.connectionType === 'DEVICE_GPS';
      if (isDeviceGps) web++;
      else if (isPhone) phone++;
      else if (isBle) ble++;
      else lora++;
    }
    return { all, web, phone, ble, lora };
  }, [uniqueNodes]);

  // Filter and sort the nodes for the topology list
  const filteredAndSortedNodes = useMemo(() => {
    let result = uniqueNodes.filter((node) => {
      const isBle = node.isBluetoothConnected || node.connectionType === 'BLE';
      const isPhone = node.connectionType === 'PHONE' || node.connectionType === 'TABLET';
      const isDeviceGps = node.isDeviceGps || node.connectionType === 'DEVICE_GPS';
      const isLora = !isDeviceGps && !isPhone && !isBle;

      if (nodeFilter === 'WEB_GPS') return isDeviceGps;
      if (nodeFilter === 'PHONE_GPS') return isPhone;
      if (nodeFilter === 'BLE') return isBle;
      if (nodeFilter === 'LORA_MESH') return isLora;
      return true;
    });

    return [...result].sort((a, b) => {
      if (nodeSort === 'NAME') {
        return (a.longName || a.id).localeCompare(b.longName || b.id);
      }
      if (nodeSort === 'BATTERY') {
        return (b.battery ?? 0) - (a.battery ?? 0);
      }
      if (nodeSort === 'SIGNAL') {
        return (b.snr ?? -99) - (a.snr ?? -99);
      }
      if (nodeSort === 'SPEED') {
        return (b.speedKt ?? 0) - (a.speedKt ?? 0);
      }
      if (nodeSort === 'BOUND') {
        const aBound = (a.boundBoatId || boats.some((b) => b.id === a.boundBoatId || b.nodeId === a.id)) ? 1 : 0;
        const bBound = (b.boundBoatId || boats.some((b) => b.id === b.boundBoatId || b.nodeId === b.id)) ? 1 : 0;
        return bBound - aBound;
      }
      // 'RECENT' (default)
      return (b.lastPingTime || 0) - (a.lastPingTime || 0);
    });
  }, [uniqueNodes, nodeFilter, nodeSort, boats]);

  // Sort boats by World Sailing RRS Low Point Order (Finished -> Active Racing with most marks/lowest DTW -> Penalties/OCS)
  const sortedBoats = React.useMemo(() => {
    const seen = new Set<string>();
    const unique = filteredBoats.filter((b) => {
      if (!b || !b.id || seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });

    return [...unique].sort((a, b) => {
      const isFinA = a.status === 'FINISHED';
      const isFinB = b.status === 'FINISHED';
      if (isFinA && !isFinB) return -1;
      if (!isFinA && isFinB) return 1;
      if (isFinA && isFinB) return a.correctedSeconds - b.correctedSeconds;

      const aPenalty = ['OCS', 'DNF', 'DNS', 'DSQ'].includes(a.status);
      const bPenalty = ['OCS', 'DNF', 'DNS', 'DSQ'].includes(b.status);
      if (!aPenalty && bPenalty) return -1;
      if (aPenalty && !bPenalty) return 1;

      const aRoundings = a.markRoundings?.length || 0;
      const bRoundings = b.markRoundings?.length || 0;
      if (aRoundings !== bRoundings) return bRoundings - aRoundings;

      if ((a.dtw || 0) !== (b.dtw || 0)) return (a.dtw || 0) - (b.dtw || 0);

      return a.correctedSeconds - b.correctedSeconds;
    });
  }, [filteredBoats]);
  const leaderTime = sortedBoats[0]?.correctedSeconds || 0;

  return (
    <aside
      className={`flex flex-col text-[#E0E6ED] select-none shadow-2xl transition-all ${
        isOverlay
          ? 'w-full max-w-lg max-h-[calc(100vh-130px)] sm:max-h-[82vh] landscape:max-h-[98dvh] landscape:h-[98dvh] h-full rounded-2xl sm:rounded-3xl bg-[#0A0F1E]/90 backdrop-blur-md border border-[#334155]/80 overflow-hidden min-h-0'
          : 'w-80 sm:w-88 bg-[#060B16] border-r border-[#1E293B] shrink-0 h-full overflow-hidden'
      }`}
    >
      {/* Navigation Tabs & Collapse Control */}
      <div
        className={`flex border-b shrink-0 items-center ${
          isOverlay ? 'border-[#334155]/80 bg-[#121826]/75' : 'border-[#1E293B] bg-[#0A0F1E]/80'
        }`}
      >
        <button
          onClick={() => setActiveTab('LEADERBOARD')}
          className={`flex-1 py-3 landscape:py-1.5 px-3 landscape:px-2 text-xs landscape:text-[11px] font-bold tracking-wider uppercase flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'LEADERBOARD'
              ? 'border-[#00D4FF] text-[#00D4FF] bg-[#00D4FF]/5'
              : 'border-transparent text-[#64748B] hover:text-[#94A3B8]'
          }`}
        >
          <Sailboat className="w-3.5 h-3.5" />
          Leaderboard ({sortedBoats.length})
        </button>
        <button
          onClick={() => setActiveTab('MESH_NODES')}
          className={`flex-1 py-3 landscape:py-1.5 px-3 landscape:px-2 text-xs landscape:text-[11px] font-bold tracking-wider uppercase flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'MESH_NODES'
              ? 'border-[#00D4FF] text-[#00D4FF] bg-[#00D4FF]/5'
              : 'border-transparent text-[#64748B] hover:text-[#94A3B8]'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          Mesh Nodes ({nodes.length})
        </button>

        {!isOverlay && onCollapse && (
          <button
            onClick={onCollapse}
            className="p-3 text-[#64748B] hover:text-[#00D4FF] hover:bg-[#1E293B]/70 border-l border-[#1E293B] transition-colors shrink-0"
            title="Collapse Sidebar Dashboard (Slide to Left)"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="p-2.5 text-[#64748B] hover:text-white hover:bg-white/10 transition-colors shrink-0 border-l border-[#334155]/80 mr-1"
            title="Close Rank & Mesh Nodes"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tab 1: Leaderboard View */}
      {activeTab === 'LEADERBOARD' && (
        <div className="p-3 border-b border-[#1E293B] bg-[#0A0F1E]/50 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0 flex-wrap gap-1">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#64748B] font-mono font-bold">
              Standing (IRC/ORC)
            </h2>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setFilterClass('ALL')}
                className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-all ${
                  filterClass === 'ALL'
                    ? 'bg-[#00D4FF] text-[#020408] font-bold'
                    : 'bg-[#1E293B]/60 text-[#94A3B8] hover:text-white'
                }`}
              >
                ALL
              </button>
              {raceClasses.map((cls) => {
                const clsState = raceState.classStates?.[cls.name] || (raceState.activeClass === cls.name ? {
                  status: raceState.status,
                  countdownSeconds: raceState.countdownSeconds,
                  startSequenceActive: raceState.startSequenceActive
                } : {
                  status: 'PRE_START',
                  countdownSeconds: 300,
                  startSequenceActive: false
                });

                return (
                  <button
                    key={cls.id}
                    onClick={() => setFilterClass(cls.name)}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-all flex items-center gap-1 ${
                      filterClass === cls.name
                        ? 'bg-[#00D4FF] text-[#020408] font-bold'
                        : 'bg-[#1E293B]/60 text-[#94A3B8] hover:text-white'
                    }`}
                    title={cls.description || cls.name}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        clsState.status === 'RACING'
                          ? 'bg-[#00FF9D] animate-pulse'
                          : clsState.status === 'FINISHED'
                          ? 'bg-purple-400'
                          : clsState.status === 'COUNTDOWN'
                          ? 'bg-[#FBBC04] animate-pulse'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span>{cls.name}</span>
                  </button>
                );
              })}
              {viewMode !== 'SPECTATOR' && onOpenClassManager && (
                <button
                  onClick={onOpenClassManager}
                  className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 transition-all shadow-sm"
                  title="Manage, Add, Edit & Delete Race Classes"
                >
                  <Layers className="w-2.5 h-2.5 text-[#00D4FF]" />
                  <span>+ Class</span>
                </button>
              )}
            </div>
          </div>

          {/* Fleet Management & Race Status Toolbar */}
          <div className="p-2 bg-[#060B16] rounded-xl border border-[#1E293B] mb-2 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'RACING'
                      ? 'bg-emerald-400 animate-pulse'
                      : (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'FINISHED'
                      ? 'bg-purple-400'
                      : 'bg-amber-400'
                  }`}
                />
                <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                  {filterClass === 'ALL' ? raceState.activeClass : filterClass}:
                </span>
                <span
                  className={`text-[10px] font-mono font-bold ${
                    (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'RACING'
                      ? 'text-[#00FF9D]'
                      : (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'FINISHED'
                      ? 'text-purple-300'
                      : 'text-amber-300'
                  }`}
                >
                  {(raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'RACING'
                    ? 'IN PROGRESS (RACING)'
                    : (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'FINISHED'
                    ? 'FINISHED'
                    : (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status)}
                </span>
              </div>

              {viewMode !== 'SPECTATOR' && onEndRace && (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'RACING' && (
                <button
                  onClick={() => onEndRace(filterClass === 'ALL' ? raceState.activeClass : filterClass)}
                  className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-red-600/80 hover:bg-red-600 text-white transition-all shadow-sm flex items-center gap-1"
                  title="Finish active race class and lock final results"
                >
                  <span>🏁 End {filterClass === 'ALL' ? raceState.activeClass : filterClass}</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#1E293B]/60 text-[9.5px] font-mono text-[#94A3B8]">
              <span>Fleet: <strong className="text-white">{sortedBoats.length}</strong> boats</span>
              <div className="flex items-center gap-1.5">
                {onOpenBoatQr && boats.length > 0 && (
                  <button
                    onClick={() => onOpenBoatQr(boats[0]?.id || '')}
                    className="font-bold text-[#00D4FF] bg-[#00D4FF]/15 hover:bg-[#00D4FF]/25 border border-[#00D4FF]/40 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all text-[9px] font-mono"
                    title="Generate and print Smart Boat QR codes for 1-tap skipper check-in"
                  >
                    <QrCode className="w-2.5 h-2.5" />
                    <span>Boat QRs</span>
                  </button>
                )}

                {onOpenResults && (
                  <button
                    onClick={onOpenResults}
                    className="font-bold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
                    title="View official finish results and scoring breakdown"
                  >
                    <Trophy className="w-2.5 h-2.5 text-[#FFB800]" />
                    <span>Results</span>
                  </button>
                )}

                {viewMode !== 'SPECTATOR' && onClearDemoBoats && boats.some((b) => b.id.startsWith('boat-1') || b.id.startsWith('boat-2') || b.id.startsWith('boat-3')) && (
                  <button
                    onClick={onClearDemoBoats}
                    className="text-[9px] font-mono font-bold text-red-400 hover:text-red-200 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 px-1.5 py-0.5 rounded-lg flex items-center gap-1 transition-all"
                    title="Remove sample demo boats to start with a clean regatta fleet"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Demo</span>
                  </button>
                )}

                {viewMode !== 'SPECTATOR' && onOpenAddBoat && (
                  <button
                    onClick={onOpenAddBoat}
                    className="text-[9.5px] font-mono font-bold text-slate-950 bg-[#00D4FF] hover:bg-cyan-300 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all shadow-sm"
                    title="Add a new racing boat to the regatta"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Boat</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Hardware Tracker Notification Banner */}
          {nodes.some((n) => n.isBluetoothConnected || n.connectionType === 'BLE' || n.connectionType === 'USB') && (
            <div className="p-2 mb-2 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono text-cyan-200 font-bold">
                  Hardware Active: {nodes.find((n) => n.isBluetoothConnected || n.connectionType === 'BLE' || n.connectionType === 'USB')?.shortName || 'T-ECHO'}
                </span>
              </div>
              <button
                onClick={() => setActiveTab('NODES')}
                className="text-[9px] font-mono text-[#00D4FF] hover:underline font-bold"
              >
                Inspect Telemetry →
              </button>
            </div>
          )}

          <div className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0 pb-8 overscroll-contain touch-pan-y">
            {sortedBoats.length === 0 ? (
              <div className="p-4 bg-[#0A0F1E] border border-dashed border-[#1E293B] rounded-xl text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-[#00D4FF]/10 text-[#00D4FF] flex items-center justify-center mx-auto border border-[#00D4FF]/30">
                  <Bluetooth className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">No Vessels in Fleet</h4>
                  <p className="text-[10px] text-[#64748B] font-mono mt-1">
                    {viewMode === 'SPECTATOR'
                      ? 'Waiting for manager to register vessels or activate tracking telemetry.'
                      : 'Add registered boats or connect mobile phone GPS trackers to start live race tracking.'}
                  </p>
                </div>
                {viewMode !== 'SPECTATOR' && onOpenAddBoat && (
                  <button
                    onClick={onOpenAddBoat}
                    className="w-full py-2 bg-[#00D4FF] hover:bg-cyan-300 text-[#020408] font-bold text-xs rounded-lg transition-all font-mono shadow-md"
                  >
                    + Add New Racing Vessel
                  </button>
                )}
                {viewMode !== 'SPECTATOR' && onOpenHardwareScan && (
                  <button
                    onClick={onOpenHardwareScan}
                    className="w-full py-2 bg-[#1E293B] hover:bg-slate-700 text-[#00D4FF] font-bold text-xs rounded-lg transition-all font-mono border border-[#00D4FF]/30"
                  >
                    Connect T-Echo (BLE / MQTT)
                  </button>
                )}
              </div>
            ) : (
              sortedBoats.map((boat, rank) => {
              const diff = boat.correctedSeconds - leaderTime;
              const diffFormatted =
                diff === 0
                  ? '+00:00'
                  : `+${Math.floor(diff / 60)
                      .toString()
                      .padStart(2, '0')}:${Math.floor(diff % 60)
                      .toString()
                      .padStart(2, '0')}`;

              const isSelected = selectedBoatId === boat.id;
              const isFollowing = followedTargetId === boat.id;
              const isOcs = boat.status === 'OCS';
              const boundNode = nodes.find((n) => n.boundBoatId === boat.id || n.id === boat.nodeId);

              const boatClsState = raceState.classStates?.[boat.class] || (raceState.activeClass === boat.class ? {
                status: raceState.status,
                countdownSeconds: raceState.countdownSeconds,
                startSequenceActive: raceState.startSequenceActive
              } : undefined);

              const isClassInPreStartOrCountdown = boatClsState
                ? (boatClsState.status === 'PRE_START' || boatClsState.status === 'COUNTDOWN' || (typeof boatClsState.countdownSeconds === 'number' && boatClsState.countdownSeconds > 0))
                : (raceState.status === 'PRE_START' || raceState.status === 'COUNTDOWN' || (typeof raceState.countdownSeconds === 'number' && raceState.countdownSeconds > 0));

              return (
                <div
                  key={boat.id}
                  onClick={() => onSelectBoat(boat.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                    isOcs
                      ? 'bg-[#450A0A]/40 border-[#991B1B]/60 hover:border-[#FF4D4D]'
                      : isFollowing
                      ? 'bg-[#FBBC04]/10 border-[#FBBC04] shadow-[0_0_12px_rgba(251,188,4,0.2)]'
                      : isSelected
                      ? 'bg-[#00D4FF]/15 border-[#00D4FF] shadow-[0_0_12px_rgba(0,212,255,0.2)]'
                      : 'bg-[#0F172A]/70 border-[#1E293B] hover:border-[#334155]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold w-4 h-4 rounded bg-[#1E293B] text-[#94A3B8] flex items-center justify-center">
                        {rank + 1}
                      </span>
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: boat.color }} />
                      <span className="text-xs font-bold text-white tracking-wide font-google truncate max-w-[110px]">
                        {boat.name}
                      </span>
                      <span className="text-[10px] font-mono text-[#64748B]">
                        {boat.sailNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isClassInPreStartOrCountdown || boat.status === 'PRE_START' ? (
                        <span className="text-[9.5px] font-mono font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                          PRE-START
                        </span>
                      ) : boat.status === 'FINISHED' ? (
                        <span className="text-[9.5px] font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 border border-purple-500/40">
                          🏁 FINISHED
                        </span>
                      ) : isOcs ? (
                        <span className="text-[10px] font-bold text-[#FF4D4D] bg-[#FF4D4D]/20 px-1.5 py-0.5 rounded flex items-center gap-1 border border-[#FF4D4D]/40 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          OCS
                        </span>
                      ) : boat.status === 'RET' || boat.status === 'DNF' || boat.status === 'DNS' || boat.status === 'DSQ' ? (
                        <span className="text-[9.5px] font-mono font-bold text-red-300 bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/40">
                          {boat.status}
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-mono font-bold ${
                            rank === 0 ? 'text-[#00FF9D]' : 'text-[#94A3B8]'
                          }`}
                        >
                          {diffFormatted}
                        </span>
                      )}

                      {/* Show Boat QR Code (Admins see all; Non-admins only see unbound boats to prevent accidental re-binding) */}
                      {viewMode !== 'SPECTATOR' && onOpenBoatQr && (isAdmin || !boat.nodeId) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenBoatQr(boat.id);
                          }}
                          className="p-1 rounded hover:bg-[#00D4FF]/20 text-[#00D4FF] transition-colors"
                          title={`Smart QR Code for ${boat.name} (${boat.sailNumber})`}
                        >
                          <QrCode className="w-3 h-3" />
                        </button>
                      )}

                      {/* Bind Node Button */}
                      {viewMode !== 'SPECTATOR' && onOpenNodeBinding && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNodeBinding(undefined, boat.id);
                          }}
                          className="p-1 rounded hover:bg-[#00D4FF]/20 text-[#00D4FF] transition-colors"
                          title={boundNode ? `Change Meshtastic node for ${boat.name} (Bound: ${boundNode.id})` : `Bind Meshtastic Node to ${boat.name}`}
                        >
                          <Link2 className="w-3 h-3" />
                        </button>
                      )}

                      {/* Edit Boat Button */}
                      {viewMode !== 'SPECTATOR' && onEditBoat && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditBoat(boat);
                          }}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-[#00D4FF] transition-colors"
                          title={`Edit ${boat.name} profile, rating, or node`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}

                      {/* Delete Boat Button */}
                      {viewMode !== 'SPECTATOR' && onDeleteBoat && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBoat(boat.id);
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title={`Delete ${boat.name} from fleet`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono mt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold flex items-center gap-0.5" title="Node Battery Voltage & Level">
                        ⚡ {boundNode ? `${boundNode.battery ?? '--'}%${boundNode.voltage ? ` (${boundNode.voltage}V)` : ''}` : '--%'}
                      </span>
                      <span className="text-cyan-400 font-bold flex items-center gap-0.5" title="GPS Satellites in View / Fix">
                        🛰️ {boundNode ? (boundNode.gpsFix ? `${boundNode.satsInView ?? 0} Sats` : 'NO GPS FIX') : 'NO FIX'}
                      </span>
                    </div>
                    <span className="text-[#94A3B8]">
                      {boat.handicapSystem}: <strong className="text-[#E0E6ED]">{boat.handicapRating}</strong>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#94A3B8] font-mono mt-1">
                    <span>
                      SOG: <strong className="text-[#00D4FF]">{safeFixed(boat.sog, 1, '0.0')}kt</strong> • VMG:{' '}
                      <strong className="text-[#00FF9D]">{safeFixed(boat.vmg, 1, '0.0')}kt</strong>
                    </span>
                    <span>
                      DTW: <strong className="text-[#8AB4F8]">{safeFixed(boat.dtw, 2, '0.00')}NM</strong>
                    </span>
                  </div>

                  {/* Bound Tracker / Node Hardware Telemetry Status */}
                  {boundNode ? (
                    <div className="flex items-center justify-between text-[9px] font-mono mt-1 pt-1.5 border-t border-[#1E293B]/70 bg-[#060B16]/50 px-2 py-1 rounded-lg border border-cyan-500/20">
                      <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                        <span className="text-cyan-400 font-bold">
                          {boundNode.connectionType === 'PHONE' || boundNode.isDeviceGps ? '📱 PHONE GPS' : '📻 LORA TRACKER'}:
                        </span>
                        <strong className="text-slate-200 truncate">{boundNode.shortName || boundNode.id}</strong>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-emerald-400 font-bold">
                          ⚡ {boundNode.battery ?? 85}%
                        </span>
                        <span className="text-slate-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 text-cyan-400" />
                          {formatLastHeard(boundNode.lastPingTime)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[9px] font-mono mt-1 pt-1 border-t border-[#1E293B]/40 text-slate-500 px-1">
                      <span className="flex items-center gap-1 italic text-slate-400">
                        🤖 Autonomous Sim (No Tracker)
                      </span>
                      {viewMode !== 'SPECTATOR' && onOpenNodeBinding && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNodeBinding(undefined, boat.id);
                          }}
                          className="text-[#00D4FF] hover:underline font-bold"
                        >
                          + Bind Tracker
                        </button>
                      )}
                    </div>
                  )}

                  {/* Quick Actions: Follow & Inspect */}
                  <div className="mt-2 pt-2 border-t border-[#1E293B] flex items-center justify-between gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFollow(boat.id, boat.name);
                      }}
                      className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold font-google flex items-center justify-center gap-1 transition-all ${
                        isFollowing
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-[#1E293B] hover:bg-slate-700 text-[#00D4FF]'
                      }`}
                    >
                      <Crosshair className={`w-3 h-3 ${isFollowing ? 'animate-spin' : ''}`} />
                      {isFollowing ? 'Following' : 'Follow Camera'}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNodeInspector(boundNode || null, boat);
                      }}
                      className="py-1 px-2.5 rounded-lg bg-[#1E293B] hover:bg-slate-700 text-slate-200 text-[10px] font-bold font-google flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3 h-3 text-cyan-400" />
                      Inspect
                    </button>

                    {onOpenBoatQr && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenBoatQr(boat.id);
                        }}
                        className="py-1 px-2 rounded-lg bg-[#00D4FF]/10 hover:bg-[#00D4FF]/25 border border-[#00D4FF]/30 text-[#00D4FF] text-[10px] font-bold font-google flex items-center gap-1 transition-all"
                        title={`Smart QR Code for ${boat.name}`}
                      >
                        <QrCode className="w-3 h-3" />
                        <span>QR</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Node Health & Mesh Topography */}
      {activeTab === 'MESH_NODES' && (
        <div className="p-3 border-b border-[#1E293B] bg-[#0A0F1E]/50 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-[#64748B] font-mono font-bold">
              MESHTASTIC NODES
            </h2>
          </div>

          <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0 pb-8 overscroll-contain touch-pan-y">
            {/* User Device GPS Status Card */}
            <div className={`p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
              deviceGps?.active
                ? 'bg-[#00D4FF]/10 border-[#00D4FF]/60 shadow-[0_0_12px_rgba(0,212,255,0.2)]'
                : 'bg-[#0F172A]/70 border-[#1E293B]'
            }`}>
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={onOpenHybridTrackers}
                  title="Click to open Hybrid Fleet & Multi-Device Tracker setup"
                >
                  <div className={`p-1.5 rounded ${deviceGps?.active ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'bg-[#1E293B] text-[#64748B]'}`}>
                    <Navigation className={`w-3.5 h-3.5 ${deviceGps?.active ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white font-google group-hover:text-[#00D4FF] transition-colors">
                        {deviceGps?.profile?.deviceName || 'User Device GPS'}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold font-mono ${
                        deviceGps?.active ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'bg-[#1E293B] text-[#64748B]'
                      }`}>
                        {deviceGps?.active ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-[#64748B]">
                      {deviceGps?.active
                        ? (typeof deviceGps.lat === 'number' && typeof deviceGps.lng === 'number'
                          ? `${safeFixed(deviceGps.lat, 4)}°N, ${safeFixed(deviceGps.lng, 4)}°E`
                          : 'Acquiring Signal...')
                        : 'Phone / Tablet / Laptop Browser GPS'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={onToggleDeviceGps}
                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                      deviceGps?.active
                        ? 'bg-[#00D4FF] text-[#020408]'
                        : 'bg-[#1E293B] hover:bg-[#334155] text-white'
                    }`}
                  >
                    {deviceGps?.active ? 'OFF' : 'ON'}
                  </button>
                  {viewMode !== 'SPECTATOR' && onOpenHybridTrackers && (
                    <button
                      onClick={onOpenHybridTrackers}
                      className="p-1 rounded bg-[#1E293B] hover:bg-[#334155] text-[#00D4FF] text-[10px] font-mono"
                      title="Manage Hybrid Fleet Trackers"
                    >
                      ⚙️
                    </button>
                  )}
                </div>
              </div>

              {deviceGps?.active && deviceGps.lat && (
                <div className="flex justify-between items-center text-[9px] font-mono text-[#00FF9D] pt-1 border-t border-[#1E293B]">
                  <span>Speed: {safeFixed(deviceGps.speedKt, 1, '0.0')} kt</span>
                  <span>Accuracy: ±{deviceGps.accuracy ?? 5}m</span>
                  <span>Heading: {deviceGps.headingDeg ?? 0}°</span>
                </div>
              )}

              {deviceGps?.error && (
                <p className="text-[9px] font-mono text-[#FF4D4D] pt-1 border-t border-[#FF4D4D]/30">
                  ⚠️ {deviceGps.error}
                </p>
              )}
            </div>
            {/* MESH NODES MANAGEMENT TOOLBAR */}
            <div className="flex items-center justify-between gap-2 p-2 bg-[#0A0F1E] rounded-xl border border-[#1E293B]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] font-bold">
                  Mesh Nodes ({filteredAndSortedNodes.length}{nodeFilter !== 'ALL' ? `/${uniqueNodes.length}` : ''})
                </span>
                {uniqueNodes.some((n) => !n.isDeviceGps && !n.isBluetoothConnected && n.connectionType !== 'BLE' && n.connectionType !== 'PHONE' && n.connectionType !== 'TABLET' && (n.id.startsWith('node-') || n.id.startsWith('mock-'))) && (
                  <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-bold">
                    Demo Active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {viewMode !== 'SPECTATOR' && onOpenNodeBinding && (
                  <button
                    onClick={() => onOpenNodeBinding()}
                    className="px-2 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 active:bg-yellow-500/40 border border-yellow-500/50 text-yellow-400 text-[10px] font-mono font-bold flex items-center gap-1 transition-all shadow-sm shadow-yellow-500/10 cursor-pointer"
                    title="Open Meshtastic Node to Boat Binding Manager"
                  >
                    <Link2 className="w-3 h-3 text-yellow-400" />
                    <span>Bind Boat</span>
                  </button>
                )}

                {viewMode !== 'SPECTATOR' && (onOpenHardwareScan || onOpenHybridTrackers) && (
                  <button
                    onClick={() => {
                      if (onOpenHardwareScan) {
                        onOpenHardwareScan();
                      } else if (onOpenHybridTrackers) {
                        onOpenHybridTrackers();
                      }
                    }}
                    className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 active:bg-emerald-500/40 border border-emerald-500/50 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1 transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                    title="Open Bluetooth BLE & Hardware Scanner Menu"
                  >
                    <Bluetooth className="w-3 h-3 text-emerald-400" />
                    <span>Bind Tracker</span>
                  </button>
                )}
              </div>
            </div>

            {/* MESH NODES FILTER & SORT CONTROLS */}
            {uniqueNodes.length > 0 && (
              <div className="p-2 bg-[#0A0F1E] rounded-xl border border-[#1E293B] flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1 text-[9px] font-mono">
                  <div className="flex items-center gap-1 font-bold text-slate-300">
                    <SlidersHorizontal className="w-3 h-3 text-[#00D4FF]" />
                    <span>Filter:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3 text-[#00FF9D]" />
                    <span className="text-slate-400">Sort:</span>
                    <select
                      value={nodeSort}
                      onChange={(e) => setNodeSort(e.target.value as any)}
                      className="bg-[#060B16] text-[#00FF9D] text-[9.5px] font-bold border border-[#1E293B] rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-[#00FF9D]/40"
                    >
                      <option value="RECENT">Recent</option>
                      <option value="NAME">Name (A-Z)</option>
                      <option value="BATTERY">Battery (%)</option>
                      <option value="SIGNAL">Signal (SNR)</option>
                      <option value="SPEED">Speed (kt)</option>
                      <option value="BOUND">Bound Boat</option>
                    </select>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    onClick={() => setNodeFilter('ALL')}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'ALL'
                        ? 'bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/60 shadow-[0_0_8px_rgba(0,212,255,0.2)]'
                        : 'bg-[#060B16] text-slate-400 border-[#1E293B] hover:text-slate-200'
                    }`}
                  >
                    <span>All</span>
                    <span className="opacity-70">({nodeCounts.all})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('WEB_GPS')}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'WEB_GPS'
                        ? 'bg-[#00FF9D]/20 text-[#00FF9D] border-[#00FF9D]/60 shadow-[0_0_8px_rgba(0,255,157,0.2)]'
                        : 'bg-[#060B16] text-slate-400 border-[#1E293B] hover:text-slate-200'
                    }`}
                  >
                    <span>Web GPS</span>
                    <span className="opacity-70">({nodeCounts.web})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('PHONE_GPS')}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'PHONE_GPS'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                        : 'bg-[#060B16] text-slate-400 border-[#1E293B] hover:text-slate-200'
                    }`}
                  >
                    <span>Phone GPS</span>
                    <span className="opacity-70">({nodeCounts.phone})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('BLE')}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'BLE'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                        : 'bg-[#060B16] text-slate-400 border-[#1E293B] hover:text-slate-200'
                    }`}
                  >
                    <span>BLE</span>
                    <span className="opacity-70">({nodeCounts.ble})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('LORA_MESH')}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'LORA_MESH'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                        : 'bg-[#060B16] text-slate-400 border-[#1E293B] hover:text-slate-200'
                    }`}
                  >
                    <span>LoRa Mesh</span>
                    <span className="opacity-70">({nodeCounts.lora})</span>
                  </button>
                </div>
              </div>
            )}

            {uniqueNodes.length === 0 ? (
              <div className="p-4 bg-[#0A0F1E] border border-dashed border-[#1E293B] rounded-xl text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-[#00FF9D]/10 text-[#00FF9D] flex items-center justify-center mx-auto border border-[#00FF9D]/30">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">No Nodes in Topology</h4>
                  <p className="text-[10px] text-[#64748B] font-mono mt-1">
                    {viewMode === 'SPECTATOR'
                      ? 'Waiting for manager or fleet to connect tracking hardware/mobile GPS.'
                      : 'Connect mobile phones or turn on your T-Echo / Heltec node to start tracking live telemetry.'}
                  </p>
                </div>
                {viewMode !== 'SPECTATOR' && onOpenHardwareScan && (
                  <button
                    onClick={onOpenHardwareScan}
                    className="w-full py-2 bg-[#00FF9D] hover:bg-emerald-300 text-[#020408] font-bold text-xs rounded-lg transition-all font-mono"
                  >
                    Scan / Add Hardware Node
                  </button>
                )}
              </div>
            ) : filteredAndSortedNodes.length === 0 ? (
              <div className="p-4 bg-[#0A0F1E] border border-dashed border-[#1E293B] rounded-xl text-center space-y-2">
                <p className="text-xs font-bold text-slate-300">No nodes match the selected filter.</p>
                <button
                  onClick={() => setNodeFilter('ALL')}
                  className="px-3 py-1 bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 text-[#00D4FF] border border-[#00D4FF]/40 rounded-lg text-[10px] font-mono font-bold transition-all"
                >
                  Show All Nodes ({uniqueNodes.length})
                </button>
              </div>
            ) : (
              filteredAndSortedNodes.map((node) => {
              const boundBoat = boats.find((b) => b.id === node.boundBoatId || b.nodeId === node.id);
              const isBle = node.isBluetoothConnected || node.connectionType === 'BLE';
              const isPhone = node.connectionType === 'PHONE';
              const isTablet = node.connectionType === 'TABLET';
              const isDeviceGps = node.isDeviceGps || node.connectionType === 'DEVICE_GPS';
              const isFollowing = followedTargetId === node.id;
              const isDemo = !isDeviceGps && !isPhone && !isTablet && !isBle && (node.id.startsWith('node-') || node.id.startsWith('mock-'));

              const badgeColor = isDemo
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : isPhone
                ? 'bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/40'
                : isTablet
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : isDeviceGps
                ? 'bg-[#00FF9D]/20 text-[#00FF9D] border-[#00FF9D]/40'
                : isBle
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

              const badgeText = isDemo
                ? 'DEMO NODE'
                : isPhone
                ? 'PHONE GPS'
                : isTablet
                ? 'TABLET'
                : isDeviceGps
                ? 'WEB GPS'
                : isBle
                ? 'BLE T-ECHO'
                : 'LORA MESH';

              const hasBme280 = node.sensorModel?.includes('BME280') || node.barometricPressure !== undefined || node.temperature !== undefined || node.humidity !== undefined;

              return (
                <div
                  key={node.id}
                  className={`p-2.5 rounded-xl border transition-all flex flex-col gap-2 ${
                    isFollowing
                      ? 'bg-amber-950/30 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : isPhone || isTablet || isDeviceGps
                      ? 'bg-[#060E1E] border-[#00D4FF]/30'
                      : isBle
                      ? 'bg-cyan-950/20 border-cyan-500/40'
                      : 'bg-[#0F172A]/70 border-[#1E293B]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded ${
                          isPhone || isTablet
                            ? 'bg-[#00D4FF]/20 text-[#00D4FF]'
                            : isBle
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {isPhone ? (
                          <Smartphone className="w-3.5 h-3.5" />
                        ) : isTablet ? (
                          <Tablet className="w-3.5 h-3.5" />
                        ) : isBle ? (
                          <Bluetooth className="w-3.5 h-3.5" />
                        ) : (
                          <Radio className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white font-google">{node.longName}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold font-mono border ${badgeColor}`}>
                            {badgeText}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400">
                          {node.id} • {node.hardwareModel || (isPhone ? 'Mobile Device' : 'LoRa Device')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-[11px] font-bold text-emerald-400 block" title="Battery Charge & Voltage">
                        {node.battery !== undefined ? `⚡ ${node.battery}%` : '⚡ —'}{node.voltage ? ` (${node.voltage}V)` : ''}
                      </span>
                      <span className="text-[9px] text-cyan-300 block" title="Speed and Satellites">
                        {node.speedKt !== undefined && node.speedKt !== null ? `${safeFixed(node.speedKt, 1, '0.0')} kt` : node.satsInView !== undefined ? `🛰️ ${node.satsInView} Sats` : '🛰️ —'}
                      </span>
                      <span className="text-[8px] text-slate-400">
                        {node.rssi !== undefined ? `${node.rssi} dBm` : '—'} • {node.snr !== undefined ? `${node.snr} SNR` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* BME280 Environmental Sensors strip if available */}
                  {hasBme280 && (
                    <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-2 py-1 flex items-center justify-between text-[9px] font-mono text-emerald-300 flex-wrap gap-1">
                      <div className="flex items-center gap-1 text-[8.5px] font-bold text-emerald-400">
                        <Gauge className="w-3 h-3 text-emerald-400" />
                        <span>BME280:</span>
                      </div>
                      {node.barometricPressure !== undefined && node.barometricPressure !== null && (
                        <span title="Barometric Atmospheric Pressure">
                          🧭 {safeFixed(node.barometricPressure, 1)} hPa
                        </span>
                      )}
                      {node.temperature !== undefined && node.temperature !== null && (
                        <span title="Ambient Temperature">
                          🌡️ {safeFixed(node.temperature, 1)}°C
                        </span>
                      )}
                      {node.humidity !== undefined && node.humidity !== null && (
                        <span title="Relative Humidity">
                          💧 {safeFixed(node.humidity, 1)}% RH
                        </span>
                      )}
                      {node.iaq !== undefined && (
                        <span title="Indoor Air Quality Index" className="text-cyan-300 font-bold">
                          IAQ {node.iaq}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Last Heard & Position Metadata */}
                  <div className="text-[9px] font-mono text-[#64748B] flex items-center justify-between px-1 bg-[#060B16]/60 py-1 rounded-lg border border-[#1E293B]/40">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock className="w-2.5 h-2.5 text-cyan-400" />
                      Last Heard: <strong className="text-[#00D4FF] font-bold">{formatLastHeard(node.lastPingTime)}</strong>
                    </span>
                    {boundBoat ? (
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: boundBoat.color || '#00D4FF' }} />
                        <span className="text-[#00FF9D] font-bold truncate max-w-[130px]">
                          ⚓ {boundBoat.name} ({boundBoat.sailNumber})
                        </span>
                      </div>
                    ) : (
                      <span className="text-amber-400 font-semibold italic bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/20">
                        ⚠️ Unbound Tracker
                      </span>
                    )}
                  </div>

                  {/* Coordinates indicator if active */}
                  {typeof node.lat === 'number' && typeof node.lng === 'number' && (
                    <div className="text-[9px] font-mono text-[#64748B] flex items-center justify-between px-1">
                      <span>POS: {safeFixed(node.lat, 4)}°N, {safeFixed(node.lng, 4)}°E</span>
                      {node.altitudeMeters !== undefined && <span>ALT: {node.altitudeMeters}m</span>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-800/60 flex-wrap">
                    {viewMode !== 'SPECTATOR' && onOpenNodeBinding && (
                      <button
                        onClick={() => onOpenNodeBinding(node.id, boundBoat?.id)}
                        className={`py-1 px-2 rounded text-[10px] font-bold font-google flex items-center gap-1 transition-all ${
                          boundBoat
                            ? 'bg-[#00D4FF]/10 text-[#00D4FF] hover:bg-[#00D4FF]/25 border border-[#00D4FF]/30'
                            : 'bg-[#FBBC04]/20 text-[#FBBC04] hover:bg-[#FBBC04]/30 border border-[#FBBC04]/50'
                        }`}
                        title={`Bind ${node.longName} to a boat in the fleet`}
                      >
                        <Link2 className="w-3 h-3" />
                        <span>{boundBoat ? 'Rebind' : 'Bind Boat'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => onToggleFollow(node.id, node.longName)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold font-google flex items-center justify-center gap-1 transition-colors ${
                        isFollowing
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-cyan-300 hover:bg-slate-700'
                      }`}
                    >
                      <Crosshair className="w-3 h-3" />
                      {isFollowing ? 'Following' : 'Center'}
                    </button>

                    <button
                      onClick={() => onOpenNodeInspector(node, boundBoat || null)}
                      className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold font-google flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-cyan-400" />
                      Inspect
                    </button>

                    {viewMode !== 'SPECTATOR' && onDeleteNode && (
                      <button
                        onClick={() => onDeleteNode(node.id)}
                        className="p-1.5 rounded bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700/50 hover:border-red-500/40 transition-colors"
                        title={`Remove ${node.longName} (${node.id}) from system`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

