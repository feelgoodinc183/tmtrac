import React, { useState, useEffect } from 'react';
import { MeshtasticNode, Boat, HardwareConnection } from '../types/regatta';
import {
  X,
  Bluetooth,
  Usb,
  Radio,
  RefreshCw,
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
  deduplicateNodes,
  BleStatus,
} from '../services/meshtasticBleMqttService';
import { ConfirmDialog } from './ConfirmDialog';
import { MqttSettingsPanel } from './MqttSettingsPanel';

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

  const [bleStatus, setBleStatus] = useState<BleStatus>(() => meshtasticService.getBleStatus());
  const [lastDeviceName] = useState<string | null>(() => meshtasticService.getLastBleDeviceName());
  const [canReconnectWithoutPicker, setCanReconnectWithoutPicker] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => meshtasticService.onBleStatusChange(setBleStatus), []);

  // After a reload, offer to reconnect to the last tracker (without the picker where the browser allows)
  useEffect(() => {
    let cancelled = false;
    meshtasticService.findRememberedBleDevice().then((d) => {
      if (!cancelled) setCanReconnectWithoutPicker(Boolean(d));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // MQTT status (the server's bridge) for the tab indicator
  const [mqttConnected, setMqttConnected] = useState<boolean>(() => meshtasticService.isConnectedToMqtt());
  useEffect(() => meshtasticService.onMqttStatusChange((st) => setMqttConnected(st.connected)), []);

  // Manual Node Discovery / Add helper
  const [discoveredLoraNodeId, setDiscoveredLoraNodeId] = useState('');
  const [discoveredLoraNodeName, setDiscoveredLoraNodeName] = useState('');

  // Connect a Meshtastic tracker over Web Bluetooth (picker), or reconnect to the last one
  const runBleConnect = async (reconnect: boolean) => {
    setIsScanningBle(true);
    setBleError(null);
    try {
      const res = reconnect ? await meshtasticService.reconnectBle() : await meshtasticService.connectTEchoBle();
      if (res.success) {
        if (res.node) onAddScannedNode(res.node);
      } else {
        setBleError(res.error || 'Could not connect to the tracker over Bluetooth.');
      }
    } catch (err: any) {
      setBleError(err?.message || 'Bluetooth connection failed unexpectedly');
    } finally {
      setIsScanningBle(false);
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
                  <strong className="block text-ink">Connecting a Meshtastic tracker</strong>
                  1. Turn the tracker on and make sure it isn't connected to the Meshtastic app or another phone.
                  <br />
                  2. Click <strong>Connect tracker over Bluetooth</strong> and pick it from the list (e.g. <code>Meshtastic_xxxx</code>). Enter its PIN if asked.
                  <br />
                  3. For speed and heading, turn on the <strong>Speed</strong> and <strong>Heading</strong> position flags in the tracker's Position settings (Meshtastic app). Without them, the tracker sends only its position.
                </div>
              </div>

              {/* Connection status */}
              {(() => {
                const st = bleStatus.state;
                const name = bleStatus.deviceName || hardwareConn.bluetoothDeviceName || 'tracker';
                const title =
                  st === 'connected' ? `Connected to ${name}`
                  : st === 'connecting' ? `Connecting to ${name}…`
                  : st === 'configuring' ? `Reading ${name}'s configuration and node list…`
                  : st === 'reconnecting' ? `Connection to ${name} lost. Reconnecting (attempt ${bleStatus.attempt} of ${bleStatus.maxAttempts})…`
                  : st === 'lost' ? `Lost connection to ${name}`
                  : 'No tracker connected over Bluetooth';
                const tone =
                  st === 'connected' ? 'text-success-ink border-success-ink/30 bg-success-ink/10'
                  : st === 'reconnecting' || st === 'lost' ? 'text-warning-ink border-warning-ink/40 bg-warning-ink/10'
                  : 'text-ink border-line bg-canvas';
                return (
                  <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 flex-wrap ${tone}`} role="status" aria-live="polite">
                    <div className="flex items-center gap-3 min-w-0">
                      <Bluetooth className="w-5 h-5 shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold">{title}</h4>
                        {st === 'lost' && bleStatus.error && <p className="text-xs">{bleStatus.error}</p>}
                        {st === 'disconnected' && lastDeviceName && (
                          <p className="text-xs text-ink-muted">Last used: {lastDeviceName}</p>
                        )}
                      </div>
                    </div>
                    {st === 'connected' && (
                      <Button onClick={() => setConfirmDisconnect(true)}>Disconnect</Button>
                    )}
                  </div>
                );
              })()}

              {/* Action Buttons */}
              {bleStatus.state !== 'connected' && (
                <div className="flex flex-col sm:flex-row gap-3">
                  {(bleStatus.state === 'lost' || (bleStatus.state === 'disconnected' && lastDeviceName)) && (
                    <Button
                      variant="primary"
                      className="w-full"
                      icon={<RefreshCw />}
                      loading={isScanningBle}
                      loadingLabel="Connecting…"
                      onClick={() => runBleConnect(bleStatus.state === 'lost' || canReconnectWithoutPicker)}
                    >
                      {`Reconnect ${bleStatus.deviceName || lastDeviceName || 'tracker'}`}
                    </Button>
                  )}
                  <Button
                    variant={bleStatus.state === 'lost' || (bleStatus.state === 'disconnected' && lastDeviceName) ? 'secondary' : 'primary'}
                    className="w-full"
                    icon={<Bluetooth />}
                    loading={isScanningBle}
                    loadingLabel="Connecting…"
                    disabled={bleStatus.state === 'connecting' || bleStatus.state === 'configuring' || bleStatus.state === 'reconnecting'}
                    onClick={() => runBleConnect(false)}
                  >
                    {lastDeviceName ? 'Connect a tracker…' : 'Connect tracker over Bluetooth'}
                  </Button>
                </div>
              )}

              {confirmDisconnect && (
                <ConfirmDialog
                  title="Disconnect the tracker?"
                  body="The boat bound to it stops getting position updates from this device until you reconnect."
                  confirmLabel="Disconnect"
                  onCancel={() => setConfirmDisconnect(false)}
                  onConfirm={() => {
                    setConfirmDisconnect(false);
                    meshtasticService.disconnectBle();
                  }}
                />
              )}

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

              {/* Connected Active Nodes List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-ink-muted block">
                    Connected & Detected Nodes ({deduplicateNodes(nodes).length})
                  </label>
                </div>

                {deduplicateNodes(nodes).length === 0 ? (
                  <div className="p-4 bg-canvas border border-dashed border-line rounded-xl text-center text-xs text-ink-muted">
                    No trackers yet. Connect one over Bluetooth above.
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

          {/* MQTT TAB */}
          {activeTab === 'MQTT' && (
            <div className="space-y-4">
              <MqttSettingsPanel />

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
        <div className="px-5 py-3.5 bg-canvas/90 border-t border-line flex items-center justify-end shrink-0 flex-wrap gap-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-accent text-on-accent font-bold text-xs hover:brightness-110 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
