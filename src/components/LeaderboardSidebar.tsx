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
      className={`flex flex-col text-lt-e0e6ed select-none shadow-2xl transition-all ${
        isOverlay
          ? 'w-full max-w-lg max-h-[calc(100vh-130px)] sm:max-h-[82vh] landscape:max-h-[98dvh] landscape:h-[98dvh] h-full rounded-2xl sm:rounded-3xl bg-lb-0a0f1e/90 backdrop-blur-md border border-ll-334155/80 overflow-hidden min-h-0'
          : 'w-80 sm:w-88 bg-lb-060b16 border-r border-ll-1e293b shrink-0 h-full overflow-hidden'
      }`}
    >
      {/* Navigation Tabs & Collapse Control */}
      <div
        className={`flex border-b shrink-0 items-center ${
          isOverlay ? 'border-ll-334155/80 bg-lb-121826/75' : 'border-ll-1e293b bg-lb-0a0f1e/80'
        }`}
      >
        <button
          onClick={() => setActiveTab('LEADERBOARD')}
          className={`flex-1 py-3 landscape:py-1.5 px-3 landscape:px-2 text-xs font-bold whitespace-nowrap flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'LEADERBOARD'
              ? 'border-ll-00d4ff text-lt-00d4ff bg-lb-00d4ff/5'
              : 'border-transparent text-lt-64748b hover:text-lt-94a3b8'
          }`}
        >
          <Sailboat className="w-3.5 h-3.5" />
          Leaderboard ({sortedBoats.length})
        </button>
        <button
          onClick={() => setActiveTab('MESH_NODES')}
          className={`flex-1 py-3 landscape:py-1.5 px-3 landscape:px-2 text-xs font-bold whitespace-nowrap flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'MESH_NODES'
              ? 'border-ll-00d4ff text-lt-00d4ff bg-lb-00d4ff/5'
              : 'border-transparent text-lt-64748b hover:text-lt-94a3b8'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          Mesh Nodes ({nodes.length})
        </button>

        {!isOverlay && onCollapse && (
          <button
            onClick={onCollapse}
            className="p-3 text-lt-64748b hover:text-lt-00d4ff hover:bg-lb-1e293b/70 border-l border-ll-1e293b transition-colors shrink-0"
            title="Collapse Sidebar Dashboard (Slide to Left)"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="p-2.5 text-lt-64748b hover:text-lt-white hover:bg-lb-white/10 transition-colors shrink-0 border-l border-ll-334155/80 mr-1"
            title="Close Rank & Mesh Nodes"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tab 1: Leaderboard View */}
      {activeTab === 'LEADERBOARD' && (
        <div className="p-3 border-b border-ll-1e293b bg-lb-0a0f1e/50 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0 flex-wrap gap-1">
            <h2 className="text-xs text-lt-94a3b8 font-bold">
              Standings (IRC/ORC)
            </h2>
            {/* Filters the leaderboard only; the race console's class tabs pick the active class */}
            <div role="group" aria-label="Show class" className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-lt-94a3b8 mr-0.5">Show</span>
              <button
                onClick={() => setFilterClass('ALL')}
                className={`text-xs px-1.5 py-0.5 rounded font-mono transition-all ${
                  filterClass === 'ALL'
                    ? 'bg-lb-00d4ff text-lt-020408 font-bold'
                    : 'bg-lb-1e293b/60 text-lt-94a3b8 hover:text-lt-white'
                }`}
              >
                All
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
                    className={`text-xs px-1.5 py-0.5 rounded font-mono transition-all flex items-center gap-1 ${
                      filterClass === cls.name
                        ? 'bg-lb-00d4ff text-lt-020408 font-bold'
                        : 'bg-lb-1e293b/60 text-lt-94a3b8 hover:text-lt-white'
                    }`}
                    title={cls.description || cls.name}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        clsState.status === 'RACING'
                          ? 'bg-lb-00ff9d animate-pulse'
                          : clsState.status === 'FINISHED'
                          ? 'bg-lb-purple-400'
                          : clsState.status === 'COUNTDOWN'
                          ? 'bg-lb-fbbc04 animate-pulse'
                          : 'bg-lb-slate-500'
                      }`}
                    />
                    <span>{cls.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fleet Management & Race Status Toolbar */}
          <div className="p-2 bg-lb-060b16 rounded-xl border border-ll-1e293b mb-2 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'RACING'
                      ? 'bg-lb-emerald-400 animate-pulse'
                      : (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'FINISHED'
                      ? 'bg-lb-purple-400'
                      : 'bg-lb-amber-400'
                  }`}
                />
                <span className="text-xs font-mono font-bold text-lt-white uppercase tracking-wider">
                  {filterClass === 'ALL' ? raceState.activeClass : filterClass}:
                </span>
                <span
                  className={`text-xs font-mono font-bold ${
                    (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'RACING'
                      ? 'text-lt-00ff9d'
                      : (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'FINISHED'
                      ? 'text-lt-purple-300'
                      : 'text-lt-amber-300'
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
                  className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-lb-red-600/80 hover:bg-lb-red-600 text-lt-white transition-all shadow-sm flex items-center gap-1"
                  title="Finish active race class and lock final results"
                >
                  <span>Finish {filterClass === 'ALL' ? raceState.activeClass : filterClass}</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-ll-1e293b/60 text-xs font-mono text-lt-94a3b8">
              <span>Fleet: <strong className="text-lt-white">{sortedBoats.length}</strong> boats</span>
              <div className="flex items-center gap-1.5">
                {onOpenBoatQr && boats.length > 0 && (
                  <button
                    onClick={() => onOpenBoatQr(boats[0]?.id || '')}
                    className="font-bold text-lt-00d4ff bg-lb-00d4ff/15 hover:bg-lb-00d4ff/25 border border-ll-00d4ff/40 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all text-xs font-mono"
                    title="Generate and print Smart Boat QR codes for 1-tap skipper check-in"
                  >
                    <QrCode className="w-2.5 h-2.5" />
                    <span>Boat QRs</span>
                  </button>
                )}

                {/* Spectators' way to results; officers use the race console's Results button */}
                {onOpenResults && viewMode === 'SPECTATOR' && (
                  <button
                    onClick={onOpenResults}
                    className="font-bold text-lt-amber-300 bg-lb-amber-500/20 hover:bg-lb-amber-500/30 border border-ll-amber-500/40 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
                    title="View official finish results and scoring breakdown"
                  >
                    <Trophy className="w-2.5 h-2.5 text-lt-ffb800" />
                    <span>Results</span>
                  </button>
                )}

                {viewMode !== 'SPECTATOR' && onClearDemoBoats && boats.some((b) => b.id.startsWith('boat-1') || b.id.startsWith('boat-2') || b.id.startsWith('boat-3')) && (
                  <button
                    onClick={onClearDemoBoats}
                    className="text-xs font-mono font-bold text-lt-red-400 hover:text-lt-red-200 bg-lb-red-500/10 hover:bg-lb-red-500/25 border border-ll-red-500/30 px-1.5 py-0.5 rounded-lg flex items-center gap-1 transition-all"
                    title="Remove sample demo boats to start with a clean regatta fleet"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Demo</span>
                  </button>
                )}

                {viewMode !== 'SPECTATOR' && onOpenAddBoat && (
                  <button
                    onClick={onOpenAddBoat}
                    className="text-xs font-mono font-bold text-lt-slate-950 bg-lb-00d4ff hover:bg-lb-cyan-300 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all shadow-sm"
                    title="Add a new racing boat to the regatta"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add boat</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Hardware Tracker Notification Banner */}
          {nodes.some((n) => n.isBluetoothConnected || n.connectionType === 'BLE' || n.connectionType === 'USB') && (
            <div className="p-2 mb-2 rounded-xl bg-lb-cyan-950/40 border border-ll-cyan-500/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-lb-emerald-400 animate-pulse" />
                <span className="text-xs font-mono text-lt-cyan-200 font-bold">
                  Hardware Active: {nodes.find((n) => n.isBluetoothConnected || n.connectionType === 'BLE' || n.connectionType === 'USB')?.shortName || 'T-ECHO'}
                </span>
              </div>
              <button
                onClick={() => setActiveTab('NODES')}
                className="text-xs font-mono text-lt-00d4ff hover:underline font-bold"
              >
                Inspect Telemetry →
              </button>
            </div>
          )}

          <div className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0 pb-8 overscroll-contain touch-pan-y">
            {sortedBoats.length === 0 ? (
              <div className="p-4 bg-lb-0a0f1e border border-dashed border-ll-1e293b rounded-xl text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-lb-00d4ff/10 text-lt-00d4ff flex items-center justify-center mx-auto border border-ll-00d4ff/30">
                  <Bluetooth className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-lt-white">No Vessels in Fleet</h4>
                  <p className="text-xs text-lt-64748b font-mono mt-1">
                    {viewMode === 'SPECTATOR'
                      ? 'Waiting for manager to register vessels or activate tracking telemetry.'
                      : 'Add registered boats or connect mobile phone GPS trackers to start live race tracking.'}
                  </p>
                </div>
                {viewMode !== 'SPECTATOR' && onOpenAddBoat && (
                  <button
                    onClick={onOpenAddBoat}
                    className="w-full py-2 bg-lb-00d4ff hover:bg-lb-cyan-300 text-lt-020408 font-bold text-xs rounded-lg transition-all font-mono shadow-md"
                  >
                    Add boat
                  </button>
                )}
                {viewMode !== 'SPECTATOR' && onOpenHardwareScan && (
                  <button
                    onClick={onOpenHardwareScan}
                    className="w-full py-2 bg-lb-1e293b hover:bg-lb-slate-700 text-lt-00d4ff font-bold text-xs rounded-lg transition-all font-mono border border-ll-00d4ff/30"
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
                      ? 'bg-lb-450a0a/40 border-ll-991b1b/60 hover:border-ll-ff4d4d'
                      : isFollowing
                      ? 'bg-lb-fbbc04/10 border-ll-fbbc04 shadow-[0_0_12px_rgba(251,188,4,0.2)]'
                      : isSelected
                      ? 'bg-lb-00d4ff/15 border-ll-00d4ff shadow-[0_0_12px_rgba(0,212,255,0.2)]'
                      : 'bg-lb-0f172a/70 border-ll-1e293b hover:border-ll-334155'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold w-4 h-4 rounded bg-lb-1e293b text-lt-94a3b8 flex items-center justify-center">
                        {rank + 1}
                      </span>
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: boat.color }} />
                      <span className="text-xs font-bold text-lt-white tracking-wide font-google truncate max-w-[110px]">
                        {boat.name}
                      </span>
                      <span className="text-xs font-mono text-lt-64748b">
                        {boat.sailNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isClassInPreStartOrCountdown || boat.status === 'PRE_START' ? (
                        <span className="text-xs font-mono font-bold text-lt-amber-300 bg-lb-amber-500/20 px-1.5 py-0.5 rounded border border-ll-amber-500/40">
                          PRE-START
                        </span>
                      ) : boat.status === 'FINISHED' ? (
                        <span className="text-xs font-bold text-lt-purple-300 bg-lb-purple-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 border border-ll-purple-500/40">
                          🏁 FINISHED
                        </span>
                      ) : isOcs ? (
                        <span className="text-xs font-bold text-lt-ff4d4d bg-lb-ff4d4d/20 px-1.5 py-0.5 rounded flex items-center gap-1 border border-ll-ff4d4d/40 animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          OCS
                        </span>
                      ) : boat.status === 'RET' || boat.status === 'DNF' || boat.status === 'DNS' || boat.status === 'DSQ' ? (
                        <span className="text-xs font-mono font-bold text-lt-red-300 bg-lb-red-500/20 px-1.5 py-0.5 rounded border border-ll-red-500/40">
                          {boat.status}
                        </span>
                      ) : (
                        <span
                          className={`text-xs font-mono font-bold ${
                            rank === 0 ? 'text-lt-00ff9d' : 'text-lt-94a3b8'
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
                          className="p-1 rounded hover:bg-lb-00d4ff/20 text-lt-00d4ff transition-colors"
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
                          className="p-1 rounded hover:bg-lb-00d4ff/20 text-lt-00d4ff transition-colors"
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
                          className="p-1 rounded hover:bg-lb-slate-700 text-lt-slate-400 hover:text-lt-00d4ff transition-colors"
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
                          className="p-1 rounded hover:bg-lb-red-500/20 text-lt-slate-400 hover:text-lt-red-400 transition-colors"
                          title={`Delete ${boat.name} from fleet`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono mt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lt-emerald-400 font-bold flex items-center gap-0.5" title="Node Battery Voltage & Level">
                        ⚡ {boundNode ? `${boundNode.battery ?? '--'}%${boundNode.voltage ? ` (${boundNode.voltage}V)` : ''}` : '--%'}
                      </span>
                      <span className="text-lt-cyan-400 font-bold flex items-center gap-0.5" title="GPS Satellites in View / Fix">
                        🛰️ {boundNode ? (boundNode.gpsFix ? `${boundNode.satsInView ?? 0} Sats` : 'NO GPS FIX') : 'NO FIX'}
                      </span>
                    </div>
                    <span className="text-lt-94a3b8">
                      {boat.handicapSystem}: <strong className="text-lt-e0e6ed">{boat.handicapRating}</strong>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-lt-94a3b8 font-mono mt-1">
                    <span>
                      SOG: <strong className="text-lt-00d4ff">{safeFixed(boat.sog, 1, '0.0')}kt</strong> • VMG:{' '}
                      <strong className="text-lt-00ff9d">{safeFixed(boat.vmg, 1, '0.0')}kt</strong>
                    </span>
                    <span>
                      DTW: <strong className="text-lt-8ab4f8">{safeFixed(boat.dtw, 2, '0.00')}NM</strong>
                    </span>
                  </div>

                  {/* Bound Tracker / Node Hardware Telemetry Status */}
                  {boundNode ? (
                    <div className="flex items-center justify-between text-xs font-mono mt-1 pt-1.5 border-t border-ll-1e293b/70 bg-lb-060b16/50 px-2 py-1 rounded-lg border border-ll-cyan-500/20">
                      <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                        <span className="text-lt-cyan-400 font-bold">
                          {boundNode.connectionType === 'PHONE' || boundNode.isDeviceGps ? '📱 PHONE GPS' : '📻 LORA TRACKER'}:
                        </span>
                        <strong className="text-lt-slate-200 truncate">{boundNode.shortName || boundNode.id}</strong>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-lt-emerald-400 font-bold">
                          ⚡ {boundNode.battery ?? 85}%
                        </span>
                        <span className="text-lt-slate-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 text-lt-cyan-400" />
                          {formatLastHeard(boundNode.lastPingTime)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs font-mono mt-1 pt-1 border-t border-ll-1e293b/40 text-lt-slate-500 px-1">
                      <span className="flex items-center gap-1 italic text-lt-slate-400">
                        🤖 Autonomous Sim (No Tracker)
                      </span>
                      {viewMode !== 'SPECTATOR' && onOpenNodeBinding && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNodeBinding(undefined, boat.id);
                          }}
                          className="text-lt-00d4ff hover:underline font-bold"
                        >
                          + Bind Tracker
                        </button>
                      )}
                    </div>
                  )}

                  {/* Quick Actions: Follow & Inspect */}
                  <div className="mt-2 pt-2 border-t border-ll-1e293b flex items-center justify-between gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFollow(boat.id, boat.name);
                      }}
                      className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold font-google flex items-center justify-center gap-1 transition-all ${
                        isFollowing
                          ? 'bg-lb-amber-500 text-lt-slate-950 font-bold'
                          : 'bg-lb-1e293b hover:bg-lb-slate-700 text-lt-00d4ff'
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
                      className="py-1 px-2.5 rounded-lg bg-lb-1e293b hover:bg-lb-slate-700 text-lt-slate-200 text-xs font-bold font-google flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3 h-3 text-lt-cyan-400" />
                      Inspect
                    </button>

                    {onOpenBoatQr && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenBoatQr(boat.id);
                        }}
                        className="py-1 px-2 rounded-lg bg-lb-00d4ff/10 hover:bg-lb-00d4ff/25 border border-ll-00d4ff/30 text-lt-00d4ff text-xs font-bold font-google flex items-center gap-1 transition-all"
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
        <div className="p-3 border-b border-ll-1e293b bg-lb-0a0f1e/50 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="text-xs uppercase tracking-[0.2em] text-lt-64748b font-mono font-bold">
              MESHTASTIC NODES
            </h2>
          </div>

          <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0 pb-8 overscroll-contain touch-pan-y">
            {/* User Device GPS Status Card */}
            <div className={`p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
              deviceGps?.active
                ? 'bg-lb-00d4ff/10 border-ll-00d4ff/60 shadow-[0_0_12px_rgba(0,212,255,0.2)]'
                : 'bg-lb-0f172a/70 border-ll-1e293b'
            }`}>
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={onOpenHybridTrackers}
                  title="Click to open Hybrid Fleet & Multi-Device Tracker setup"
                >
                  <div className={`p-1.5 rounded ${deviceGps?.active ? 'bg-lb-00d4ff/20 text-lt-00d4ff' : 'bg-lb-1e293b text-lt-64748b'}`}>
                    <Navigation className={`w-3.5 h-3.5 ${deviceGps?.active ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-lt-white font-google group-hover:text-lt-00d4ff transition-colors">
                        {deviceGps?.profile?.deviceName || 'User Device GPS'}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-xs font-bold font-mono ${
                        deviceGps?.active ? 'bg-lb-00d4ff/20 text-lt-00d4ff' : 'bg-lb-1e293b text-lt-64748b'
                      }`}>
                        {deviceGps?.active ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-lt-64748b">
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
                    className={`px-2 py-1 rounded text-xs font-mono font-bold transition-all ${
                      deviceGps?.active
                        ? 'bg-lb-00d4ff text-lt-020408'
                        : 'bg-lb-1e293b hover:bg-lb-334155 text-lt-white'
                    }`}
                  >
                    {deviceGps?.active ? 'OFF' : 'ON'}
                  </button>
                  {viewMode !== 'SPECTATOR' && onOpenHybridTrackers && (
                    <button
                      onClick={onOpenHybridTrackers}
                      className="p-1 rounded bg-lb-1e293b hover:bg-lb-334155 text-lt-00d4ff text-xs font-mono"
                      title="Manage Hybrid Fleet Trackers"
                    >
                      ⚙️
                    </button>
                  )}
                </div>
              </div>

              {deviceGps?.active && deviceGps.lat && (
                <div className="flex justify-between items-center text-xs font-mono text-lt-00ff9d pt-1 border-t border-ll-1e293b">
                  <span>Speed: {safeFixed(deviceGps.speedKt, 1, '0.0')} kt</span>
                  <span>Accuracy: ±{deviceGps.accuracy ?? 5}m</span>
                  <span>Heading: {deviceGps.headingDeg ?? 0}°</span>
                </div>
              )}

              {deviceGps?.error && (
                <p className="text-xs font-mono text-lt-ff4d4d pt-1 border-t border-ll-ff4d4d/30">
                  ⚠️ {deviceGps.error}
                </p>
              )}
            </div>
            {/* MESH NODES MANAGEMENT TOOLBAR */}
            <div className="flex items-center justify-between gap-2 p-2 bg-lb-0a0f1e rounded-xl border border-ll-1e293b">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono uppercase tracking-wider text-lt-64748b font-bold">
                  Mesh Nodes ({filteredAndSortedNodes.length}{nodeFilter !== 'ALL' ? `/${uniqueNodes.length}` : ''})
                </span>
                {uniqueNodes.some((n) => !n.isDeviceGps && !n.isBluetoothConnected && n.connectionType !== 'BLE' && n.connectionType !== 'PHONE' && n.connectionType !== 'TABLET' && (n.id.startsWith('node-') || n.id.startsWith('mock-'))) && (
                  <span className="text-xs font-mono bg-lb-purple-500/20 text-lt-purple-300 border border-ll-purple-500/30 px-1.5 py-0.2 rounded font-bold">
                    Demo Active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {viewMode !== 'SPECTATOR' && onOpenNodeBinding && (
                  <button
                    onClick={() => onOpenNodeBinding()}
                    className="px-2 py-1 rounded bg-lb-yellow-500/20 hover:bg-lb-yellow-500/30 active:bg-lb-yellow-500/40 border border-ll-yellow-500/50 text-lt-yellow-400 text-xs font-mono font-bold flex items-center gap-1 transition-all shadow-sm shadow-ll-yellow-500/10 cursor-pointer"
                    title="Open Meshtastic Node to Boat Binding Manager"
                  >
                    <Link2 className="w-3 h-3 text-lt-yellow-400" />
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
                    className="px-2 py-1 rounded bg-lb-emerald-500/20 hover:bg-lb-emerald-500/30 active:bg-lb-emerald-500/40 border border-ll-emerald-500/50 text-lt-emerald-400 text-xs font-mono font-bold flex items-center gap-1 transition-all shadow-sm shadow-ll-emerald-500/10 cursor-pointer"
                    title="Open Bluetooth BLE & Hardware Scanner Menu"
                  >
                    <Bluetooth className="w-3 h-3 text-lt-emerald-400" />
                    <span>Bind Tracker</span>
                  </button>
                )}
              </div>
            </div>

            {/* MESH NODES FILTER & SORT CONTROLS */}
            {uniqueNodes.length > 0 && (
              <div className="p-2 bg-lb-0a0f1e rounded-xl border border-ll-1e293b flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1 text-xs font-mono">
                  <div className="flex items-center gap-1 font-bold text-lt-slate-300">
                    <SlidersHorizontal className="w-3 h-3 text-lt-00d4ff" />
                    <span>Filter:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3 text-lt-00ff9d" />
                    <span className="text-lt-slate-400">Sort:</span>
                    <select
                      value={nodeSort}
                      onChange={(e) => setNodeSort(e.target.value as any)}
                      className="bg-lb-060b16 text-lt-00ff9d text-xs font-bold border border-ll-1e293b rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-ll-00ff9d/40"
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
                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'ALL'
                        ? 'bg-lb-00d4ff/20 text-lt-00d4ff border-ll-00d4ff/60 shadow-[0_0_8px_rgba(0,212,255,0.2)]'
                        : 'bg-lb-060b16 text-lt-slate-400 border-ll-1e293b hover:text-lt-slate-200'
                    }`}
                  >
                    <span>All</span>
                    <span className="opacity-70">({nodeCounts.all})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('WEB_GPS')}
                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'WEB_GPS'
                        ? 'bg-lb-00ff9d/20 text-lt-00ff9d border-ll-00ff9d/60 shadow-[0_0_8px_rgba(0,255,157,0.2)]'
                        : 'bg-lb-060b16 text-lt-slate-400 border-ll-1e293b hover:text-lt-slate-200'
                    }`}
                  >
                    <span>Web GPS</span>
                    <span className="opacity-70">({nodeCounts.web})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('PHONE_GPS')}
                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'PHONE_GPS'
                        ? 'bg-lb-sky-500/20 text-lt-sky-300 border-ll-sky-500/60 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                        : 'bg-lb-060b16 text-lt-slate-400 border-ll-1e293b hover:text-lt-slate-200'
                    }`}
                  >
                    <span>Phone GPS</span>
                    <span className="opacity-70">({nodeCounts.phone})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('BLE')}
                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'BLE'
                        ? 'bg-lb-cyan-500/20 text-lt-cyan-300 border-ll-cyan-500/60 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                        : 'bg-lb-060b16 text-lt-slate-400 border-ll-1e293b hover:text-lt-slate-200'
                    }`}
                  >
                    <span>BLE</span>
                    <span className="opacity-70">({nodeCounts.ble})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('LORA_MESH')}
                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'LORA_MESH'
                        ? 'bg-lb-emerald-500/20 text-lt-emerald-300 border-ll-emerald-500/60 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                        : 'bg-lb-060b16 text-lt-slate-400 border-ll-1e293b hover:text-lt-slate-200'
                    }`}
                  >
                    <span>LoRa Mesh</span>
                    <span className="opacity-70">({nodeCounts.lora})</span>
                  </button>
                </div>
              </div>
            )}

            {uniqueNodes.length === 0 ? (
              <div className="p-4 bg-lb-0a0f1e border border-dashed border-ll-1e293b rounded-xl text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-lb-00ff9d/10 text-lt-00ff9d flex items-center justify-center mx-auto border border-ll-00ff9d/30">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-lt-white">No Nodes in Topology</h4>
                  <p className="text-xs text-lt-64748b font-mono mt-1">
                    {viewMode === 'SPECTATOR'
                      ? 'Waiting for manager or fleet to connect tracking hardware/mobile GPS.'
                      : 'Connect mobile phones or turn on your T-Echo / Heltec node to start tracking live telemetry.'}
                  </p>
                </div>
                {viewMode !== 'SPECTATOR' && onOpenHardwareScan && (
                  <button
                    onClick={onOpenHardwareScan}
                    className="w-full py-2 bg-lb-00ff9d hover:bg-lb-emerald-300 text-lt-020408 font-bold text-xs rounded-lg transition-all font-mono"
                  >
                    Scan / Add Hardware Node
                  </button>
                )}
              </div>
            ) : filteredAndSortedNodes.length === 0 ? (
              <div className="p-4 bg-lb-0a0f1e border border-dashed border-ll-1e293b rounded-xl text-center space-y-2">
                <p className="text-xs font-bold text-lt-slate-300">No nodes match the selected filter.</p>
                <button
                  onClick={() => setNodeFilter('ALL')}
                  className="px-3 py-1 bg-lb-00d4ff/20 hover:bg-lb-00d4ff/30 text-lt-00d4ff border border-ll-00d4ff/40 rounded-lg text-xs font-mono font-bold transition-all"
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
                ? 'bg-lb-purple-500/20 text-lt-purple-300 border-ll-purple-500/40'
                : isPhone
                ? 'bg-lb-00d4ff/20 text-lt-00d4ff border-ll-00d4ff/40'
                : isTablet
                ? 'bg-lb-sky-500/20 text-lt-sky-300 border-ll-sky-500/40'
                : isDeviceGps
                ? 'bg-lb-00ff9d/20 text-lt-00ff9d border-ll-00ff9d/40'
                : isBle
                ? 'bg-lb-cyan-500/20 text-lt-cyan-300 border-ll-cyan-500/40'
                : 'bg-lb-emerald-500/20 text-lt-emerald-300 border-ll-emerald-500/40';

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
                      ? 'bg-lb-amber-950/30 border-ll-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : isPhone || isTablet || isDeviceGps
                      ? 'bg-lb-060e1e border-ll-00d4ff/30'
                      : isBle
                      ? 'bg-lb-cyan-950/20 border-ll-cyan-500/40'
                      : 'bg-lb-0f172a/70 border-ll-1e293b'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded ${
                          isPhone || isTablet
                            ? 'bg-lb-00d4ff/20 text-lt-00d4ff'
                            : isBle
                            ? 'bg-lb-cyan-500/20 text-lt-cyan-400'
                            : 'bg-lb-emerald-500/20 text-lt-emerald-400'
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
                          <span className="text-xs font-bold text-lt-white font-google">{node.longName}</span>
                          <span className={`px-1.5 py-0.2 rounded text-xs font-bold font-mono border ${badgeColor}`}>
                            {badgeText}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-lt-slate-400">
                          {node.id} • {node.hardwareModel || (isPhone ? 'Mobile Device' : 'LoRa Device')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xs font-bold text-lt-emerald-400 block" title="Battery Charge & Voltage">
                        {node.battery !== undefined ? `⚡ ${node.battery}%` : '⚡ —'}{node.voltage ? ` (${node.voltage}V)` : ''}
                      </span>
                      <span className="text-xs text-lt-cyan-300 block" title="Speed and Satellites">
                        {node.speedKt !== undefined && node.speedKt !== null ? `${safeFixed(node.speedKt, 1, '0.0')} kt` : node.satsInView !== undefined ? `🛰️ ${node.satsInView} Sats` : '🛰️ —'}
                      </span>
                      <span className="text-xs text-lt-slate-400">
                        {node.rssi !== undefined ? `${node.rssi} dBm` : '—'} • {node.snr !== undefined ? `${node.snr} SNR` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* BME280 Environmental Sensors strip if available */}
                  {hasBme280 && (
                    <div className="bg-lb-emerald-950/30 border border-ll-emerald-500/30 rounded-lg px-2 py-1 flex items-center justify-between text-xs font-mono text-lt-emerald-300 flex-wrap gap-1">
                      <div className="flex items-center gap-1 text-xs font-bold text-lt-emerald-400">
                        <Gauge className="w-3 h-3 text-lt-emerald-400" />
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
                        <span title="Indoor Air Quality Index" className="text-lt-cyan-300 font-bold">
                          IAQ {node.iaq}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Last Heard & Position Metadata */}
                  <div className="text-xs font-mono text-lt-64748b flex items-center justify-between px-1 bg-lb-060b16/60 py-1 rounded-lg border border-ll-1e293b/40">
                    <span className="flex items-center gap-1 text-lt-slate-300">
                      <Clock className="w-2.5 h-2.5 text-lt-cyan-400" />
                      Last Heard: <strong className="text-lt-00d4ff font-bold">{formatLastHeard(node.lastPingTime)}</strong>
                    </span>
                    {boundBoat ? (
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: boundBoat.color || '#00D4FF' }} />
                        <span className="text-lt-00ff9d font-bold truncate max-w-[130px]">
                          ⚓ {boundBoat.name} ({boundBoat.sailNumber})
                        </span>
                      </div>
                    ) : (
                      <span className="text-lt-amber-400 font-semibold italic bg-lb-amber-400/10 px-1.5 py-0.2 rounded border border-ll-amber-400/20">
                        ⚠️ Unbound Tracker
                      </span>
                    )}
                  </div>

                  {/* Coordinates indicator if active */}
                  {typeof node.lat === 'number' && typeof node.lng === 'number' && (
                    <div className="text-xs font-mono text-lt-64748b flex items-center justify-between px-1">
                      <span>POS: {safeFixed(node.lat, 4)}°N, {safeFixed(node.lng, 4)}°E</span>
                      {node.altitudeMeters !== undefined && <span>ALT: {node.altitudeMeters}m</span>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-ll-slate-800/60 flex-wrap">
                    {viewMode !== 'SPECTATOR' && onOpenNodeBinding && (
                      <button
                        onClick={() => onOpenNodeBinding(node.id, boundBoat?.id)}
                        className={`py-1 px-2 rounded text-xs font-bold font-google flex items-center gap-1 transition-all ${
                          boundBoat
                            ? 'bg-lb-00d4ff/10 text-lt-00d4ff hover:bg-lb-00d4ff/25 border border-ll-00d4ff/30'
                            : 'bg-lb-fbbc04/20 text-lt-fbbc04 hover:bg-lb-fbbc04/30 border border-ll-fbbc04/50'
                        }`}
                        title={`Bind ${node.longName} to a boat in the fleet`}
                      >
                        <Link2 className="w-3 h-3" />
                        <span>{boundBoat ? 'Rebind' : 'Bind Boat'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => onToggleFollow(node.id, node.longName)}
                      className={`flex-1 py-1 rounded text-xs font-bold font-google flex items-center justify-center gap-1 transition-colors ${
                        isFollowing
                          ? 'bg-lb-amber-500 text-lt-slate-950'
                          : 'bg-lb-slate-800 text-lt-cyan-300 hover:bg-lb-slate-700'
                      }`}
                    >
                      <Crosshair className="w-3 h-3" />
                      {isFollowing ? 'Following' : 'Center'}
                    </button>

                    <button
                      onClick={() => onOpenNodeInspector(node, boundBoat || null)}
                      className="py-1 px-2 rounded bg-lb-slate-800 hover:bg-lb-slate-700 text-lt-slate-200 text-xs font-bold font-google flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-lt-cyan-400" />
                      Inspect
                    </button>

                    {viewMode !== 'SPECTATOR' && onDeleteNode && (
                      <button
                        onClick={() => onDeleteNode(node.id)}
                        className="p-1.5 rounded bg-lb-slate-800/80 hover:bg-lb-red-500/20 text-lt-slate-400 hover:text-lt-red-400 border border-ll-slate-700/50 hover:border-ll-red-500/40 transition-colors"
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

