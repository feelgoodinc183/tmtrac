import React, { useState, useEffect } from 'react';
import { MeshtasticNode, Boat, HardwareConnection } from '../types/regatta';
import {
  X,
  Bluetooth,
  Usb,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Plug,
  Wifi,
  PlusCircle,
  TowerControl,
  ExternalLink,
  Trash2,
  Clock,
  Gauge,
  Link2,
} from 'lucide-react';
import { Button } from './ui/Button';
import { formatBattery, formatLastHeard, safeFixed } from '../utils/formatters';
import {
  meshtasticService,
  MqttConfig,
  loadSavedMqttConfig,
  saveMqttConfig,
  normalizeMqttWsUrl,
  deduplicateNodes,
} from '../services/meshtasticBleMqttService';

interface BluetoothUsbScanModalProps {
  nodes: MeshtasticNode[];
  boats: Boat[];
  hardwareConn: HardwareConnection;
  onUpdateHardwareConn: (conn: Partial<HardwareConnection>) => void;
  onAddScannedNode: (node: MeshtasticNode) => void;
  /** Opens the binding window for this node, where it can be linked to a boat or a boat created for it */
  onRequestBindNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onClose: () => void;
}

export const BluetoothUsbScanModal: React.FC<BluetoothUsbScanModalProps> = ({
  nodes,
  boats,
  hardwareConn,
  onUpdateHardwareConn,
  onAddScannedNode,
  onRequestBindNode,
  onDeleteNode,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'BLUETOOTH' | 'USB' | 'MQTT'>('BLUETOOTH');
  const [isScanningBle, setIsScanningBle] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);

  const [bleNotice, setBleNotice] = useState<string | null>(null);

  // MQTT state
  const [mqttConfig, setMqttConfig] = useState<MqttConfig>(() => loadSavedMqttConfig());
  const [isConnectingMqtt, setIsConnectingMqtt] = useState(false);
  const [mqttConnected, setMqttConnected] = useState<boolean>(() => meshtasticService.isConnectedToMqtt() || loadSavedMqttConfig().enabled);
  const [mqttError, setMqttError] = useState<string | null>(null);

  // Synchronize live MQTT stream status across modal open/close cycles
  useEffect(() => {
    const isConn = meshtasticService.isConnectedToMqtt() || loadSavedMqttConfig().enabled;
    setMqttConnected(isConn);

    // Verify with server MQTT bridge status
    meshtasticService.checkServerMqttStatus().then((serverActive) => {
      setMqttConnected(serverActive || meshtasticService.isConnectedToMqtt());
    });

    // Listen for live MQTT connection state updates
    const unsub = meshtasticService.onMqttStatusChange((status) => {
      setMqttConnected(status.connected);
      if (status.error) {
        setMqttError(status.error);
      }
    });

    return () => {
      unsub();
    };
  }, []);

  const updateAndSaveMqttConfig = (updates: Partial<MqttConfig>) => {
    setMqttConfig((prev) => {
      const next = { ...prev, ...updates };
      saveMqttConfig(next);
      return next;
    });
  };

  // Manual Node Discovery / Add helper
  const [discoveredLoraNodeId, setDiscoveredLoraNodeId] = useState('');
  const [discoveredLoraNodeName, setDiscoveredLoraNodeName] = useState('');

  // Connect a Meshtastic tracker over Web Bluetooth
  const handleWebBluetoothScan = async () => {
    setIsScanningBle(true);
    setBleError(null);
    setBleNotice(null);

    try {
      const res = await meshtasticService.connectTEchoBle();
      if (res.success) {
        if (res.node) onAddScannedNode(res.node);
        onUpdateHardwareConn({
          bluetoothConnected: true,
          bluetoothDeviceName: res.deviceName,
          activePort: 'BLE',
        });
        // Connected, but still waiting for the tracker to identify itself
        if (res.error) setBleNotice(res.error);
      } else {
        setBleError(res.error || 'Failed to connect to LoRa Device via Bluetooth');
      }
    } catch (err: any) {
      setBleError(err?.message || 'Bluetooth connection failed unexpectedly');
    } finally {
      setIsScanningBle(false);
    }
  };

  // Handle MQTT Connection Toggle
  const handleConnectMqtt = async () => {
    setIsConnectingMqtt(true);
    setMqttError(null);

    const willConnect = !mqttConnected;
    try {
      const normalizedBroker = normalizeMqttWsUrl(mqttConfig.brokerUrl);
      const targetConfig: MqttConfig = {
        ...mqttConfig,
        brokerUrl: normalizedBroker,
        enabled: willConnect,
      };
      updateAndSaveMqttConfig({ brokerUrl: normalizedBroker, enabled: willConnect });

      const res = await meshtasticService.connectMqtt(targetConfig);

      if (res.success) {
        setMqttConnected(willConnect);
        if (willConnect) {
          onUpdateHardwareConn({ activePort: 'MQTT' });
        }
      } else {
        setMqttError(res.error || 'Failed to connect to MQTT broker');
        setMqttConnected(false);
      }
    } catch (err: any) {
      setMqttError(err.message || 'MQTT Connection Error');
      setMqttConnected(false);
    } finally {
      setIsConnectingMqtt(false);
    }
  };

  // Add a newly detected LoRa / MQTT node
  const handleAddManualDiscoveredNode = () => {
    if (!discoveredLoraNodeId) return;
    const loraNode = meshtasticService.registerDiscoveredLoraNode(
      discoveredLoraNodeId,
      discoveredLoraNodeName || `LoRa Node ${discoveredLoraNodeId}`
    );
    onAddScannedNode(loraNode);
    setDiscoveredLoraNodeId('');
    setDiscoveredLoraNodeName('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-canvas/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200">
      <div className="bg-surface/95 backdrop-blur-md border border-line/80 w-full max-w-3xl rounded-3xl landscape:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-ink max-h-[calc(100vh-120px)] sm:max-h-[85vh] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-0">
        {/* Header */}
        <div className="px-5 py-4 landscape:py-2.5 bg-canvas/90 border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-accent/15 border border-accent/40 flex items-center justify-center text-accent shrink-0 shadow-sm">
              <Radio className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-ink flex items-center gap-2 truncate">
                LoRa Device & Mesh Hardware Hub
                <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/30">
                  LIVE TELEMETRY & MQTT
                </span>
              </h2>
              <p className="text-xs text-ink-muted truncate">
                Connect a LoRa tracker over Bluetooth, or receive trackers over MQTT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-raised/80 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-line bg-canvas/60 p-2.5 gap-2 shrink-0 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('BLUETOOTH')}
            className={`flex-1 py-2.5 px-3 rounded-2xl  text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[120px] ${
              activeTab === 'BLUETOOTH'
                ? 'bg-accent text-on-accent '
                : 'bg-surface text-ink-muted hover:text-ink border border-line'
            }`}
          >
            <Bluetooth className="w-4 h-4" />
            LoRa Bluetooth Tracker
            {hardwareConn.bluetoothConnected && (
              <span className="w-2 h-2 rounded-full bg-success-ink" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('USB')}
            className={`flex-1 py-2.5 px-3 rounded-2xl  text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[120px] ${
              activeTab === 'USB'
                ? 'bg-success-ink text-canvas '
                : 'bg-surface text-ink-muted hover:text-ink border border-line'
            }`}
          >
            <Usb className="w-4 h-4" />
            USB (not available yet)
          </button>

          <button
            onClick={() => setActiveTab('MQTT')}
            className={`flex-1 py-2.5 px-3 rounded-2xl  text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[120px] ${
              activeTab === 'MQTT'
                ? 'bg-ink text-canvas '
                : 'bg-surface text-ink-muted hover:text-ink border border-line'
            }`}
          >
            <Wifi className="w-4 h-4" />
            MQTT Stream
            {mqttConnected && (
              <span className="w-2 h-2 rounded-full bg-success-ink" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar overscroll-contain min-h-0">
          {/* BLUETOOTH TAB CONTENT */}
          {activeTab === 'BLUETOOTH' && (
            <div className="space-y-4">
              <div className="p-3 bg-accent/10 border border-accent/30 rounded-xl text-xs text-accent flex items-start gap-2.5">
                <Radio className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-ink">LoRa Device Bluetooth Connection</strong>
                  1. Turn on your LoRa Device (nRF52840 / SX1262) and ensure Bluetooth is enabled.
                  <br />
                  2. Click <strong>Connect LoRa Device (Web BLE)</strong> and pair with <code>LoRa Device</code> or <code>Meshtastic_xxxx</code>.
                  <br />
                  3. If running inside an iframe, click <strong>"Open in new tab"</strong> at top right to grant Web Bluetooth permission.
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-4 rounded-xl bg-canvas border border-line flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-accent/10 text-accent border border-accent/20">
                    <Bluetooth className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-ink">
                      {hardwareConn.bluetoothConnected
                        ? `Paired LoRa Device: ${hardwareConn.bluetoothDeviceName}`
                        : 'No Bluetooth LoRa Device Connected'}
                    </h4>
                    <p className="text-xs text-ink-muted">
                      GATT Service: cb0b0001-035f-45f4-822e-b648e23003b3
                    </p>
                  </div>
                </div>

                {hardwareConn.bluetoothConnected && (
                  <span className="text-xs bg-success-ink/10 text-success-ink px-2.5 py-1 rounded-full border border-success-ink/30 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    LIVE TELEMETRY
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleWebBluetoothScan}
                  disabled={isScanningBle}
                  className="w-full py-3 px-4 bg-accent hover:brightness-110 disabled:opacity-50 text-on-accent font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isScanningBle ? 'animate-spin' : ''}`} />
                  {isScanningBle ? 'Connecting BLE...' : 'Connect LoRa Device (Web BLE)'}
                </button>
              </div>

              {bleError && (
                <div className="p-3.5 bg-danger/10 border border-danger-ink/40 rounded-xl text-xs text-danger-ink space-y-2 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-danger-ink" />
                    <div className="space-y-1">
                      <strong className="block text-ink">Bluetooth Connection Error</strong>
                      <p className="text-xs text-danger-ink leading-relaxed">{bleError}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-danger-ink/20 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="px-2.5 py-1 bg-raised hover:bg-raised text-ink text-xs rounded-lg border border-line font-bold flex items-center gap-1 transition-all"
                    >
                      <ExternalLink className="w-3 h-3 text-accent" />
                      Open in New Tab (Direct BLE)
                    </button>
                  </div>
                </div>
              )}

              {bleNotice && (
                <div className="p-3 bg-warning-ink/10 border border-warning-ink/40 rounded-xl text-xs text-warning-ink flex items-start gap-2" role="status">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{bleNotice}</span>
                </div>
              )}

              {/* Connected Active Nodes List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-ink-muted block">
                    Connected & Detected Nodes ({deduplicateNodes(nodes).length})
                  </label>
                </div>

                {deduplicateNodes(nodes).length === 0 ? (
                  <div className="p-4 bg-canvas border border-dashed border-line rounded-xl text-center text-xs text-ink-muted">
                    No nodes connected yet. Click "Connect LoRa Device (Web BLE)" above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deduplicateNodes(nodes).map((node) => {
                      const isBle = node.isBluetoothConnected || node.connectionType === 'BLE';
                      const hasBme280 = node.sensorModel?.includes('BME280') || node.barometricPressure !== undefined || node.temperature !== undefined || node.humidity !== undefined;

                      return (
                        <div
                          key={node.id}
                          className="p-3 bg-canvas rounded-xl border border-line hover:border-accent/40 transition-all flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded bg-surface border border-line ${isBle ? 'text-success-ink' : 'text-accent'}`}>
                                <Bluetooth className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-ink">{node.longName}</span>
                                  <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                    {node.id}
                                  </span>
                                  {isBle && (
                                    <span className="text-xs text-success-ink bg-success-ink/20 border border-success-ink/40 px-1.5 py-0.2 rounded font-bold">
                                      BLE LORA DEVICE
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-ink-muted">
                                  Battery: <strong className="text-ink">{formatBattery(node.battery)}{node.voltage !== undefined ? ` (${node.voltage}V)` : ''}</strong> • Sats:{' '}
                                  <strong className="text-success-ink">{node.satsInView ?? '—'}</strong> • RSSI: {node.rssi ?? '—'} dBm
                                </p>
                                {node.lat && node.lng ? (
                                  <p className="text-xs text-ink">
                                    GPS: <strong className="text-ink">{safeFixed(node.lat, 5)}°N, {safeFixed(node.lng, 5)}°E</strong> • SOG: <strong className="text-accent">{node.speedKt !== undefined ? `${safeFixed(node.speedKt, 1)} kt` : '—'}</strong> • COG: <strong className="text-success-ink">{node.headingDeg !== undefined ? `${node.headingDeg}°` : '—'}</strong>
                                  </p>
                                ) : (
                                  <p className="text-xs text-ink-muted">No position reported yet</p>
                                )}
                                <p className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
                                  <Clock className="w-2.5 h-2.5 text-accent" />
                                  Last Heard: <strong className="text-accent">{formatLastHeard(node.lastPingTime)}</strong>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-success-ink/10 text-success-ink px-2 py-0.5 rounded border border-success-ink/20">
                                {node.connectionType}
                              </span>
                              {onRequestBindNode && (() => {
                                const boundBoat = boats.find((b) => b.id === node.boundBoatId);
                                return (
                                  <Button
                                    icon={<Link2 />}
                                    onClick={() => onRequestBindNode(node.id)}
                                    title={boundBoat ? `Bound to ${boundBoat.name}. Change boat` : 'Bind this tracker to a boat'}
                                  >
                                    {boundBoat ? boundBoat.name : 'Bind to boat'}
                                  </Button>
                                );
                              })()}
                              {onDeleteNode && (
                                <button
                                  onClick={() => onDeleteNode(node.id)}
                                  className="p-1.5 rounded bg-surface hover:bg-danger/20 text-ink-muted hover:text-danger-ink border border-line/50 hover:border-danger-ink/40 transition-all"
                                  title={`Delete / remove ${node.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Environmental telemetry strip */}
                          {hasBme280 && (
                            <div className="bg-surface/20 border border-success-ink/30 rounded-lg px-2.5 py-1 flex items-center justify-between text-xs text-success-ink flex-wrap gap-1">
                              <span className="flex items-center gap-1 font-bold text-success-ink">
                                <Gauge className="w-3 h-3 text-success-ink" />
                                <span>BME280:</span>
                              </span>
                              {node.barometricPressure !== undefined && node.barometricPressure !== null && (
                                <span>{safeFixed(node.barometricPressure, 1)} hPa</span>
                              )}
                              {node.temperature !== undefined && node.temperature !== null && (
                                <span>{safeFixed(node.temperature, 1)}°C</span>
                              )}
                              {node.humidity !== undefined && node.humidity !== null && (
                                <span>{safeFixed(node.humidity, 1)}% RH</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* USB SERIAL TAB */}
          {activeTab === 'USB' && (
            <div className="p-4 rounded-xl bg-canvas border border-line space-y-2">
              <div className="flex items-center gap-2.5">
                <Plug className="w-5 h-5 text-ink-muted" />
                <h4 className="text-xs font-bold text-ink">USB connection: not available yet</h4>
              </div>
              <p className="text-xs text-ink-muted">
                Reading a tracker over USB isn't supported yet. Connect it over Bluetooth instead, or receive it through MQTT.
              </p>
            </div>
          )}

          {/* MQTT LIVE STREAM TAB */}
          {activeTab === 'MQTT' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-canvas border border-line space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Wifi className="w-5 h-5 text-ink-muted" />
                    <div>
                      <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
                        Official Meshtastic MQTT Broker Stream
                        <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/30">
                          Root: msh
                        </span>
                      </h4>
                      <p className="text-xs text-ink-muted">
                        Subscribing to official Meshtastic MQTT mesh feed
                      </p>
                    </div>
                  </div>
                  {mqttConnected ? (
                    <span className="text-xs bg-success-ink/10 text-success-ink px-2.5 py-1 rounded-full border border-success-ink/30 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      STREAMING LIVE
                    </span>
                  ) : (
                    <span className="text-xs text-ink-muted">DISCONNECTED</span>
                  )}
                </div>

                {/* Broker Preset Pills */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-ink-muted block font-semibold">
                      Broker Server Presets
                    </label>
                    <span className="text-xs text-accent">Auto Server Bridge & WSS</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: 'Official Meshtastic (Server Bridge)', url: 'mqtt.meshtastic.org', user: 'meshdev', pass: 'large4cats' },
                      { name: 'HiveMQ Public (WSS)', url: 'wss://broker.hivemq.com:8884/mqtt', user: '', pass: '' },
                      { name: 'EMQX Public (WSS)', url: 'wss://broker.emqx.io:8084/mqtt', user: '', pass: '' },
                    ].map((b) => (
                      <button
                        key={b.url}
                        type="button"
                        onClick={() =>
                          updateAndSaveMqttConfig({
                            brokerUrl: b.url,
                            username: b.user,
                            password: b.pass,
                          })
                        }
                        className={`text-xs  px-2 py-1 rounded-md border transition-all ${
                          mqttConfig.brokerUrl === b.url || (b.url === 'mqtt.meshtastic.org' && mqttConfig.brokerUrl.includes('mqtt.meshtastic.org'))
                            ? 'bg-ink/20 text-ink border-line font-bold'
                            : 'bg-surface text-ink-muted border-line hover:border-line'
                        }`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-xs text-ink-muted block mb-1">
                      Broker Host / WebSocket URL <span className="text-accent">(Default: mqtt.meshtastic.org)</span>
                    </label>
                    <input
                      type="text"
                      value={mqttConfig.brokerUrl}
                      onChange={(e) => updateAndSaveMqttConfig({ brokerUrl: e.target.value })}
                      placeholder="mqtt.meshtastic.org"
                      className="w-full bg-surface border border-line rounded-lg p-2 text-ink text-xs focus:border-line outline-none"
                    />
                    {mqttConfig.brokerUrl.includes('mqtt.meshtastic.org') && (
                      <p className="text-xs text-success-ink mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-success-ink" />
                        Connecting via backend container TCP bridge (Port 1883) to prevent browser WSS timeout.
                      </p>
                    )}
                  </div>

                  {/* Root Topic and Topic Presets */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-ink-muted block">
                      Subscription Topic / Root Channel <span className="text-accent">(Root: msh)</span>
                    </label>
                    <input
                      type="text"
                      value={mqttConfig.topic}
                      onChange={(e) => updateAndSaveMqttConfig({ topic: e.target.value })}
                      placeholder="msh/2/json/#"
                      className="w-full bg-surface border border-line rounded-lg p-2 text-ink text-xs focus:border-line outline-none"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {[
                        { label: 'msh/2/json/# (Official JSON)', topic: 'msh/2/json/#' },
                        { label: 'msh/2/c/LongFast/# (LongFast)', topic: 'msh/2/c/LongFast/#' },
                        { label: 'msh/# (All Mesh)', topic: 'msh/#' },
                        { label: 'msh/MY_919/2/json/# (MY)', topic: 'msh/MY_919/2/json/#' },
                        { label: 'msh/US/2/json/# (US)', topic: 'msh/US/2/json/#' },
                        { label: 'msh/EU_868/2/json/# (EU)', topic: 'msh/EU_868/2/json/#' },
                      ].map((t) => (
                        <button
                          key={t.topic}
                          type="button"
                          onClick={() => updateAndSaveMqttConfig({ topic: t.topic })}
                          className={`text-xs  px-2 py-0.5 rounded border transition-all ${
                            mqttConfig.topic === t.topic
                              ? 'bg-accent/20 text-accent border-accent font-bold'
                              : 'bg-surface text-ink-muted border-line hover:text-ink'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auth Credentials */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-xs text-ink-muted block mb-1">
                        Username <span className="text-ink-muted">(Official: meshdev)</span>
                      </label>
                      <input
                        type="text"
                        value={mqttConfig.username || ''}
                        onChange={(e) => updateAndSaveMqttConfig({ username: e.target.value })}
                        placeholder="meshdev"
                        className="w-full bg-surface border border-line rounded-lg p-2 text-ink text-xs focus:border-line outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-ink-muted block mb-1">
                        Password <span className="text-ink-muted">(Official: large4cats)</span>
                      </label>
                      <input
                        type="password"
                        value={mqttConfig.password || ''}
                        onChange={(e) => updateAndSaveMqttConfig({ password: e.target.value })}
                        placeholder="large4cats"
                        className="w-full bg-surface border border-line rounded-lg p-2 text-ink text-xs focus:border-line outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="streamOutbound"
                        checked={mqttConfig.streamOutbound}
                        onChange={(e) => {
                          updateAndSaveMqttConfig({ streamOutbound: e.target.checked });
                          meshtasticService.setStreamOutbound(e.target.checked);
                        }}
                        className="accent-line"
                      />
                      <label htmlFor="streamOutbound" className="text-xs text-ink select-none">
                        Share tracker positions to this broker
                      </label>
                    </div>
                    {mqttConfig.streamOutbound && (
                      <p className="text-xs text-warning-ink flex items-center gap-1" role="alert">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Positions become public: anyone subscribed to this broker can see where your trackers are.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={handleConnectMqtt}
                disabled={isConnectingMqtt}
                className={`w-full py-3 px-4 font-bold text-xs rounded-xl transition-all  flex items-center justify-center gap-2 ${
                  mqttConnected
                    ? 'bg-danger text-on-danger hover:brightness-110'
                    : 'bg-ink text-canvas hover:bg-ink '
                }`}
              >
                <Wifi className="w-4 h-4" />
                {isConnectingMqtt
                  ? 'Connecting Broker...'
                  : mqttConnected
                  ? 'Disconnect MQTT Stream'
                  : 'Start MQTT Live Telemetry Stream'}
              </button>

              {mqttError && (
                <div className="p-3 bg-danger/10 border border-danger-ink/30 rounded-xl text-xs text-danger-ink flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{mqttError}</span>
                </div>
              )}

              {/* Add Detected LoRa Mesh Node manually or automatically */}
              <div className="p-3 bg-canvas border border-line rounded-xl space-y-2">
                <label className="text-xs text-accent block font-bold flex items-center gap-1">
                  <TowerControl className="w-3.5 h-3.5 text-accent" />
                  Add LoRa Mesh Node Detected by LoRa Device
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discoveredLoraNodeId}
                    onChange={(e) => setDiscoveredLoraNodeId(e.target.value)}
                    placeholder="Node ID (e.g. 4F92)"
                    className="flex-1 bg-surface border border-line rounded-lg p-2 text-xs text-ink"
                  />
                  <input
                    type="text"
                    value={discoveredLoraNodeName}
                    onChange={(e) => setDiscoveredLoraNodeName(e.target.value)}
                    placeholder="Node Name (e.g. SeaGhost)"
                    className="flex-1 bg-surface border border-line rounded-lg p-2 text-xs text-ink"
                  />
                  <button
                    onClick={handleAddManualDiscoveredNode}
                    className="px-3 bg-accent text-on-accent font-bold rounded-lg text-xs hover:brightness-110 flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-canvas/90 border-t border-line flex items-center justify-between shrink-0 flex-wrap gap-2">
          <span className="text-xs text-success-ink flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Config Saved
          </span>
          <button
            onClick={() => {
              saveMqttConfig({ ...mqttConfig, enabled: mqttConnected });
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-accent text-on-accent font-bold text-xs hover:brightness-110 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
