import React, { useState, useMemo } from 'react';
import { Boat, MeshtasticNode, RaceClass, RaceClassDefinition, RaceState, DeviceGpsState } from '../types/regatta';
import {
  Sailboat,
  Trophy,
  Radio,
  AlertTriangle,
  Cpu,
  Crosshair,
  Eye,
  Bluetooth,
  Navigation,
  Smartphone,
  Tablet,
  Trash2,
  Plus,
  Edit2,
  Clock,
  Link2,
  PanelLeftClose,
  X,
  Gauge,
  ArrowUpDown,
  SlidersHorizontal,
  QrCode,
  Settings,
} from 'lucide-react';
import { formatBattery, formatLastHeard, safeFixed, trackerFreshness } from '../utils/formatters';
import { Button } from './ui/Button';
import { sameNodeId } from '../utils/nodeId';
import { deduplicateNodes } from '../services/meshtasticBleMqttService';

interface LeaderboardSidebarProps {
  boats: Boat[];
  nodes: MeshtasticNode[];
  raceState: RaceState;
  selectedBoatId: string | null;
  onSelectBoat: (boatId: string) => void;
  /** Opens the Connect device flow for one boat (Add/Change tracker) or one heard tracker (Bind/Rebind) */
  onConnectTracker?: (nodeId?: string, boatId?: string) => void;
  /** Opens the Connect device flow */
  onOpenConnectDevice?: () => void;
  onOpenHybridTrackers?: () => void;
  followedTargetId: string | null;
  onToggleFollow: (id: string, name: string) => void;
  onOpenNodeInspector: (node: MeshtasticNode | null, boat: Boat | null) => void;
  deviceGps?: DeviceGpsState;
  onToggleDeviceGps?: () => void;
  onDeleteNode?: (nodeId: string) => void;
  onOpenAddBoat?: () => void;
  onEditBoat?: (boat: Boat) => void;
  onDeleteBoat?: (boatId: string) => void;
  onOpenBoatQr?: (boatId: string) => void;
  raceClasses?: RaceClassDefinition[];
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
  onConnectTracker,
  onOpenConnectDevice,
  onOpenHybridTrackers,
  followedTargetId,
  onToggleFollow,
  onOpenNodeInspector,
  deviceGps,
  onToggleDeviceGps,
  onDeleteNode,
  onOpenAddBoat,
  onEditBoat,
  onDeleteBoat,
  onOpenBoatQr,
  raceClasses = [],
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
  // This event's trackers by default: phones and other fleet devices, the tracker connected to
  // this device, and LoRa nodes bound to a boat here. Other LoRa/MQTT nodes the radio or the
  // public stream happens to hear are "nearby public nodes", shown only on request.
  const [showNearbyNodes, setShowNearbyNodes] = useState(false);
  const isNearbyPublicNode = (n: MeshtasticNode) => {
    const isFleetDevice = n.isDeviceGps || n.connectionType === 'PHONE' || n.connectionType === 'TABLET' || n.connectionType === 'DEVICE_GPS' || n.connectionType === 'PC';
    if (isFleetDevice || n.isBluetoothConnected) return false;
    return !boats.some((b) => (n.boundBoatId && b.id === n.boundBoatId) || sameNodeId(b.nodeId, n.id));
  };

  const allNodes = useMemo(() => {
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

  const nearbyNodeCount = useMemo(() => allNodes.filter(isNearbyPublicNode).length, [allNodes, boats]);
  const uniqueNodes = useMemo(
    () => (showNearbyNodes ? allNodes : allNodes.filter((n) => !isNearbyPublicNode(n))),
    [allNodes, boats, showNearbyNodes]
  );

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
        const aBound = (a.boundBoatId || boats.some((boat) => boat.id === a.boundBoatId || boat.nodeId === a.id)) ? 1 : 0;
        const bBound = (b.boundBoatId || boats.some((boat) => boat.id === b.boundBoatId || boat.nodeId === b.id)) ? 1 : 0;
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
      className={`flex flex-col text-ink select-none shadow-2xl transition-all ${
        isOverlay
          ? 'w-full max-w-lg max-h-[calc(100vh-130px)] sm:max-h-[82vh] landscape:max-h-[98dvh] landscape:h-[98dvh] h-full rounded-2xl sm:rounded-3xl bg-surface/90 backdrop-blur-md border border-line/80 overflow-hidden min-h-0'
          : 'w-80 sm:w-88 bg-canvas border-r border-line shrink-0 h-full overflow-hidden'
      }`}
    >
      {/* Navigation Tabs & Collapse Control */}
      <div
        className={`flex border-b shrink-0 items-center ${
          isOverlay ? 'border-line/80 bg-surface/75' : 'border-line bg-surface/80'
        }`}
      >
        <button
          onClick={() => setActiveTab('LEADERBOARD')}
          className={`flex-1 py-3 landscape:py-1.5 px-3 landscape:px-2 text-xs font-bold whitespace-nowrap flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'LEADERBOARD'
              ? 'border-accent text-accent bg-accent/5'
              : 'border-transparent text-ink-muted hover:text-ink-muted'
          }`}
        >
          <Sailboat className="w-3.5 h-3.5" />
          Leaderboard ({sortedBoats.length})
        </button>
        <button
          onClick={() => setActiveTab('MESH_NODES')}
          className={`flex-1 py-3 landscape:py-1.5 px-3 landscape:px-2 text-xs font-bold whitespace-nowrap flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'MESH_NODES'
              ? 'border-accent text-accent bg-accent/5'
              : 'border-transparent text-ink-muted hover:text-ink-muted'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          Mesh Nodes ({uniqueNodes.length})
        </button>

        {!isOverlay && onCollapse && (
          <button
            onClick={onCollapse}
            className="p-3 text-ink-muted hover:text-accent hover:bg-raised/70 border-l border-line transition-colors shrink-0"
            title="Collapse Sidebar Dashboard (Slide to Left)"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="p-2.5 text-ink-muted hover:text-ink hover:bg-ink/10 transition-colors shrink-0 border-l border-line/80 mr-1"
            title="Close Rank & Mesh Nodes"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tab 1: Leaderboard View */}
      {activeTab === 'LEADERBOARD' && (
        <div className="p-3 border-b border-line bg-surface/50 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0 flex-wrap gap-1">
            <h2 className="text-xs text-ink-muted font-bold">
              Standings (IRC/ORC)
            </h2>
            {/* Filters the leaderboard only; the race console's class tabs pick the active class */}
            <div role="group" aria-label="Show class" className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-ink-muted mr-0.5">Show</span>
              <button
                onClick={() => setFilterClass('ALL')}
                className={`text-xs px-1.5 py-0.5 rounded  transition-all ${
                  filterClass === 'ALL'
                    ? 'bg-accent text-on-accent font-bold'
                    : 'bg-raised/60 text-ink-muted hover:text-ink'
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
                    className={`text-xs px-1.5 py-0.5 rounded  transition-all flex items-center gap-1 ${
                      filterClass === cls.name
                        ? 'bg-accent text-on-accent font-bold'
                        : 'bg-raised/60 text-ink-muted hover:text-ink'
                    }`}
                    title={cls.description || cls.name}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        clsState.status === 'RACING'
                          ? 'bg-success-ink '
                          : clsState.status === 'FINISHED'
                          ? 'bg-ink'
                          : clsState.status === 'COUNTDOWN'
                          ? 'bg-warning-ink '
                          : 'bg-raised'
                      }`}
                    />
                    <span>{cls.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fleet Management & Race Status Toolbar */}
          <div className="p-2 bg-canvas rounded-xl border border-line mb-2 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'RACING'
                      ? 'bg-success-ink '
                      : (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'FINISHED'
                      ? 'bg-ink'
                      : 'bg-warning-ink'
                  }`}
                />
                <span className="text-xs font-bold text-ink">
                  {filterClass === 'ALL' ? raceState.activeClass : filterClass}:
                </span>
                <span
                  className={`text-xs  font-bold ${
                    (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'RACING'
                      ? 'text-success-ink'
                      : (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'FINISHED'
                      ? 'text-ink'
                      : 'text-warning-ink'
                  }`}
                >
                  {(raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'RACING'
                    ? 'Racing'
                    : (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'FINISHED'
                    ? 'Finished'
                    : (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'COUNTDOWN'
                    ? 'Countdown'
                    : 'Pre-start'}
                </span>
              </div>

              {viewMode !== 'SPECTATOR' && onEndRace && (raceState.classStates?.[filterClass === 'ALL' ? raceState.activeClass : filterClass]?.status || raceState.status) === 'RACING' && (
                <button
                  onClick={() => onEndRace(filterClass === 'ALL' ? raceState.activeClass : filterClass)}
                  className="text-xs font-bold px-2 py-0.5 rounded bg-danger/80 hover:brightness-110 text-ink transition-all shadow-sm flex items-center gap-1"
                  title="Finish active race class and lock final results"
                >
                  <span>Finish {filterClass === 'ALL' ? raceState.activeClass : filterClass}</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-line/60 text-xs text-ink-muted">
              <span>Fleet: <strong className="text-ink">{sortedBoats.length}</strong> boats</span>
              <div className="flex items-center gap-1.5">
                {onOpenBoatQr && boats.length > 0 && (
                  <button
                    onClick={() => onOpenBoatQr(boats[0]?.id || '')}
                    className="font-bold text-accent bg-accent/15 hover:bg-accent/25 border border-accent/40 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all text-xs"
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
                    className="font-bold text-warning-ink bg-warning-ink/20 hover:bg-warning-ink/30 border border-warning-ink/40 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
                    title="View official finish results and scoring breakdown"
                  >
                    <Trophy className="w-2.5 h-2.5 text-warning-ink" />
                    <span>Results</span>
                  </button>
                )}

                {viewMode !== 'SPECTATOR' && onOpenAddBoat && (
                  <button
                    onClick={onOpenAddBoat}
                    className="min-h-8 text-xs font-bold text-on-accent bg-accent hover:brightness-110 px-2.5 rounded-control flex items-center gap-1 transition-[filter]"
                    title="Add a new racing boat to the regatta"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add boat</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0 pb-8 overscroll-contain touch-pan-y">
            {sortedBoats.length === 0 ? (
              <div className="p-4 bg-surface border border-dashed border-line rounded-xl text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto border border-accent/30">
                  <Bluetooth className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink">No boats yet</h4>
                  <p className="text-xs text-ink-muted mt-1">
                    {viewMode === 'SPECTATOR'
                      ? 'Boats appear here once the race officer adds them.'
                      : 'Add boats, or skippers can join themselves with Track in the header.'}
                  </p>
                </div>
                {viewMode !== 'SPECTATOR' && onOpenAddBoat && (
                  <button
                    onClick={onOpenAddBoat}
                    className="w-full py-2 bg-accent hover:brightness-110 text-on-accent font-bold text-xs rounded-lg transition-all shadow-md"
                  >
                    Add boat
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
              const boundNode = nodes.find((n) => n.boundBoatId === boat.id || sameNodeId(n.id, boat.nodeId));

              const boatClsState = raceState.classStates?.[boat.class] || (raceState.activeClass === boat.class ? {
                status: raceState.status,
                countdownSeconds: raceState.countdownSeconds,
                startSequenceActive: raceState.startSequenceActive
              } : undefined);

              const isClassInPreStartOrCountdown = boatClsState
                ? (boatClsState.status === 'PRE_START' || boatClsState.status === 'COUNTDOWN' || (typeof boatClsState.countdownSeconds === 'number' && boatClsState.countdownSeconds > 0))
                : (raceState.status === 'PRE_START' || raceState.status === 'COUNTDOWN' || (typeof raceState.countdownSeconds === 'number' && raceState.countdownSeconds > 0));

              const canManage = viewMode !== 'SPECTATOR';
              const showActions = isSelected || isFollowing;
              const freshness = boundNode ? trackerFreshness(boundNode.lastPingTime) : null;
              const isPhone = boundNode && (boundNode.connectionType === 'PHONE' || boundNode.isDeviceGps);

              return (
                <div
                  key={boat.id}
                  onClick={() => onSelectBoat(boat.id)}
                  aria-current={isSelected || undefined}
                  className={`p-3 rounded-container border transition-colors cursor-pointer ${
                    isOcs
                      ? 'bg-surface border-danger-ink/60'
                      : isFollowing
                      ? 'bg-surface border-warning-ink'
                      : isSelected
                      ? 'bg-surface border-accent'
                      : 'bg-surface border-line hover:border-ink-muted/50'
                  }`}
                >
                  {/* Identity and status */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink-muted w-4 text-right shrink-0">{rank + 1}</span>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: boat.color }} aria-hidden="true" />
                    <span className="text-sm font-bold text-ink truncate min-w-0 flex-1" title={boat.name}>
                      {boat.name}
                    </span>
                    {isClassInPreStartOrCountdown || boat.status === 'PRE_START' ? (
                      <span className="text-xs font-semibold text-warning-ink shrink-0">Pre-start</span>
                    ) : boat.status === 'FINISHED' ? (
                      <span className="text-xs font-semibold text-ink-muted shrink-0">Finished</span>
                    ) : isOcs ? (
                      <span className="text-xs font-bold text-danger-ink shrink-0 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                        OCS
                      </span>
                    ) : boat.status === 'RET' || boat.status === 'DNF' || boat.status === 'DNS' || boat.status === 'DSQ' ? (
                      <span className="text-xs font-bold text-danger-ink shrink-0">{boat.status}</span>
                    ) : (
                      <span className={`text-xs font-bold tabular-nums shrink-0 ${rank === 0 ? 'text-success-ink' : 'text-ink-muted'}`}>
                        {diffFormatted}
                      </span>
                    )}
                  </div>

                  {/* Sail number and rating */}
                  <div className="mt-0.5 pl-[3.25rem] text-xs text-ink-muted truncate">
                    {[boat.sailNumber, `${boat.handicapSystem} ${safeFixed(boat.handicapRating, 3, '1.000')}`].filter(Boolean).join(' · ')}
                  </div>

                  {/* Live numbers */}
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-ink-muted">SOG</div>
                      <div className="font-bold text-ink tabular-nums">{safeFixed(boat.sog, 1, '0.0')} kt</div>
                    </div>
                    <div>
                      <div className="text-ink-muted">VMG</div>
                      <div className="font-bold text-ink tabular-nums">{safeFixed(boat.vmg, 1, '0.0')} kt</div>
                    </div>
                    <div>
                      <div className="text-ink-muted">To mark</div>
                      <div className="font-bold text-ink tabular-nums">{safeFixed(boat.dtw, 2, '0.00')} NM</div>
                    </div>
                  </div>

                  {/* Tracker */}
                  <div className="mt-2 flex items-center gap-2 text-xs min-w-0">
                    {boundNode ? (
                      <>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            freshness === 'live' ? 'bg-success-ink' : freshness === 'stale' ? 'bg-warning-ink' : 'bg-ink-muted'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="text-ink truncate min-w-0">
                          {isPhone ? 'Phone' : 'Tracker'} <strong>{boundNode.shortName || boundNode.id}</strong>
                          <span className="text-ink-muted">
                            {boundNode.battery !== undefined ? ` · ${formatBattery(boundNode.battery)}` : ''}
                            {boundNode.gpsFix === false ? ' · no GPS fix' : ''}
                          </span>
                        </span>
                        <span
                          className={`ml-auto shrink-0 ${freshness === 'live' ? 'text-ink-muted' : 'text-warning-ink'}`}
                          title={freshness === 'live' ? 'Tracker is reporting' : 'No recent report from this tracker'}
                        >
                          {freshness === 'offline' ? `Offline · ${formatLastHeard(boundNode.lastPingTime)}` : formatLastHeard(boundNode.lastPingTime)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-ink-muted">No tracker, position not live</span>
                        {canManage && onConnectTracker && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onConnectTracker(undefined, boat.id);
                            }}
                            className="ml-auto shrink-0 font-semibold text-accent hover:underline"
                          >
                            Add tracker
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions: only on the boat you selected or follow, so the list stays readable */}
                  {showActions && (
                    <div className="mt-3 pt-3 border-t border-line flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant={isFollowing ? 'primary' : 'secondary'}
                        icon={<Crosshair />}
                        onClick={() => onToggleFollow(boat.id, boat.name)}
                        aria-pressed={isFollowing}
                        className="flex-1"
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </Button>
                      <Button icon={<Eye />} aria-label={`Inspect ${boat.name}`} title="Inspect" onClick={() => onOpenNodeInspector(boundNode || null, boat)} />
                      {canManage && onOpenBoatQr && (isAdmin || !boat.nodeId) && (
                        <Button icon={<QrCode />} aria-label={`QR code for ${boat.name}`} title="QR code" onClick={() => onOpenBoatQr(boat.id)} />
                      )}
                      {canManage && boundNode && onConnectTracker && (
                        <Button icon={<Link2 />} aria-label={`Change tracker for ${boat.name}`} title="Change tracker" onClick={() => onConnectTracker(undefined, boat.id)} />
                      )}
                      {canManage && onEditBoat && (
                        <Button icon={<Edit2 />} aria-label={`Edit ${boat.name}`} title="Edit" onClick={() => onEditBoat(boat)} />
                      )}
                      {canManage && onDeleteBoat && (
                        <Button
                          variant="ghost"
                          icon={<Trash2 />}
                          aria-label={`Delete ${boat.name}`}
                          title="Delete"
                          onClick={() => onDeleteBoat(boat.id)}
                          className="text-danger-ink"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Node Health & Mesh Topography */}
      {activeTab === 'MESH_NODES' && (
        <div className="p-3 border-b border-line bg-surface/50 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="text-xs text-ink-muted font-bold">
              MESHTASTIC NODES
            </h2>
          </div>

          <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0 pb-8 overscroll-contain touch-pan-y">
            {/* User Device GPS Status Card */}
            <div className={`p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
              deviceGps?.active
                ? 'bg-accent/10 border-accent/60 '
                : 'bg-surface/70 border-line'
            }`}>
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={onOpenHybridTrackers}
                  title="Click to open Hybrid Fleet & Multi-Device Tracker setup"
                >
                  <div className={`p-1.5 rounded ${deviceGps?.active ? 'bg-accent/20 text-accent' : 'bg-raised text-ink-muted'}`}>
                    <Navigation className={`w-3.5 h-3.5 ${deviceGps?.active ? '' : ''}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-ink group-hover:text-accent transition-colors">
                        {deviceGps?.profile?.deviceName || 'User Device GPS'}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-xs font-bold  ${
                        deviceGps?.active ? 'bg-accent/20 text-accent' : 'bg-raised text-ink-muted'
                      }`}>
                        {deviceGps?.active ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>
                    <span className="text-xs text-ink-muted">
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
                    className={`px-2 py-1 rounded text-xs  font-bold transition-all ${
                      deviceGps?.active
                        ? 'bg-accent text-on-accent'
                        : 'bg-raised hover:bg-raised text-ink'
                    }`}
                  >
                    {deviceGps?.active ? 'OFF' : 'ON'}
                  </button>
                  {viewMode !== 'SPECTATOR' && onOpenHybridTrackers && (
                    <button
                      onClick={onOpenHybridTrackers}
                      className="p-1 rounded bg-raised hover:bg-raised text-accent text-xs"
                      title="Manage Hybrid Fleet Trackers"
                      aria-label="Manage fleet trackers"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {deviceGps?.active && deviceGps.lat && (
                <div className="flex justify-between items-center text-xs text-success-ink pt-1 border-t border-line">
                  <span>Speed: {safeFixed(deviceGps.speedKt, 1, '0.0')} kt</span>
                  <span>Accuracy: ±{deviceGps.accuracy ?? 5}m</span>
                  <span>Heading: {deviceGps.headingDeg ?? 0}°</span>
                </div>
              )}

              {deviceGps?.error && (
                <p className="text-xs text-danger-ink pt-1 border-t border-danger-ink/30">
                  {deviceGps.error}
                </p>
              )}
            </div>
            {/* MESH NODES MANAGEMENT TOOLBAR */}
            <div className="flex items-center justify-between gap-2 p-2 bg-surface rounded-xl border border-line">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-ink-muted font-bold">
                  Mesh Nodes ({filteredAndSortedNodes.length}{nodeFilter !== 'ALL' ? `/${uniqueNodes.length}` : ''})
                </span>
                {uniqueNodes.some((n) => !n.isDeviceGps && !n.isBluetoothConnected && n.connectionType !== 'BLE' && n.connectionType !== 'PHONE' && n.connectionType !== 'TABLET' && (n.id.startsWith('node-') || n.id.startsWith('mock-'))) && (
                  <span className="text-xs bg-raised/20 text-ink border border-line/30 px-1.5 py-0.2 rounded font-bold">
                    Demo Active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {viewMode !== 'SPECTATOR' && onOpenConnectDevice && (
                  <Button variant="primary" icon={<Plus />} onClick={onOpenConnectDevice}>
                    Connect device
                  </Button>
                )}
              </div>
            </div>

            {nearbyNodeCount > 0 && (
              <label className="flex items-center gap-2 px-2 text-xs text-ink-muted">
                <input type="checkbox" checked={showNearbyNodes} onChange={(e) => setShowNearbyNodes(e.target.checked)} />
                Show nearby public nodes ({nearbyNodeCount})
              </label>
            )}

            {/* MESH NODES FILTER & SORT CONTROLS */}
            {uniqueNodes.length > 0 && (
              <div className="p-2 bg-surface rounded-xl border border-line flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1 font-bold text-ink">
                    <SlidersHorizontal className="w-3 h-3 text-accent" />
                    <span>Filter:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3 text-success-ink" />
                    <span className="text-ink-muted">Sort:</span>
                    <select
                      value={nodeSort}
                      onChange={(e) => setNodeSort(e.target.value as any)}
                      className="bg-canvas text-success-ink text-xs font-bold border border-line rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-success-ink/40"
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
                    className={`px-2 py-0.5 rounded-lg text-xs  font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'ALL'
                        ? 'bg-accent/20 text-accent border-accent/60 '
                        : 'bg-canvas text-ink-muted border-line hover:text-ink'
                    }`}
                  >
                    <span>All</span>
                    <span className="opacity-70">({nodeCounts.all})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('WEB_GPS')}
                    className={`px-2 py-0.5 rounded-lg text-xs  font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'WEB_GPS'
                        ? 'bg-success-ink/20 text-success-ink border-success-ink/60 '
                        : 'bg-canvas text-ink-muted border-line hover:text-ink'
                    }`}
                  >
                    <span>Web GPS</span>
                    <span className="opacity-70">({nodeCounts.web})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('PHONE_GPS')}
                    className={`px-2 py-0.5 rounded-lg text-xs  font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'PHONE_GPS'
                        ? 'bg-accent/20 text-accent border-accent/60 '
                        : 'bg-canvas text-ink-muted border-line hover:text-ink'
                    }`}
                  >
                    <span>Phone GPS</span>
                    <span className="opacity-70">({nodeCounts.phone})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('BLE')}
                    className={`px-2 py-0.5 rounded-lg text-xs  font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'BLE'
                        ? 'bg-accent/20 text-accent border-accent/60 '
                        : 'bg-canvas text-ink-muted border-line hover:text-ink'
                    }`}
                  >
                    <span>BLE</span>
                    <span className="opacity-70">({nodeCounts.ble})</span>
                  </button>

                  <button
                    onClick={() => setNodeFilter('LORA_MESH')}
                    className={`px-2 py-0.5 rounded-lg text-xs  font-bold transition-all border flex items-center gap-1 ${
                      nodeFilter === 'LORA_MESH'
                        ? 'bg-success-ink/20 text-success-ink border-success-ink/60 '
                        : 'bg-canvas text-ink-muted border-line hover:text-ink'
                    }`}
                  >
                    <span>LoRa Mesh</span>
                    <span className="opacity-70">({nodeCounts.lora})</span>
                  </button>
                </div>
              </div>
            )}

            {uniqueNodes.length === 0 ? (
              <div className="p-4 bg-surface border border-dashed border-line rounded-xl text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-success-ink/10 text-success-ink flex items-center justify-center mx-auto border border-success-ink/30">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink">No trackers for this event yet</h4>
                  <p className="text-xs text-ink-muted mt-1">
                    {viewMode === 'SPECTATOR'
                      ? 'Trackers appear here once the race office connects them.'
                      : 'Connect a LoRa tracker, or have skippers share their phone position with Track in the header.'}
                  </p>
                </div>
                {viewMode !== 'SPECTATOR' && onOpenConnectDevice && (
                  <Button variant="primary" className="w-full" icon={<Plus />} onClick={onOpenConnectDevice}>
                    Connect device
                  </Button>
                )}
              </div>
            ) : filteredAndSortedNodes.length === 0 ? (
              <div className="p-4 bg-surface border border-dashed border-line rounded-xl text-center space-y-2">
                <p className="text-xs font-bold text-ink">No nodes match the selected filter.</p>
                <button
                  onClick={() => setNodeFilter('ALL')}
                  className="px-3 py-1 bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 rounded-lg text-xs font-bold transition-all"
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
                ? 'bg-raised/20 text-ink border-line/40'
                : isPhone
                ? 'bg-accent/20 text-accent border-accent/40'
                : isTablet
                ? 'bg-accent/20 text-accent border-accent/40'
                : isDeviceGps
                ? 'bg-success-ink/20 text-success-ink border-success-ink/40'
                : isBle
                ? 'bg-accent/20 text-accent border-accent/40'
                : 'bg-success-ink/20 text-success-ink border-success-ink/40';

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
                      ? 'bg-surface/30 border-warning-ink/60 '
                      : isPhone || isTablet || isDeviceGps
                      ? 'bg-canvas border-accent/30'
                      : isBle
                      ? 'bg-surface/20 border-accent/40'
                      : 'bg-surface/70 border-line'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1.5 rounded ${
                          isPhone || isTablet
                            ? 'bg-accent/20 text-accent'
                            : isBle
                            ? 'bg-accent/20 text-accent'
                            : 'bg-success-ink/20 text-success-ink'
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
                          <span className="text-xs font-bold text-ink">{node.longName}</span>
                          <span className={`px-1.5 py-0.2 rounded text-xs font-bold  border ${badgeColor}`}>
                            {badgeText}
                          </span>
                        </div>
                        <span className="text-xs text-ink-muted">
                          {node.id} • {node.hardwareModel || (isPhone ? 'Mobile Device' : 'LoRa Device')}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-success-ink block" title="Battery Charge & Voltage">
                        Battery {formatBattery(node.battery)}{node.voltage ? ` (${node.voltage}V)` : ''}
                      </span>
                      <span className="text-xs text-accent block" title="Speed and Satellites">
                        {node.speedKt !== undefined && node.speedKt !== null ? `${safeFixed(node.speedKt, 1, '0.0')} kt` : node.satsInView !== undefined ? `${node.satsInView} satellites` : 'Satellites —'}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {node.rssi !== undefined ? `${node.rssi} dBm` : '—'} • {node.snr !== undefined ? `${node.snr} SNR` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* BME280 Environmental Sensors strip if available */}
                  {hasBme280 && (
                    <div className="bg-surface/30 border border-success-ink/30 rounded-lg px-2 py-1 flex items-center justify-between text-xs text-success-ink flex-wrap gap-1">
                      <div className="flex items-center gap-1 text-xs font-bold text-success-ink">
                        <Gauge className="w-3 h-3 text-success-ink" />
                        <span>BME280:</span>
                      </div>
                      {node.barometricPressure !== undefined && node.barometricPressure !== null && (
                        <span title="Barometric Atmospheric Pressure">
                          {safeFixed(node.barometricPressure, 1)} hPa
                        </span>
                      )}
                      {node.temperature !== undefined && node.temperature !== null && (
                        <span title="Ambient Temperature">
                          {safeFixed(node.temperature, 1)}°C
                        </span>
                      )}
                      {node.humidity !== undefined && node.humidity !== null && (
                        <span title="Relative Humidity">
                          {safeFixed(node.humidity, 1)}% RH
                        </span>
                      )}
                      {node.iaq !== undefined && (
                        <span title="Indoor Air Quality Index" className="text-accent font-bold">
                          IAQ {node.iaq}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Last Heard & Position Metadata */}
                  <div className="text-xs text-ink-muted flex items-center justify-between px-1 bg-canvas/60 py-1 rounded-lg border border-line/40">
                    <span className="flex items-center gap-1 text-ink">
                      <Clock className="w-2.5 h-2.5 text-accent" />
                      Last Heard: <strong className="text-accent font-bold">{formatLastHeard(node.lastPingTime)}</strong>
                    </span>
                    {boundBoat ? (
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: boundBoat.color || '#00D4FF' }} />
                        <span className="text-success-ink font-bold truncate max-w-[130px]">
                          {boundBoat.name} ({boundBoat.sailNumber})
                        </span>
                      </div>
                    ) : (
                      <span className="text-warning-ink font-semibold italic bg-warning-ink/10 px-1.5 py-0.2 rounded border border-warning-ink/20">
                        Unbound Tracker
                      </span>
                    )}
                  </div>

                  {/* Coordinates indicator if active */}
                  {typeof node.lat === 'number' && typeof node.lng === 'number' && (
                    <div className="text-xs text-ink-muted flex items-center justify-between px-1">
                      <span>POS: {safeFixed(node.lat, 4)}°N, {safeFixed(node.lng, 4)}°E</span>
                      {node.altitudeMeters !== undefined && <span>ALT: {node.altitudeMeters}m</span>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-line/60 flex-wrap">
                    {viewMode !== 'SPECTATOR' && onConnectTracker && (
                      <button
                        onClick={() => onConnectTracker(node.id, boundBoat?.id)}
                        className={`py-1 px-2 rounded text-xs font-bold flex items-center gap-1 transition-all ${
                          boundBoat
                            ? 'bg-accent/10 text-accent hover:bg-accent/25 border border-accent/30'
                            : 'bg-warning-ink/20 text-warning-ink hover:bg-warning-ink/30 border border-warning-ink/50'
                        }`}
                        title={`Bind ${node.longName} to a boat in the fleet`}
                      >
                        <Link2 className="w-3 h-3" />
                        <span>{boundBoat ? 'Rebind' : 'Bind Boat'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => onToggleFollow(node.id, node.longName)}
                      className={`flex-1 py-1 rounded text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                        isFollowing
                          ? 'bg-warning-ink text-canvas'
                          : 'bg-raised text-accent hover:bg-raised'
                      }`}
                    >
                      <Crosshair className="w-3 h-3" />
                      {isFollowing ? 'Following' : 'Center'}
                    </button>

                    <button
                      onClick={() => onOpenNodeInspector(node, boundBoat || null)}
                      className="py-1 px-2 rounded bg-raised hover:bg-raised text-ink text-xs font-bold flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-accent" />
                      Inspect
                    </button>

                    {viewMode !== 'SPECTATOR' && onDeleteNode && (
                      <button
                        onClick={() => onDeleteNode(node.id)}
                        className="p-1.5 rounded bg-raised/80 hover:bg-danger/20 text-ink-muted hover:text-danger-ink border border-line/50 hover:border-danger-ink/40 transition-colors"
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

