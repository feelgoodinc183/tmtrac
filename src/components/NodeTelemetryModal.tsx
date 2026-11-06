import React, { useState, useEffect, useRef, useId } from 'react';
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
import { formatBattery, formatLastHeard, safeFixed, trackerFreshness } from '../utils/formatters';
import {
  meshtasticService,
  MeshtasticPacketLog,
} from '../services/meshtasticBleMqttService';
import { DialogFrame } from './ui/Dialog';

interface NodeTelemetryModalProps {
  node: MeshtasticNode | null;
  boat: Boat | null;
  isOpen: boolean;
  onClose: () => void;
  followedTargetId: string | null;
  onToggleFollow: (id: string, name: string) => void;
  onDeleteNode?: (nodeId: string) => void;
}

export const NodeTelemetryModal: React.FC<NodeTelemetryModalProps> = ({
  node,
  boat,
  isOpen,
  onClose,
  followedTargetId,
  onToggleFollow,
  onDeleteNode,
}) => {
  const titleId = useId();
  // Real-time Packet Log state
  const [packetLogs, setPacketLogs] = useState<MeshtasticPacketLog[]>([]);
  const [packetFilter, setPacketFilter] = useState<'ALL' | 'TEXT' | 'TELEMETRY' | 'POSITION'>('ALL');
  const [outboundMessage, setOutboundMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState<{ ok: boolean; text: string } | null>(null);
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

  if (!isOpen || (!node && !boat)) return null;

  // Telemetry: only what the tracker reported; missing readings show as a dash
  const batteryPct = node?.battery;
  const voltage = node?.voltage;
  const satsInView = node?.satsInView;
  const satsInFix = node?.satsInFix;
  const speed = boat ? boat.sog : node?.speedKt;
  const heading = boat ? boat.cog : node?.headingDeg;
  // Position as reported by the tracker (or the boat's last known position); none means none
  const lat = boat ? boat.lat : node?.lat;
  const lng = boat ? boat.lng : node?.lng;
  const hasPosition = typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0);
  const freshness = node ? trackerFreshness(node.lastPingTime) : null;
  const snr = node?.snr;
  const rssi = node?.rssi;
  const hops = node?.hops;
  const hardware = node?.hardwareModel || '—';
  const firmware = node?.firmwareVersion || '—';
  const connType = node?.connectionType || (node?.isBluetoothConnected ? 'BLE' : 'LORA_MESH');

  // BME280 / Environmental Metrics
  const temperature = node?.temperature;
  const humidity = node?.humidity ?? node?.relativeHumidity;
  const pressure = node?.barometricPressure;
  const gasResistance = node?.gasResistance;
  const iaq = node?.iaq;
  const sensorModel = node?.sensorModel || (pressure || temperature ? 'BME280 / BMP280' : undefined);

  const handleSendLoraTextMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outboundMessage.trim()) return;

    setIsSendingMessage(true);
    setMessageFeedback(null);

    try {
      const destination = node ? node.id : '^all';
      const res = await meshtasticService.sendLoraTextMessage(outboundMessage.trim(), destination);
      if (res.success) {
        setMessageFeedback({
          ok: true,
          text: `Handed to the tracker to send over LoRa: "${outboundMessage.trim()}"`,
        });
        setOutboundMessage('');
      } else {
        setMessageFeedback({ ok: false, text: `Not sent. ${res.error || 'Unknown error'}` });
      }
    } catch (err: any) {
      setMessageFeedback({ ok: false, text: `Not sent. ${err.message}` });
    } finally {
      setIsSendingMessage(false);
      // Confirmations clear themselves; errors stay until the next attempt
      setTimeout(() => setMessageFeedback((f) => (f && f.ok ? null : f)), 4500);
    }
  };

  const filteredPackets = packetLogs.filter((pkt) => {
    if (packetFilter === 'TEXT') return pkt.portnum === 'TEXT_MESSAGE_APP' || !!pkt.textMessage;
    if (packetFilter === 'TELEMETRY') return pkt.portnum === 'TELEMETRY_APP' || pkt.portnum === 'ENVIRONMENT_METRICS_APP' || !!pkt.metrics;
    if (packetFilter === 'POSITION') return pkt.portnum === 'POSITION_APP' || !!pkt.position;
    return true;
  });

  return (
    <DialogFrame
      onClose={onClose}
      labelledBy={titleId}
      closeOnBackdrop
      overlayClassName="fixed inset-0 z-[120] bg-canvas/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      className="w-full max-w-3xl bg-canvas/95 border border-line rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] min-h-0 text-ink"
    >
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
              <h3 id={titleId} className="text-base font-bold text-ink">{targetName}</h3>
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
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-xl bg-raised/80 hover:bg-raised text-ink-muted hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal Scrollable Body */}
      <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
        {/* Position as reported by the tracker */}
        <div className="p-4 bg-surface border border-line rounded-2xl space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold text-ink">Reported position</span>
            </div>
            {freshness && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border ${
                  freshness === 'live'
                    ? 'bg-success-ink/15 text-success-ink border-success-ink/40'
                    : freshness === 'stale'
                    ? 'bg-warning-ink/15 text-warning-ink border-warning-ink/40'
                    : 'bg-raised text-ink-muted border-line'
                }`}
              >
                {freshness === 'live' ? 'Live' : freshness === 'stale' ? 'Stale' : 'Offline'} · {formatLastHeard(node?.lastPingTime)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink bg-canvas p-2.5 rounded-lg border border-line">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Position: </span>
              <strong className="text-ink font-bold">
                {hasPosition ? `${lat!.toFixed(5)}° N, ${lng!.toFixed(5)}° E` : '—'}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">GPS fix: </span>
              <strong className={node?.gpsFix ? 'text-success-ink' : 'text-ink-muted'}>
                {node?.gpsFix ? `Yes${satsInFix !== undefined ? ` (${satsInFix} sats)` : ''}` : 'No fix reported'}
              </strong>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Only positions sent by this tracker are shown. This phone's own location is never used for it.
          </p>
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
              {typeof speed === 'number' ? speed.toFixed(1) : '—'} <span className="text-xs text-ink-muted">kt</span>
            </div>
            <span className="text-xs text-ink-muted mt-1">
              COG / Bearing: {typeof heading === 'number' ? `${Math.round(heading)}°` : '—'}
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
                <span className="text-ink">{node?.mac || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Region Frequency:</span>
                <span className="text-warning-ink">
                  {node?.locationRegion || '—'}
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
                <span className="text-ink font-bold">{hasPosition ? `${lat!.toFixed(5)}° N` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Longitude:</span>
                <span className="text-ink font-bold">{hasPosition ? `${lng!.toFixed(5)}° E` : '—'}</span>
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
            <p
              role={messageFeedback.ok ? 'status' : 'alert'}
              className={`text-xs p-1.5 rounded border animate-fadeIn ${
                messageFeedback.ok
                  ? 'text-success-ink bg-success-ink/10 border-success-ink/30'
                  : 'text-danger-ink bg-danger/10 border-danger-ink/30'
              }`}
            >
              {messageFeedback.text}
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
    </DialogFrame>
  );
};
