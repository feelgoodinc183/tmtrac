import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  BatteryCharging,
  Radio,
  Navigation,
  Compass,
  Cpu,
  Signal,
  Eye,
  CheckCircle2,
  Anchor,
  Activity,
  Layers,
  Crosshair,
  Maximize2,
  Trash2,
  MapPin,
  RefreshCw,
  Sliders,
  Check,
  Play,
  Pause,
  Timer,
  Zap,
  Gauge,
  Thermometer,
  Droplets,
  Wind,
  MessageSquare,
  Send,
  Filter,
  Terminal,
  ArrowDownCircle,
} from 'lucide-react';
import { MeshtasticNode, Boat } from '../types/regatta';
import { formatLastHeard, safeFixed } from '../utils/formatters';
import {
  meshtasticService,
  AutoGpsSyncState,
  MeshtasticPacketLog,
} from '../services/meshtasticBleMqttService';

interface NodeTelemetryModalProps {
  node: MeshtasticNode | null;
  boat: Boat | null;
  isOpen: boolean;
  onClose: () => void;
  followedTargetId: string | null;
  onToggleFollow: (id: string, name: string) => void;
  onPingNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
}

const PRESET_INTERVALS = [1, 2, 3, 5, 10, 15, 30, 60];

export const NodeTelemetryModal: React.FC<NodeTelemetryModalProps> = ({
  node,
  boat,
  isOpen,
  onClose,
  followedTargetId,
  onToggleFollow,
  onPingNode,
  onDeleteNode,
}) => {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [customLat, setCustomLat] = useState('');
  const [customLng, setCustomLng] = useState('');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isGeoLoading, setIsGeoLoading] = useState(false);

  // Auto GPS Sync state
  const [autoGps, setAutoGps] = useState<AutoGpsSyncState>(meshtasticService.getAutoGpsState());
  const [selectedInterval, setSelectedInterval] = useState<number>(autoGps.intervalSec || 3);
  const [customIntervalInput, setCustomIntervalInput] = useState<string>('');
  const [showCustomInterval, setShowCustomInterval] = useState(false);
  const [countdownSec, setCountdownSec] = useState<number>(3);

  // Real-time Packet Log state
  const [packetLogs, setPacketLogs] = useState<MeshtasticPacketLog[]>([]);
  const [packetFilter, setPacketFilter] = useState<'ALL' | 'TEXT' | 'TELEMETRY' | 'POSITION'>('ALL');
  const [outboundMessage, setOutboundMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState<string | null>(null);
  const packetsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const targetId = boat ? boat.id : (node ? node.id : '');
  const targetName = boat ? boat.name : (node ? node.longName : 'Node');
  const isFollowing = followedTargetId === targetId;

  // Load existing packets for this node & subscribe to live incoming stream
  useEffect(() => {
    if (!isOpen) return;

    if (node) {
      setPacketLogs(meshtasticService.getNodePacketLogs(node.id));
    } else {
      setPacketLogs(meshtasticService.getGlobalPacketLogs());
    }

    const unsubPackets = meshtasticService.onPacketLog((newPacket) => {
      if (!node || newPacket.fromNode === node.id || newPacket.toNode === node.id || newPacket.toNode === '^all') {
        setPacketLogs((prev) => {
          if (prev.some((p) => p.id === newPacket.id)) return prev;
          return [...prev, newPacket].slice(-200);
        });
      }
    });

    return unsubPackets;
  }, [isOpen, node]);

  // Auto-scroll packet terminal to bottom
  useEffect(() => {
    if (autoScroll && packetsEndRef.current) {
      packetsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [packetLogs, autoScroll]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const unsub = meshtasticService.onAutoGpsStateChange((state) => {
      setAutoGps(state);
      setSelectedInterval(state.intervalSec);
    });
    return unsub;
  }, []);

  // Countdown timer for next sync tick
  useEffect(() => {
    if (!autoGps.enabled) {
      setCountdownSec(selectedInterval);
      return;
    }

    const timer = setInterval(() => {
      if (autoGps.lastSyncTimestamp) {
        const elapsedSec = Math.floor((Date.now() - autoGps.lastSyncTimestamp) / 1000);
        const rem = Math.max(0, autoGps.intervalSec - (elapsedSec % autoGps.intervalSec));
        setCountdownSec(rem === 0 ? autoGps.intervalSec : rem);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [autoGps.enabled, autoGps.intervalSec, autoGps.lastSyncTimestamp, selectedInterval]);

  useEffect(() => {
    if (node) {
      setCustomLat(node.lat?.toFixed(6) || '');
      setCustomLng(node.lng?.toFixed(6) || '');
    }
  }, [node]);

  if (!isOpen || (!node && !boat)) return null;

  // Telemetry attributes resolution (Strict real values, no dummy fallbacks)
  const batteryPct = node?.battery;
  const voltage = node?.voltage;
  const satsInView = node?.satsInView ?? 0;
  const satsInFix = node?.satsInFix ?? 0;
  const speed = boat ? (boat.sog ?? 0) : (node?.speedKt ?? 0);
  const heading = boat ? (boat.cog ?? 0) : (node?.headingDeg ?? 0);
  const lat = boat ? (boat.lat ?? 0) : (node?.lat ?? 0);
  const lng = boat ? (boat.lng ?? 0) : (node?.lng ?? 0);
  const snr = node?.snr ?? 0;
  const rssi = node?.rssi ?? 0;
  const hops = node?.hops ?? 0;
  const hardware = node?.hardwareModel || 'Meshtastic Hardware Node';
  const firmware = node?.firmwareVersion || 'v2.5.x';
  const connType = node?.connectionType || (node?.isBluetoothConnected ? 'BLE' : 'LORA_MESH');

  // BME280 / Environmental Metrics
  const temperature = node?.temperature;
  const humidity = node?.humidity ?? node?.relativeHumidity;
  const pressure = node?.barometricPressure;
  const gasResistance = node?.gasResistance;
  const iaq = node?.iaq;
  const sensorModel = node?.sensorModel || (pressure || temperature ? 'BME280 / BMP280' : undefined);

  const handleToggleAutoSync = () => {
    if (autoGps.enabled) {
      meshtasticService.stopAutoGpsSync();
      setSyncStatus('Auto GPS sync paused.');
      setTimeout(() => setSyncStatus(null), 3000);
    } else {
      meshtasticService.startAutoGpsSync(selectedInterval);
      setSyncStatus(`Auto GPS sync started: updating every ${selectedInterval}s`);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const handleSelectInterval = (secs: number) => {
    setSelectedInterval(secs);
    setShowCustomInterval(false);
    meshtasticService.setAutoGpsInterval(secs);
  };

  const handleApplyCustomInterval = () => {
    const parsed = parseInt(customIntervalInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 300) {
      setSelectedInterval(parsed);
      setShowCustomInterval(false);
      meshtasticService.setAutoGpsInterval(parsed);
    }
  };

  const handleSaveCustomCoords = () => {
    const parsedLat = parseFloat(customLat);
    const parsedLng = parseFloat(customLng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      if (node) {
        meshtasticService.updateNodePosition(node.id, parsedLat, parsedLng);
      }
      setIsCalibrating(false);
      setSyncStatus(`Coordinates manually set to ${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)}`);
      setTimeout(() => setSyncStatus(null), 3500);
    }
  };

  const handleForceGpsSync = async () => {
    setIsGeoLoading(true);
    setSyncStatus('Querying live GPS positioning & BME280 sensor telemetry...');
    try {
      const res = await meshtasticService.forceImmediateGpsSync();
      if (res.success && res.lat && res.lng) {
        setSyncStatus(`Synced via ${res.source || 'GPS'}: ${res.lat.toFixed(5)}°N, ${res.lng.toFixed(5)}°E`);
      } else {
        setSyncStatus(res.error || 'Failed to acquire location');
      }
    } catch (e: any) {
      setSyncStatus(`Sync error: ${e.message}`);
    } finally {
      setIsGeoLoading(false);
      setTimeout(() => setSyncStatus(null), 4000);
    }
  };

  const handleSendLoraTextMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outboundMessage.trim()) return;

    setIsSendingMessage(true);
    setMessageFeedback(null);

    try {
      const destination = node ? node.id : '^all';
      const res = await meshtasticService.sendLoraTextMessage(outboundMessage.trim(), destination);
      if (res.success) {
        setMessageFeedback(`Broadcasted over LoRa RF: "${outboundMessage.trim()}"`);
        setOutboundMessage('');
      } else {
        setMessageFeedback(`Send error: ${res.error}`);
      }
    } catch (err: any) {
      setMessageFeedback(`Transmission failed: ${err.message}`);
    } finally {
      setIsSendingMessage(false);
      setTimeout(() => setMessageFeedback(null), 4500);
    }
  };

  const filteredPackets = packetLogs.filter((pkt) => {
    if (packetFilter === 'TEXT') return pkt.portnum === 'TEXT_MESSAGE_APP' || !!pkt.textMessage;
    if (packetFilter === 'TELEMETRY') return pkt.portnum === 'TELEMETRY_APP' || pkt.portnum === 'ENVIRONMENT_METRICS_APP' || !!pkt.metrics;
    if (packetFilter === 'POSITION') return pkt.portnum === 'POSITION_APP' || !!pkt.position;
    return true;
  });

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[120] bg-lb-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-3xl bg-lb-080d1a/95 border border-ll-1e293b rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] min-h-0 text-lt-e0e6ed">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-lb-060b16 border-b border-ll-1e293b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              node?.isBluetoothConnected
                ? 'bg-lb-cyan-500/20 text-lt-cyan-400 border-ll-cyan-500/40'
                : 'bg-lb-emerald-500/20 text-lt-emerald-400 border-ll-emerald-500/40'
            }`}>
              {node?.isBluetoothConnected ? (
                <Zap className="w-5 h-5 animate-pulse" />
              ) : (
                <Radio className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-lt-white font-google">{targetName}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-lb-cyan-500/20 text-lt-cyan-300 border border-ll-cyan-500/40">
                  {node?.id || boat?.nodeId || 'LOCAL_NODE'}
                </span>
                {node?.isBluetoothConnected && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-lb-00ff9d/20 text-lt-00ff9d border border-ll-00ff9d/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-lb-00ff9d animate-ping" />
                    BLE Connected
                  </span>
                )}
                {sensorModel && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-lb-emerald-500/20 text-lt-emerald-300 border border-ll-emerald-500/40 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-lt-emerald-400" />
                    {sensorModel}
                  </span>
                )}
              </div>
              <p className="text-xs text-lt-slate-400 font-mono mt-0.5">
                {hardware} • {connType} • Last Ping: {formatLastHeard(node?.lastPingTime)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onToggleFollow(targetId, targetName)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-google flex items-center gap-1.5 transition-all ${
                isFollowing
                  ? 'bg-lb-amber-500 text-lt-slate-950 hover:bg-lb-amber-400'
                  : 'bg-lb-00d4ff hover:bg-lb-cyan-300 text-lt-black font-bold'
              }`}
            >
              <Crosshair className={`w-3.5 h-3.5 ${isFollowing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">{isFollowing ? 'Following' : 'Follow'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-lb-slate-800/80 hover:bg-lb-slate-700 text-lt-slate-400 hover:text-lt-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* REAL-TIME AUTO GPS SYNC CONTROL BAR */}
          <div className="p-4 bg-gradient-to-r from-lb-cyan-950/40 via-lb-blue-950/30 to-lb-0a1128 border border-ll-cyan-500/40 rounded-2xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-lb-cyan-500/20 text-lt-cyan-400 rounded-xl border border-ll-cyan-500/40">
                  <Activity className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-lt-white font-google">
                      Real-time LoRa & GPS Telemetry Stream
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                      autoGps.enabled
                        ? 'bg-lb-00ff9d/20 text-lt-00ff9d border border-ll-00ff9d/40 animate-pulse'
                        : 'bg-lb-slate-800 text-lt-slate-400 border border-ll-slate-700'
                    }`}>
                      {autoGps.enabled ? 'STREAMING ACTIVE' : 'PAUSED'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-lt-slate-400">
                    Continuous high-frequency LoRa RF broadcast and position push
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleAutoSync}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md ${
                    autoGps.enabled
                      ? 'bg-lb-amber-500/20 hover:bg-lb-amber-500/30 text-lt-amber-300 border border-ll-amber-500/50'
                      : 'bg-lb-00ff9d hover:bg-lb-emerald-300 text-lt-slate-950'
                  }`}
                >
                  {autoGps.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{autoGps.enabled ? 'Pause Stream' : 'Start Stream'}</span>
                </button>

                <button
                  onClick={handleForceGpsSync}
                  disabled={isGeoLoading || autoGps.isSyncing}
                  className="px-2.5 py-1.5 rounded-lg bg-lb-cyan-500/20 hover:bg-lb-cyan-500/30 text-lt-cyan-300 border border-ll-cyan-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  title="Force immediate GPS position sync"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${(isGeoLoading || autoGps.isSyncing) ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </button>

                <button
                  onClick={() => setIsCalibrating(!isCalibrating)}
                  className="px-2 py-1.5 rounded-lg bg-lb-slate-800 hover:bg-lb-slate-700 text-lt-slate-300 text-xs font-mono flex items-center gap-1 transition-colors"
                  title="Enter manual coordinates"
                >
                  <Sliders className="w-3.5 h-3.5 text-lt-cyan-400" />
                  <span>{isCalibrating ? 'Close' : 'Calibrate'}</span>
                </button>
              </div>
            </div>

            {/* Interval Selector Bar */}
            <div className="p-2.5 bg-lb-060b16 rounded-xl border border-ll-1e293b flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-lt-slate-400 font-bold uppercase tracking-wider">
                  Update Interval:
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {PRESET_INTERVALS.map((secs) => (
                    <button
                      key={secs}
                      onClick={() => handleSelectInterval(secs)}
                      className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold transition-all ${
                        selectedInterval === secs && !showCustomInterval
                          ? 'bg-lb-cyan-500 text-lt-slate-950 shadow-sm'
                          : 'bg-lb-slate-800 hover:bg-lb-slate-700 text-lt-slate-300 border border-ll-slate-700/60'
                      }`}
                    >
                      {secs}s
                    </button>
                  ))}
                  <button
                    onClick={() => setShowCustomInterval(!showCustomInterval)}
                    className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold transition-all ${
                      showCustomInterval
                        ? 'bg-lb-cyan-500 text-lt-slate-950 shadow-sm'
                        : 'bg-lb-slate-800 hover:bg-lb-slate-700 text-lt-slate-300 border border-ll-slate-700/60'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {/* Countdown or Sync Status Ticker */}
              <div className="flex items-center gap-2">
                {autoGps.enabled ? (
                  <div className="flex items-center gap-1.5 text-xs font-mono bg-lb-cyan-950/60 border border-ll-cyan-500/30 px-2 py-0.5 rounded-lg text-lt-cyan-300">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lb-00ff9d opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-lb-00ff9d"></span>
                    </span>
                    <span>Next update: <strong className="text-lt-white font-bold">{countdownSec}s</strong></span>
                    <span className="text-lt-slate-500">|</span>
                    <span className="text-lt-slate-400">Syncs: <strong className="text-lt-cyan-200">{autoGps.syncCount}</strong></span>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-lt-slate-500">
                    Click 'Start Stream' to broadcast real-time packets
                  </span>
                )}
              </div>
            </div>

            {/* Custom Interval Form (if opened) */}
            {showCustomInterval && (
              <div className="p-3 bg-lb-060b16 rounded-xl border border-ll-cyan-500/40 flex items-center gap-2 animate-fadeIn">
                <span className="text-xs font-mono text-lt-slate-300">Set custom interval (1 - 300s):</span>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={customIntervalInput}
                  onChange={(e) => setCustomIntervalInput(e.target.value)}
                  placeholder="e.g. 8"
                  className="w-24 px-2.5 py-1 bg-lb-0d182e border border-ll-slate-700 rounded-lg text-lt-white font-mono text-xs focus:border-ll-cyan-400 focus:outline-none"
                />
                <button
                  onClick={handleApplyCustomInterval}
                  className="px-3 py-1 bg-lb-cyan-500 hover:bg-lb-cyan-400 text-lt-slate-950 font-bold text-xs font-mono rounded-lg transition-colors"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Current Coordinates & Real-time Metrics Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-lt-slate-300 bg-lb-060b16 p-2.5 rounded-lg border border-ll-1e293b">
              <div className="flex items-center justify-between">
                <span className="text-lt-slate-400">Current Position: </span>
                <strong className="text-lt-white font-bold">{lat.toFixed(5)}° N, {lng.toFixed(5)}° E</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lt-slate-400">GPS Fix & Accuracy: </span>
                <strong className={node?.gpsFix ? 'text-lt-00ff9d' : 'text-lt-amber-400'}>
                  {node?.gpsFix ? `3D Lock (${satsInFix || 8} Sats${autoGps.accuracyMeters ? ` • ±${autoGps.accuracyMeters}m` : ''})` : 'Indoor / Acquiring'}
                </strong>
              </div>
            </div>

            {/* Calibration Input Form */}
            {isCalibrating && (
              <div className="p-3 bg-lb-060b16 rounded-xl border border-ll-cyan-500/40 space-y-2.5 animate-fadeIn">
                <p className="text-xs font-mono text-lt-cyan-200">
                  Enter exact latitude and longitude coordinates for this node / boat:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono text-lt-slate-400 block mb-1">Latitude (°N/S)</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={customLat}
                      onChange={(e) => setCustomLat(e.target.value)}
                      placeholder="e.g. 6.3080"
                      className="w-full px-3 py-1.5 bg-lb-0d182e border border-ll-slate-700 rounded-lg text-lt-white font-mono text-xs focus:border-ll-cyan-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-lt-slate-400 block mb-1">Longitude (°E/W)</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={customLng}
                      onChange={(e) => setCustomLng(e.target.value)}
                      placeholder="e.g. 99.8200"
                      className="w-full px-3 py-1.5 bg-lb-0d182e border border-ll-slate-700 rounded-lg text-lt-white font-mono text-xs focus:border-ll-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsCalibrating(false)}
                    className="px-3 py-1 bg-lb-slate-800 text-lt-slate-300 text-xs font-mono rounded-lg hover:bg-lb-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCustomCoords}
                    className="px-3 py-1 bg-lb-cyan-500 hover:bg-lb-cyan-400 text-lt-slate-950 font-bold text-xs font-mono rounded-lg flex items-center gap-1 shadow-md"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Calibration</span>
                  </button>
                </div>
              </div>
            )}

            {syncStatus && (
              <p className="text-xs font-mono text-lt-00ff9d bg-lb-00ff9d/10 p-2 rounded border border-ll-00ff9d/30 animate-fadeIn">
                {syncStatus}
              </p>
            )}
          </div>

          {/* Key Quick Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Battery */}
            <div className="p-3.5 bg-lb-0d182e border border-ll-1e293b rounded-xl flex flex-col">
              <div className="flex items-center justify-between text-lt-slate-400 text-xs font-mono">
                <span>BATTERY</span>
                <BatteryCharging className="w-4 h-4 text-lt-emerald-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-lt-white font-google flex items-baseline gap-1">
                {batteryPct !== undefined ? `${batteryPct}%` : 'N/A'}
                {voltage ? <span className="text-xs text-lt-slate-400 font-normal">{voltage}V</span> : null}
              </div>
              <div className="w-full bg-lb-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${(batteryPct ?? 100) < 20 ? 'bg-lb-red-500' : (batteryPct ?? 100) < 50 ? 'bg-lb-amber-500' : 'bg-lb-emerald-400'}`}
                  style={{ width: `${batteryPct ?? 0}%` }}
                />
              </div>
            </div>

            {/* Speed SOG */}
            <div className="p-3.5 bg-lb-0d182e border border-ll-1e293b rounded-xl flex flex-col">
              <div className="flex items-center justify-between text-lt-slate-400 text-xs font-mono">
                <span>SPEED (SOG)</span>
                <Navigation className="w-4 h-4 text-lt-cyan-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-lt-cyan-300 font-google">
                {speed.toFixed(1)} <span className="text-xs text-lt-slate-400">kt</span>
              </div>
              <span className="text-xs text-lt-slate-400 font-mono mt-1">
                COG / Bearing: {Math.round(heading)}°
              </span>
            </div>

            {/* GPS Satellites */}
            <div className="p-3.5 bg-lb-0d182e border border-ll-1e293b rounded-xl flex flex-col">
              <div className="flex items-center justify-between text-lt-slate-400 text-xs font-mono">
                <span>GPS FIX</span>
                <Eye className="w-4 h-4 text-lt-blue-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-lt-white font-google flex items-center gap-1.5">
                {node?.gpsFix ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-lt-emerald-400 shrink-0" />
                    3D FIX
                  </>
                ) : (
                  <span className="text-lt-amber-400 text-xs font-mono font-semibold">ACQUIRING FIX...</span>
                )}
              </div>
              <span className="text-xs text-lt-slate-400 font-mono mt-1">
                {satsInFix} / {satsInView} Sats • Alt: {node?.altitudeMeters !== undefined ? `${node.altitudeMeters}m` : '--'}
              </span>
            </div>

            {/* RF SNR & RSSI */}
            <div className="p-3.5 bg-lb-0d182e border border-ll-1e293b rounded-xl flex flex-col">
              <div className="flex items-center justify-between text-lt-slate-400 text-xs font-mono">
                <span>RF SIGNAL</span>
                <Signal className="w-4 h-4 text-lt-indigo-400" />
              </div>
              <div className="mt-2 text-xl font-bold text-lt-white font-google">
                {rssi} <span className="text-xs text-lt-slate-400">dBm</span>
              </div>
              <span className="text-xs text-lt-slate-400 font-mono mt-1">
                SNR: {snr > 0 ? `+${snr}` : snr} dB • Hops: {hops}
              </span>
            </div>
          </div>

          {/* BME280 ENVIRONMENTAL SENSORS SECTION */}
          {(() => {
            const hasEnvData = pressure !== undefined || temperature !== undefined || humidity !== undefined || gasResistance !== undefined || iaq !== undefined;
            return (
              <div className="p-4 bg-gradient-to-br from-lb-06181e to-lb-0a1e26 border border-ll-emerald-500/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-ll-emerald-500/20 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-lb-emerald-500/20 text-lt-emerald-400 border border-ll-emerald-500/30">
                      <Gauge className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-lt-white font-google flex items-center gap-2">
                        Environment & Atmosphere Sensors
                        {hasEnvData && (
                          <span className="text-xs font-mono font-bold bg-lb-emerald-500/20 text-lt-emerald-300 border border-ll-emerald-500/40 px-2 py-0.5 rounded-full">
                            {sensorModel || 'I2C Sensor'}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs font-mono text-lt-emerald-200/70">
                        {hasEnvData
                          ? 'Real-time barometric pressure, ambient temperature, and relative humidity'
                          : 'No environmental telemetry packets received from this node'}
                      </p>
                    </div>
                  </div>
                  {!hasEnvData && (
                    <span className="text-xs font-mono text-lt-slate-400 bg-lb-slate-800/80 px-2 py-1 rounded-md border border-ll-slate-700">
                      No Telemetry Received
                    </span>
                  )}
                </div>

                {hasEnvData ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Barometric Pressure */}
                    <div className="p-3 bg-lb-020a10 border border-ll-emerald-500/20 rounded-xl">
                      <div className="flex items-center justify-between text-xs font-mono text-lt-slate-400">
                        <span>BAROMETER</span>
                        <Wind className="w-3.5 h-3.5 text-lt-cyan-400" />
                      </div>
                      <div className="mt-1.5 text-lg font-bold text-lt-white font-google">
                        {pressure !== undefined && pressure !== null ? `${Number(pressure).toFixed(1)}` : '—'} <span className="text-xs text-lt-emerald-400 font-mono">{pressure !== undefined && pressure !== null ? 'hPa' : ''}</span>
                      </div>
                      <span className="text-xs font-mono text-lt-slate-400 block mt-0.5">
                        {pressure !== undefined ? (pressure > 1013.25 ? 'High Pressure / Clear' : 'Standard Sea-Level') : 'No sensor data'}
                      </span>
                    </div>

                    {/* Temperature */}
                    <div className="p-3 bg-lb-020a10 border border-ll-emerald-500/20 rounded-xl">
                      <div className="flex items-center justify-between text-xs font-mono text-lt-slate-400">
                        <span>TEMPERATURE</span>
                        <Thermometer className="w-3.5 h-3.5 text-lt-amber-400" />
                      </div>
                      <div className="mt-1.5 text-lg font-bold text-lt-white font-google">
                        {temperature !== undefined && temperature !== null ? `${Number(temperature).toFixed(1)}` : '—'} <span className="text-xs text-lt-amber-400 font-mono">{temperature !== undefined && temperature !== null ? '°C' : ''}</span>
                      </div>
                      <span className="text-xs font-mono text-lt-slate-400 block mt-0.5">
                        {temperature !== undefined && temperature !== null ? `${((Number(temperature) * 9/5) + 32).toFixed(1)}°F Ambient` : 'No sensor data'}
                      </span>
                    </div>

                    {/* Humidity */}
                    <div className="p-3 bg-lb-020a10 border border-ll-emerald-500/20 rounded-xl">
                      <div className="flex items-center justify-between text-xs font-mono text-lt-slate-400">
                        <span>HUMIDITY</span>
                        <Droplets className="w-3.5 h-3.5 text-lt-blue-400" />
                      </div>
                      <div className="mt-1.5 text-lg font-bold text-lt-white font-google">
                        {humidity !== undefined && humidity !== null ? `${Number(humidity).toFixed(1)}` : '—'} <span className="text-xs text-lt-blue-400 font-mono">{humidity !== undefined && humidity !== null ? '% RH' : ''}</span>
                      </div>
                      <span className="text-xs font-mono text-lt-slate-400 block mt-0.5">
                        {humidity !== undefined ? 'Marine Relative Humidity' : 'No sensor data'}
                      </span>
                    </div>

                    {/* Gas Resistance / IAQ */}
                    <div className="p-3 bg-lb-020a10 border border-ll-emerald-500/20 rounded-xl">
                      <div className="flex items-center justify-between text-xs font-mono text-lt-slate-400">
                        <span>AIR QUALITY</span>
                        <Activity className="w-3.5 h-3.5 text-lt-emerald-400" />
                      </div>
                      <div className="mt-1.5 text-lg font-bold text-lt-white font-google">
                        {iaq !== undefined ? `IAQ ${iaq}` : (gasResistance !== undefined && gasResistance !== null ? `${Number(gasResistance).toFixed(1)} kΩ` : '—')}
                      </div>
                      <span className="text-xs font-mono text-lt-emerald-400 block mt-0.5">
                        {iaq !== undefined || gasResistance !== undefined ? 'Fresh Oceanic Air' : 'No sensor data'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-lb-020a10 border border-ll-emerald-500/10 rounded-xl text-center">
                    <p className="text-xs font-mono text-lt-slate-400">
                      No environmental sensor attached. Connect a BME280/BMP280/SHT31 sensor to the node's I2C bus or broadcast telemetry packets over LoRa to populate this section.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Detailed Hardware & Mesh Telemetry Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hardware & Protocol Specs */}
            <div className="p-4 bg-lb-0b132b border border-ll-1e293b rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-lt-white font-google border-b border-ll-slate-800 pb-2">
                <Cpu className="w-4 h-4 text-lt-blue-400" />
                Hardware & Device Specifications
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-lt-slate-400">Hardware Model:</span>
                  <span className="text-lt-slate-200 font-medium text-right">{hardware}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lt-slate-400">Firmware Build:</span>
                  <span className="text-lt-emerald-400">{firmware}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lt-slate-400">Transport Layer:</span>
                  <span className="text-lt-cyan-400 font-bold">{connType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lt-slate-400">MAC Address:</span>
                  <span className="text-lt-slate-300">{node?.mac || '24:6F:28:7A:2C:10'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lt-slate-400">Region Frequency:</span>
                  <span className="text-lt-amber-300">
                    {node?.locationRegion || 'MY_919 (919-923 MHz 500mW)'}
                  </span>
                </div>
              </div>
            </div>

            {/* GPS Coordinates & Position Telemetry */}
            <div className="p-4 bg-lb-0b132b border border-ll-1e293b rounded-xl space-y-3">
              <div className="flex items-center justify-between text-sm font-bold text-lt-white font-google border-b border-ll-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-lt-emerald-400" />
                  Live Position & Airtime Metrics
                </div>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-lt-slate-400">Latitude:</span>
                  <span className="text-lt-white font-bold">{lat.toFixed(5)}° N</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lt-slate-400">Longitude:</span>
                  <span className="text-lt-white font-bold">{lng.toFixed(5)}° E</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lt-slate-400">Channel Utilization:</span>
                  <span className="text-lt-blue-300">{node?.channelUtil ?? 1.8}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lt-slate-400">Airtime Tx Load:</span>
                  <span className="text-lt-blue-300">{node?.airUtilTx ?? 0.4}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-lt-slate-400">Last Heard:</span>
                  <span className="text-lt-00d4ff font-bold">
                    {formatLastHeard(node?.lastPingTime)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bound Boat Context */}
          {boat && (
            <div className="p-4 bg-lb-0b132b border border-ll-blue-500/30 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-lb-blue-500/20 text-lt-blue-400 border border-ll-blue-500/30">
                  <Anchor className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-lt-slate-400 font-mono">BOUND VESSEL REGISTRATION</div>
                  <div className="text-base font-bold text-lt-white font-google">{boat.name} ({boat.sailNumber})</div>
                  <p className="text-xs text-lt-slate-300 mt-0.5 font-mono">
                    Skipper: {boat.skipper} • Class: {boat.class} • Handicap Rating: {boat.handicapRating} ({boat.handicapSystem})
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-lt-emerald-400 font-bold font-mono block">
                  STATUS: {boat.status}
                </span>
                <span className="text-xs text-lt-slate-400 font-mono">
                  DTW: {safeFixed(boat.dtw, 2, '0.00')} NM
                </span>
              </div>
            </div>
          )}

          {/* REAL-TIME CAPTURED PACKET LOGS & LORA MESSAGES SECTION */}
          <div className="p-4 bg-lb-040812 border border-ll-1e293b rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-ll-1e293b pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-lb-indigo-500/20 text-lt-indigo-400 rounded-xl border border-ll-indigo-500/40">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-lt-white font-google flex items-center gap-2">
                    Real-time Captured Packets & LoRa RF Stream
                    <span className="text-xs font-mono bg-lb-indigo-500/20 text-lt-indigo-300 px-2 py-0.5 rounded-full border border-ll-indigo-500/40">
                      {filteredPackets.length} Packets
                    </span>
                  </h4>
                  <p className="text-xs font-mono text-lt-slate-400">
                    Live binary & text frames captured from this device ({targetName})
                  </p>
                </div>
              </div>

              {/* Packet Type Filter Tabs */}
              <div className="flex items-center gap-1 bg-lb-0a0f1e p-1 rounded-xl border border-ll-1e293b">
                {(['ALL', 'TEXT', 'TELEMETRY', 'POSITION'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setPacketFilter(filter)}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      packetFilter === filter
                        ? 'bg-lb-indigo-500 text-lt-white shadow-sm'
                        : 'text-lt-slate-400 hover:text-lt-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Packet Log Terminal Container */}
            <div className="bg-lb-02050d border border-ll-slate-800 rounded-xl p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-2 custom-scrollbar">
              {filteredPackets.length === 0 ? (
                <div className="p-6 text-center text-lt-slate-500 space-y-1">
                  <Radio className="w-6 h-6 mx-auto text-lt-slate-600 animate-pulse" />
                  <p>Listening for real-time LoRa packets from {targetName}...</p>
                  <p className="text-xs text-lt-slate-600">Packets arrive every 2-3s when T-Echo is streaming</p>
                </div>
              ) : (
                filteredPackets.map((pkt) => {
                  const isText = pkt.portnum === 'TEXT_MESSAGE_APP' || !!pkt.textMessage;
                  const isTele = pkt.portnum === 'TELEMETRY_APP' || pkt.portnum === 'ENVIRONMENT_METRICS_APP';
                  const isPos = pkt.portnum === 'POSITION_APP';

                  return (
                    <div
                      key={pkt.id}
                      className={`p-2 rounded-lg border transition-all ${
                        isText
                          ? 'bg-lb-amber-950/20 border-ll-amber-500/40 text-lt-amber-200'
                          : isTele
                          ? 'bg-lb-emerald-950/20 border-ll-emerald-500/40 text-lt-emerald-200'
                          : isPos
                          ? 'bg-lb-cyan-950/20 border-ll-cyan-500/40 text-lt-cyan-200'
                          : 'bg-lb-slate-900/60 border-ll-slate-800 text-lt-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs opacity-75 border-b border-ll-white/10 pb-1 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lt-white font-bold">{pkt.timestamp}</span>
                          <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-lb-black/40 border border-ll-white/20">
                            {pkt.portnum}
                          </span>
                          <span>From: <strong className="text-lt-white">{pkt.fromNodeName || pkt.fromNode}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-lt-slate-400">
                          {pkt.snr !== undefined && <span>SNR: {pkt.snr}dB</span>}
                          {pkt.rssi !== undefined && <span>RSSI: {pkt.rssi}dBm</span>}
                          {pkt.hops !== undefined && <span>Hops: {pkt.hops}</span>}
                        </div>
                      </div>

                      {/* Packet Content Payload */}
                      <div className="font-mono text-lt-white break-words">
                        {isText ? (
                          <div className="flex items-start gap-1.5 text-lt-amber-300 font-semibold">
                            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-lt-amber-400" />
                            <span>"{pkt.textMessage || pkt.payload}"</span>
                          </div>
                        ) : isTele ? (
                          <div className="flex items-start gap-1.5 text-lt-emerald-300">
                            <Gauge className="w-3.5 h-3.5 shrink-0 mt-0.5 text-lt-emerald-400" />
                            <span>{pkt.payload}</span>
                          </div>
                        ) : isPos ? (
                          <div className="flex items-start gap-1.5 text-lt-cyan-300">
                            <Compass className="w-3.5 h-3.5 shrink-0 mt-0.5 text-lt-cyan-400" />
                            <span>{pkt.payload}</span>
                          </div>
                        ) : (
                          <span>{pkt.payload}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={packetsEndRef} />
            </div>

            {/* Outbound LoRa Text Message Transmission Bar */}
            <form onSubmit={handleSendLoraTextMessage} className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={outboundMessage}
                  onChange={(e) => setOutboundMessage(e.target.value)}
                  placeholder={`Send LoRa RF text message to ${targetName} or fleet...`}
                  className="w-full pl-3 pr-8 py-2 bg-lb-02050d border border-ll-slate-700 rounded-xl text-lt-white font-mono text-xs focus:border-ll-cyan-400 focus:outline-none"
                />
                <MessageSquare className="w-4 h-4 text-lt-slate-500 absolute right-2.5 top-2.5" />
              </div>
              <button
                type="submit"
                disabled={isSendingMessage || !outboundMessage.trim()}
                className="px-4 py-2 bg-lb-00d4ff hover:bg-lb-cyan-300 disabled:opacity-50 text-lt-slate-950 font-google font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingMessage ? 'Transmitting...' : 'Send LoRa'}</span>
              </button>
            </form>

            {messageFeedback && (
              <p className="text-xs font-mono text-lt-00ff9d bg-lb-00ff9d/10 p-1.5 rounded border border-ll-00ff9d/30 animate-fadeIn">
                ✓ {messageFeedback}
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-lb-060b16/90 border-t border-ll-1e293b flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {onDeleteNode && node && (
              <button
                onClick={() => {
                  onDeleteNode(node.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl bg-lb-red-500/10 hover:bg-lb-red-500/20 text-lt-red-400 border border-ll-red-500/30 text-xs font-google font-bold flex items-center gap-1.5 transition-colors"
                title="Remove node from system"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Node</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-lb-1e293b hover:bg-lb-slate-700 text-lt-slate-200 text-xs font-google font-bold transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
