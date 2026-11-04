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
  Crosshair,
  Trash2,
  RefreshCw,
  Sliders,
  Check,
  Play,
  Pause,
  Zap,
  Gauge,
  Thermometer,
  Droplets,
  Wind,
  MessageSquare,
  Send,
  Terminal,
} from 'lucide-react';
import { MeshtasticNode, Boat } from '../types/regatta';
import { formatBattery, formatLastHeard, safeFixed } from '../utils/formatters';
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
  const [autoScroll] = useState(true);

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

  // Telemetry: only what the tracker reported; missing readings show as a dash
  const batteryPct = node?.battery;
  const voltage = node?.voltage;
  const satsInView = node?.satsInView;
  const satsInFix = node?.satsInFix;
  const speed = boat ? (boat.sog ?? 0) : (node?.speedKt ?? 0);
  const heading = boat ? (boat.cog ?? 0) : (node?.headingDeg ?? 0);
  const lat = boat ? (boat.lat ?? 0) : (node?.lat ?? 0);
  const lng = boat ? (boat.lng ?? 0) : (node?.lng ?? 0);
  const snr = node?.snr;
  const rssi = node?.rssi;
  const hops = node?.hops;
  const hardware = node?.hardwareModel || 'Meshtastic Hardware Node';
  const firmware = node?.firmwareVersion || '—';
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
      className="fixed inset-0 z-[120] bg-canvas/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-3xl bg-canvas/95 border border-line rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] min-h-0 text-ink">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-canvas border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              node?.isBluetoothConnected
                ? 'bg-accent/20 text-accent border-accent/40'
                : 'bg-success-ink/20 text-success-ink border-success-ink/40'
            }`}>
              {node?.isBluetoothConnected ? (
                <Zap className="w-5 h-5" />
              ) : (
                <Radio className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-ink">{targetName}</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent/20 text-accent border border-accent/40">
                  {node?.id || boat?.nodeId || 'LOCAL_NODE'}
                </span>
                {node?.isBluetoothConnected && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-success-ink/20 text-success-ink border border-success-ink/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success-ink" />
                    BLE Connected
                  </span>
                )}
                {sensorModel && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-success-ink/20 text-success-ink border border-success-ink/40 flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-success-ink" />
                    {sensorModel}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                {hardware} • {connType} • Last Ping: {formatLastHeard(node?.lastPingTime)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onToggleFollow(targetId, targetName)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                isFollowing
                  ? 'bg-warning-ink text-canvas hover:brightness-110'
                  : 'bg-accent hover:brightness-110 text-on-accent font-bold'
              }`}
            >
              <Crosshair className={`w-3.5 h-3.5 ${isFollowing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">{isFollowing ? 'Following' : 'Follow'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-raised/80 hover:bg-raised text-ink-muted hover:text-ink transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* REAL-TIME AUTO GPS SYNC CONTROL BAR */}
          <div className="p-4 bg-gradient-to-r from-surface/40 via-surface/30 to-surface border border-accent/40 rounded-2xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-accent/20 text-accent rounded-xl border border-accent/40">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink">
                      Real-time LoRa & GPS Telemetry Stream
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold  ${
                      autoGps.enabled
                        ? 'bg-success-ink/20 text-success-ink border border-success-ink/40 '
                        : 'bg-raised text-ink-muted border border-line'
                    }`}>
                      {autoGps.enabled ? 'STREAMING ACTIVE' : 'PAUSED'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Continuous high-frequency LoRa RF broadcast and position push
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleAutoSync}
                  className={`px-3 py-1.5 rounded-lg text-xs  font-bold flex items-center gap-1.5 transition-all shadow-md ${
                    autoGps.enabled
                      ? 'bg-warning-ink/20 hover:bg-warning-ink/30 text-warning-ink border border-warning-ink/50'
                      : 'bg-success-ink hover:brightness-110 text-canvas'
                  }`}
                >
                  {autoGps.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{autoGps.enabled ? 'Pause Stream' : 'Start Stream'}</span>
                </button>

                <button
                  onClick={handleForceGpsSync}
                  disabled={isGeoLoading || autoGps.isSyncing}
                  className="px-2.5 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  title="Force immediate GPS position sync"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${(isGeoLoading || autoGps.isSyncing) ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </button>

                <button
                  onClick={() => setIsCalibrating(!isCalibrating)}
                  className="px-2 py-1.5 rounded-lg bg-raised hover:bg-raised text-ink text-xs flex items-center gap-1 transition-colors"
                  title="Enter manual coordinates"
                >
                  <Sliders className="w-3.5 h-3.5 text-accent" />
                  <span>{isCalibrating ? 'Close' : 'Calibrate'}</span>
                </button>
              </div>
            </div>

            {/* Interval Selector Bar */}
            <div className="p-2.5 bg-canvas rounded-xl border border-line flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-ink-muted font-bold">
                  Update Interval:
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {PRESET_INTERVALS.map((secs) => (
                    <button
                      key={secs}
                      onClick={() => handleSelectInterval(secs)}
                      className={`px-2 py-0.5 rounded-md text-xs  font-bold transition-all ${
                        selectedInterval === secs && !showCustomInterval
                          ? 'bg-accent text-on-accent shadow-sm'
                          : 'bg-raised hover:bg-raised text-ink border border-line/60'
                      }`}
                    >
                      {secs}s
                    </button>
                  ))}
                  <button
                    onClick={() => setShowCustomInterval(!showCustomInterval)}
                    className={`px-2 py-0.5 rounded-md text-xs  font-bold transition-all ${
                      showCustomInterval
                        ? 'bg-accent text-on-accent shadow-sm'
                        : 'bg-raised hover:bg-raised text-ink border border-line/60'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {/* Countdown or Sync Status Ticker */}
              <div className="flex items-center gap-2">
                {autoGps.enabled ? (
                  <div className="flex items-center gap-1.5 text-xs bg-surface/60 border border-accent/30 px-2 py-0.5 rounded-lg text-accent">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-success-ink opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success-ink"></span>
                    </span>
                    <span>Next update: <strong className="text-ink font-bold">{countdownSec}s</strong></span>
                    <span className="text-ink-muted">|</span>
                    <span className="text-ink-muted">Syncs: <strong className="text-accent">{autoGps.syncCount}</strong></span>
                  </div>
                ) : (
                  <span className="text-xs text-ink-muted">
                    Click 'Start Stream' to broadcast real-time packets
                  </span>
                )}
              </div>
            </div>

            {/* Custom Interval Form (if opened) */}
            {showCustomInterval && (
              <div className="p-3 bg-canvas rounded-xl border border-accent/40 flex items-center gap-2 animate-fadeIn">
                <span className="text-xs text-ink">Set custom interval (1 - 300s):</span>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={customIntervalInput}
                  onChange={(e) => setCustomIntervalInput(e.target.value)}
                  placeholder="e.g. 8"
                  className="w-24 px-2.5 py-1 bg-surface border border-line rounded-lg text-ink text-xs focus:border-accent focus:outline-none"
                />
                <button
                  onClick={handleApplyCustomInterval}
                  className="px-3 py-1 bg-accent hover:brightness-110 text-on-accent font-bold text-xs rounded-lg transition-colors"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Current Coordinates & Real-time Metrics Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink bg-canvas p-2.5 rounded-lg border border-line">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Current Position: </span>
                <strong className="text-ink font-bold">{lat.toFixed(5)}° N, {lng.toFixed(5)}° E</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">GPS Fix & Accuracy: </span>
                <strong className={node?.gpsFix ? 'text-success-ink' : 'text-warning-ink'}>
                  {node?.gpsFix ? `3D Lock (${satsInFix ?? '—'} Sats${autoGps.accuracyMeters ? ` • ±${autoGps.accuracyMeters}m` : ''})` : 'Indoor / Acquiring'}
                </strong>
              </div>
            </div>

            {/* Calibration Input Form */}
            {isCalibrating && (
              <div className="p-3 bg-canvas rounded-xl border border-accent/40 space-y-2.5 animate-fadeIn">
                <p className="text-xs text-accent">
                  Enter exact latitude and longitude coordinates for this node / boat:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-ink-muted block mb-1">Latitude (°N/S)</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={customLat}
                      onChange={(e) => setCustomLat(e.target.value)}
                      placeholder="e.g. 6.3080"
                      className="w-full px-3 py-1.5 bg-surface border border-line rounded-lg text-ink text-xs focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-muted block mb-1">Longitude (°E/W)</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={customLng}
                      onChange={(e) => setCustomLng(e.target.value)}
                      placeholder="e.g. 99.8200"
                      className="w-full px-3 py-1.5 bg-surface border border-line rounded-lg text-ink text-xs focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsCalibrating(false)}
                    className="px-3 py-1 bg-raised text-ink text-xs rounded-lg hover:bg-raised"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCustomCoords}
                    className="px-3 py-1 bg-accent hover:brightness-110 text-on-accent font-bold text-xs rounded-lg flex items-center gap-1 shadow-md"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Calibration</span>
                  </button>
                </div>
              </div>
            )}

            {syncStatus && (
              <p className="text-xs text-success-ink bg-success-ink/10 p-2 rounded border border-success-ink/30 animate-fadeIn">
                {syncStatus}
              </p>
            )}
          </div>

          {/* Key Quick Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Battery */}
            <div className="p-3.5 bg-surface border border-line rounded-xl flex flex-col">
              <div className="flex items-center justify-between text-ink-muted text-xs">
                <span>BATTERY</span>
                <BatteryCharging className="w-4 h-4 text-success-ink" />
              </div>
              <div className="mt-2 text-xl font-bold text-ink flex items-baseline gap-1">
                {formatBattery(batteryPct)}
                {voltage ? <span className="text-xs text-ink-muted font-normal">{voltage}V</span> : null}
              </div>
              <div className="w-full bg-raised rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${(batteryPct ?? 100) < 20 ? 'bg-danger' : (batteryPct ?? 100) < 50 ? 'bg-warning-ink' : 'bg-success-ink'}`}
                  style={{ width: `${Math.min(100, batteryPct ?? 0)}%` }}
                />
              </div>
            </div>

            {/* Speed SOG */}
            <div className="p-3.5 bg-surface border border-line rounded-xl flex flex-col">
              <div className="flex items-center justify-between text-ink-muted text-xs">
                <span>SPEED (SOG)</span>
                <Navigation className="w-4 h-4 text-accent" />
              </div>
              <div className="mt-2 text-xl font-bold text-accent">
                {speed.toFixed(1)} <span className="text-xs text-ink-muted">kt</span>
              </div>
              <span className="text-xs text-ink-muted mt-1">
                COG / Bearing: {Math.round(heading)}°
              </span>
            </div>

            {/* GPS Satellites */}
            <div className="p-3.5 bg-surface border border-line rounded-xl flex flex-col">
              <div className="flex items-center justify-between text-ink-muted text-xs">
                <span>GPS FIX</span>
                <Eye className="w-4 h-4 text-accent" />
              </div>
              <div className="mt-2 text-xl font-bold text-ink flex items-center gap-1.5">
                {node?.gpsFix ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-success-ink shrink-0" />
                    3D FIX
                  </>
                ) : (
                  <span className="text-warning-ink text-xs font-semibold">ACQUIRING FIX...</span>
                )}
              </div>
              <span className="text-xs text-ink-muted mt-1">
                {satsInFix ?? '—'} / {satsInView ?? '—'} Sats • Alt: {node?.altitudeMeters !== undefined ? `${node.altitudeMeters}m` : '--'}
              </span>
            </div>

            {/* RF SNR & RSSI */}
            <div className="p-3.5 bg-surface border border-line rounded-xl flex flex-col">
              <div className="flex items-center justify-between text-ink-muted text-xs">
                <span>RF SIGNAL</span>
                <Signal className="w-4 h-4 text-ink-muted" />
              </div>
              <div className="mt-2 text-xl font-bold text-ink">
                {rssi ?? '—'} <span className="text-xs text-ink-muted">dBm</span>
              </div>
              <span className="text-xs text-ink-muted mt-1">
                SNR: {snr === undefined ? '—' : snr > 0 ? `+${snr}` : snr} dB • Hops: {hops ?? '—'}
              </span>
            </div>
          </div>

          {/* BME280 ENVIRONMENTAL SENSORS SECTION */}
          {(() => {
            const hasEnvData = pressure !== undefined || temperature !== undefined || humidity !== undefined || gasResistance !== undefined || iaq !== undefined;
            return (
              <div className="p-4 bg-gradient-to-br from-surface to-surface border border-success-ink/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-success-ink/20 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-success-ink/20 text-success-ink border border-success-ink/30">
                      <Gauge className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                        Environment & Atmosphere Sensors
                        {hasEnvData && (
                          <span className="text-xs font-bold bg-success-ink/20 text-success-ink border border-success-ink/40 px-2 py-0.5 rounded-full">
                            {sensorModel || 'I2C Sensor'}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-success-ink/70">
                        {hasEnvData
                          ? 'Real-time barometric pressure, ambient temperature, and relative humidity'
                          : 'No environmental telemetry packets received from this node'}
                      </p>
                    </div>
                  </div>
                  {!hasEnvData && (
                    <span className="text-xs text-ink-muted bg-raised/80 px-2 py-1 rounded-md border border-line">
                      No Telemetry Received
                    </span>
                  )}
                </div>

                {hasEnvData ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Barometric Pressure */}
                    <div className="p-3 bg-canvas border border-success-ink/20 rounded-xl">
                      <div className="flex items-center justify-between text-xs text-ink-muted">
                        <span>BAROMETER</span>
                        <Wind className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <div className="mt-1.5 text-lg font-bold text-ink">
                        {pressure !== undefined && pressure !== null ? `${Number(pressure).toFixed(1)}` : '—'} <span className="text-xs text-success-ink">{pressure !== undefined && pressure !== null ? 'hPa' : ''}</span>
                      </div>
                      <span className="text-xs text-ink-muted block mt-0.5">
                        {pressure !== undefined ? (pressure > 1013.25 ? 'High Pressure / Clear' : 'Standard Sea-Level') : 'No sensor data'}
                      </span>
                    </div>

                    {/* Temperature */}
                    <div className="p-3 bg-canvas border border-success-ink/20 rounded-xl">
                      <div className="flex items-center justify-between text-xs text-ink-muted">
                        <span>TEMPERATURE</span>
                        <Thermometer className="w-3.5 h-3.5 text-warning-ink" />
                      </div>
                      <div className="mt-1.5 text-lg font-bold text-ink">
                        {temperature !== undefined && temperature !== null ? `${Number(temperature).toFixed(1)}` : '—'} <span className="text-xs text-warning-ink">{temperature !== undefined && temperature !== null ? '°C' : ''}</span>
                      </div>
                      <span className="text-xs text-ink-muted block mt-0.5">
                        {temperature !== undefined && temperature !== null ? `${((Number(temperature) * 9/5) + 32).toFixed(1)}°F Ambient` : 'No sensor data'}
                      </span>
                    </div>

                    {/* Humidity */}
                    <div className="p-3 bg-canvas border border-success-ink/20 rounded-xl">
                      <div className="flex items-center justify-between text-xs text-ink-muted">
                        <span>HUMIDITY</span>
                        <Droplets className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <div className="mt-1.5 text-lg font-bold text-ink">
                        {humidity !== undefined && humidity !== null ? `${Number(humidity).toFixed(1)}` : '—'} <span className="text-xs text-accent">{humidity !== undefined && humidity !== null ? '% RH' : ''}</span>
                      </div>
                      <span className="text-xs text-ink-muted block mt-0.5">
                        {humidity !== undefined ? 'Marine Relative Humidity' : 'No sensor data'}
                      </span>
                    </div>

                    {/* Gas Resistance / IAQ */}
                    <div className="p-3 bg-canvas border border-success-ink/20 rounded-xl">
                      <div className="flex items-center justify-between text-xs text-ink-muted">
                        <span>AIR QUALITY</span>
                        <Activity className="w-3.5 h-3.5 text-success-ink" />
                      </div>
                      <div className="mt-1.5 text-lg font-bold text-ink">
                        {iaq !== undefined ? `IAQ ${iaq}` : (gasResistance !== undefined && gasResistance !== null ? `${Number(gasResistance).toFixed(1)} kΩ` : '—')}
                      </div>
                      <span className="text-xs text-success-ink block mt-0.5">
                        {iaq !== undefined || gasResistance !== undefined ? 'Fresh Oceanic Air' : 'No sensor data'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-canvas border border-success-ink/10 rounded-xl text-center">
                    <p className="text-xs text-ink-muted">
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
            <div className="p-4 bg-surface border border-line rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink border-b border-line pb-2">
                <Cpu className="w-4 h-4 text-accent" />
                Hardware & Device Specifications
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Hardware Model:</span>
                  <span className="text-ink font-medium text-right">{hardware}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Firmware Build:</span>
                  <span className="text-success-ink">{firmware}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Transport Layer:</span>
                  <span className="text-accent font-bold">{connType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">MAC Address:</span>
                  <span className="text-ink">{node?.mac || '24:6F:28:7A:2C:10'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Region Frequency:</span>
                  <span className="text-warning-ink">
                    {node?.locationRegion || 'MY_919 (919-923 MHz 500mW)'}
                  </span>
                </div>
              </div>
            </div>

            {/* GPS Coordinates & Position Telemetry */}
            <div className="p-4 bg-surface border border-line rounded-xl space-y-3">
              <div className="flex items-center justify-between text-sm font-bold text-ink border-b border-line pb-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-success-ink" />
                  Live Position & Airtime Metrics
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Latitude:</span>
                  <span className="text-ink font-bold">{lat.toFixed(5)}° N</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Longitude:</span>
                  <span className="text-ink font-bold">{lng.toFixed(5)}° E</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Channel Utilization:</span>
                  <span className="text-accent">{node?.channelUtil !== undefined ? `${node.channelUtil}%` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Airtime Tx Load:</span>
                  <span className="text-accent">{node?.airUtilTx !== undefined ? `${node.airUtilTx}%` : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Last Heard:</span>
                  <span className="text-accent font-bold">
                    {formatLastHeard(node?.lastPingTime)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bound Boat Context */}
          {boat && (
            <div className="p-4 bg-surface border border-accent/30 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-accent/20 text-accent border border-accent/30">
                  <Anchor className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-ink-muted">BOUND VESSEL REGISTRATION</div>
                  <div className="text-base font-bold text-ink">{boat.name} ({boat.sailNumber})</div>
                  <p className="text-xs text-ink mt-0.5">
                    Skipper: {boat.skipper} • Class: {boat.class} • Handicap Rating: {boat.handicapRating} ({boat.handicapSystem})
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-success-ink font-bold block">
                  STATUS: {boat.status}
                </span>
                <span className="text-xs text-ink-muted">
                  DTW: {safeFixed(boat.dtw, 2, '0.00')} NM
                </span>
              </div>
            </div>
          )}

          {/* REAL-TIME CAPTURED PACKET LOGS & LORA MESSAGES SECTION */}
          <div className="p-4 bg-canvas border border-line rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-raised/20 text-ink-muted rounded-xl border border-line/40">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                    Real-time Captured Packets & LoRa RF Stream
                    <span className="text-xs bg-raised/20 text-accent px-2 py-0.5 rounded-full border border-line/40">
                      {filteredPackets.length} Packets
                    </span>
                  </h4>
                  <p className="text-xs text-ink-muted">
                    Live binary & text frames captured from this device ({targetName})
                  </p>
                </div>
              </div>

              {/* Packet Type Filter Tabs */}
              <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line">
                {(['ALL', 'TEXT', 'TELEMETRY', 'POSITION'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setPacketFilter(filter)}
                    className={`px-2 py-1 rounded-lg text-xs  font-bold transition-all ${
                      packetFilter === filter
                        ? 'bg-raised text-ink shadow-sm'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Packet Log Terminal Container */}
            <div className="bg-canvas border border-line rounded-xl p-3 max-h-64 overflow-y-auto text-xs space-y-2 custom-scrollbar">
              {filteredPackets.length === 0 ? (
                <div className="p-6 text-center text-ink-muted space-y-1">
                  <Radio className="w-6 h-6 mx-auto text-ink-muted" />
                  <p>Listening for real-time LoRa packets from {targetName}...</p>
                  <p className="text-xs text-ink-muted">Packets arrive every 2-3s when T-Echo is streaming</p>
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
                          ? 'bg-surface/20 border-warning-ink/40 text-warning-ink'
                          : isTele
                          ? 'bg-surface/20 border-success-ink/40 text-success-ink'
                          : isPos
                          ? 'bg-surface/20 border-accent/40 text-accent'
                          : 'bg-surface/60 border-line text-ink'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs opacity-75 border-b border-line/10 pb-1 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-ink font-bold">{pkt.timestamp}</span>
                          <span className="px-1.5 py-0.2 rounded text-xs font-bold bg-canvas/40 border border-line/20">
                            {pkt.portnum}
                          </span>
                          <span>From: <strong className="text-ink">{pkt.fromNodeName || pkt.fromNode}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-ink-muted">
                          {pkt.snr !== undefined && <span>SNR: {pkt.snr}dB</span>}
                          {pkt.rssi !== undefined && <span>RSSI: {pkt.rssi}dBm</span>}
                          {pkt.hops !== undefined && <span>Hops: {pkt.hops}</span>}
                        </div>
                      </div>

                      {/* Packet Content Payload */}
                      <div className="text-ink break-words">
                        {isText ? (
                          <div className="flex items-start gap-1.5 text-warning-ink font-semibold">
                            <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-warning-ink" />
                            <span>"{pkt.textMessage || pkt.payload}"</span>
                          </div>
                        ) : isTele ? (
                          <div className="flex items-start gap-1.5 text-success-ink">
                            <Gauge className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success-ink" />
                            <span>{pkt.payload}</span>
                          </div>
                        ) : isPos ? (
                          <div className="flex items-start gap-1.5 text-accent">
                            <Compass className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" />
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
                  className="w-full pl-3 pr-8 py-2 bg-canvas border border-line rounded-xl text-ink text-xs focus:border-accent focus:outline-none"
                />
                <MessageSquare className="w-4 h-4 text-ink-muted absolute right-2.5 top-2.5" />
              </div>
              <button
                type="submit"
                disabled={isSendingMessage || !outboundMessage.trim()}
                className="px-4 py-2 bg-accent hover:brightness-110 disabled:opacity-50 text-on-accent font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingMessage ? 'Transmitting...' : 'Send LoRa'}</span>
              </button>
            </form>

            {messageFeedback && (
              <p className="text-xs text-success-ink bg-success-ink/10 p-1.5 rounded border border-success-ink/30 animate-fadeIn">
                {messageFeedback}
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-canvas/90 border-t border-line flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {onDeleteNode && node && (
              <button
                onClick={() => {
                  onDeleteNode(node.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger-ink border border-danger-ink/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Remove node from system"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Node</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-raised hover:bg-raised text-ink text-xs font-bold transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
