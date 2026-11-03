import React, { useState, useEffect, useMemo } from 'react';
import { MeshtasticNode, Boat, HardwareConnection } from '../types/regatta';
import {
  X,
  Bluetooth,
  Usb,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Zap,
  HardDrive,
  Plug,
  Wifi,
  Send,
  PlusCircle,
  TowerControl,
  ExternalLink,
  Trash2,
  Clock,
  Gauge,
} from 'lucide-react';
import { formatLastHeard, safeFixed } from '../utils/formatters';
import {
  meshtasticService,
  MqttConfig,
  DEFAULT_MQTT_CONFIG,
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
  onDeleteNode?: (nodeId: string) => void;
  onClearDemoNodes?: () => void;
  onClose: () => void;
}

export const BluetoothUsbScanModal: React.FC<BluetoothUsbScanModalProps> = ({
  nodes,
  boats,
  hardwareConn,
  onUpdateHardwareConn,
  onAddScannedNode,
  onDeleteNode,
  onClearDemoNodes,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'BLUETOOTH' | 'USB' | 'MQTT'>('BLUETOOTH');
  const [isScanningBle, setIsScanningBle] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);

  // USB Serial state
  const [isConnectingUsb, setIsConnectingUsb] = useState(false);
  const [usbError, setUsbError] = useState<string | null>(null);
  const [selectedBaud, setSelectedBaud] = useState<number>(115200);
  const [serialLogs, setSerialLogs] = useState<string[]>([
    '[USB Serial] Ready for USB-C node attachment (LoRa Device, Heltec V3, RAK4631, ESP32-S3)',
  ]);

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

  // Handle Real Web Bluetooth API Connection for T-Echo
  const handleWebBluetoothScan = async () => {
    setIsScanningBle(true);
    setBleError(null);

    try {
      const fallbackLat = boats[0]?.lat || 6.3080;
      const fallbackLng = boats[0]?.lng || 99.8200;

      const res = await meshtasticService.connectTEchoBle(fallbackLat, fallbackLng);
      if (res.success && res.node) {
        onAddScannedNode(res.node);
        onUpdateHardwareConn({
          bluetoothConnected: true,
          bluetoothDeviceName: res.deviceName,
          activePort: 'BLE',
        });
        setSerialLogs((prev) => [
          `[BLE Paired] Connected to ${res.deviceName} (${res.nodeId})`,
          `[Telemetry] Real-time GATT notify stream online!`,
          ...prev,
        ]);
      } else {
        setBleError(res.error || 'Failed to connect to LoRa Device via Bluetooth');
      }
    } catch (err: any) {
      setBleError(err?.message || 'Bluetooth connection failed unexpectedly');
    } finally {
      setIsScanningBle(false);
    }
  };

  // Real Web Serial USB Connection
  const handleWebSerialConnect = async () => {
    setIsConnectingUsb(true);
    setUsbError(null);

    try {
      if (!('serial' in navigator)) {
        throw new Error('Web Serial API is not supported in this browser. Click "Simulate USB Plug-in" to test serial data stream.');
      }

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: selectedBaud });

      onUpdateHardwareConn({
        usbConnected: true,
        usbPortName: 'USB Serial (COM / ttyACM0)',
        baudRate: selectedBaud,
        activePort: 'USB',
      });

      const usbNode: MeshtasticNode = {
        id: '!USB01',
        longName: 'USB Master LoRa Device Node',
        shortName: 'USB1',
        mac: 'USB:TTY:ACM0',
        battery: 100,
        voltage: 5.0,
        satsInView: 0,
        satsInFix: 0,
        gpsFix: false,
        altitudeMeters: undefined,
        speedKt: 0,
        headingDeg: 0,
        lat: 0,
        lng: 0,
        snr: 0,
        rssi: 0,
        hops: 0,
        boundBoatId: null,
        status: 'OPTIMAL',
        connectionType: 'USB',
        lastPingTime: Date.now(),
        hardwareModel: 'LoRa Device (USB-C Mode)',
        firmwareVersion: 'v2.5.x',
        trail: [],
      };
      onAddScannedNode(usbNode);

      setSerialLogs((prev) => [
        `[USB Connected] Opened serial port at ${selectedBaud} baud!`,
        `[Meshtastic USB] Stream connected live!`,
        ...prev,
      ]);
    } catch (err: any) {
      setUsbError(err.message || 'Failed to open USB Serial Port.');
    } finally {
      setIsConnectingUsb(false);
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
      discoveredLoraNodeName || `LoRa Node ${discoveredLoraNodeId}`,
      6.3080 + (Math.random() - 0.5) * 0.01,
      99.8200 + (Math.random() - 0.5) * 0.01
    );
    onAddScannedNode(loraNode);
    setDiscoveredLoraNodeId('');
    setDiscoveredLoraNodeName('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200 font-google">
      <div className="bg-[#0A0F1E]/95 backdrop-blur-md border border-[#334155]/80 w-full max-w-3xl rounded-3xl landscape:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#E0E6ED] max-h-[calc(100vh-120px)] sm:max-h-[85vh] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-0">
        {/* Header */}
        <div className="px-5 py-4 landscape:py-2.5 bg-[#060B16]/90 border-b border-[#1E293B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#00D4FF]/15 border border-[#00D4FF]/40 flex items-center justify-center text-[#00D4FF] shrink-0 shadow-sm">
              <Radio className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2 truncate">
                LoRa Device & Mesh Hardware Hub
                <span className="text-[10px] bg-[#00D4FF]/20 text-[#00D4FF] px-2 py-0.5 rounded-full font-mono border border-[#00D4FF]/30">
                  LIVE TELEMETRY & MQTT
                </span>
              </h2>
              <p className="text-[11px] text-[#64748B] font-mono truncate">
                Connect LoRa Device via Bluetooth LE, USB-C Serial, or Stream over MQTT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/80 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#1E293B] bg-[#060B16]/60 p-2.5 gap-2 shrink-0 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('BLUETOOTH')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[120px] ${
              activeTab === 'BLUETOOTH'
                ? 'bg-[#00D4FF] text-[#020408] shadow-[0_0_12px_rgba(0,212,255,0.4)]'
                : 'bg-[#0A0F1E] text-[#94A3B8] hover:text-white border border-[#1E293B]'
            }`}
          >
            <Bluetooth className="w-4 h-4" />
            LoRa Bluetooth Tracker
            {hardwareConn.bluetoothConnected && (
              <span className="w-2 h-2 rounded-full bg-[#00FF9D] animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('USB')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[120px] ${
              activeTab === 'USB'
                ? 'bg-[#00FF9D] text-[#020408] shadow-[0_0_12px_rgba(0,255,157,0.4)]'
                : 'bg-[#0A0F1E] text-[#94A3B8] hover:text-white border border-[#1E293B]'
            }`}
          >
            <Usb className="w-4 h-4" />
            USB Serial
            {hardwareConn.usbConnected && (
              <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('MQTT')}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap min-w-[120px] ${
              activeTab === 'MQTT'
                ? 'bg-[#C084FC] text-[#020408] shadow-[0_0_12px_rgba(192,132,252,0.4)]'
                : 'bg-[#0A0F1E] text-[#94A3B8] hover:text-white border border-[#1E293B]'
            }`}
          >
            <Wifi className="w-4 h-4" />
            MQTT Stream
            {mqttConnected && (
              <span className="w-2 h-2 rounded-full bg-[#00FF9D] animate-pulse" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-5 custom-scrollbar overscroll-contain min-h-0">
          {/* BLUETOOTH TAB CONTENT */}
          {activeTab === 'BLUETOOTH' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-xl text-xs text-[#00D4FF] flex items-start gap-2.5 font-mono">
                <Radio className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-white font-google">LoRa Device Bluetooth Connection</strong>
                  1. Turn on your LoRa Device (nRF52840 / SX1262) and ensure Bluetooth is enabled.
                  <br />
                  2. Click <strong>Connect LoRa Device (Web BLE)</strong> and pair with <code>LoRa Device</code> or <code>Meshtastic_xxxx</code>.
                  <br />
                  3. If running inside an iframe, click <strong>"Open in new tab"</strong> at top right to grant Web Bluetooth permission.
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-4 rounded-xl bg-[#060B16] border border-[#1E293B] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20">
                    <Bluetooth className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {hardwareConn.bluetoothConnected
                        ? `Paired LoRa Device: ${hardwareConn.bluetoothDeviceName}`
                        : 'No Bluetooth LoRa Device Connected'}
                    </h4>
                    <p className="text-[10px] text-[#64748B] font-mono">
                      GATT Service: cb0b0001-035f-45f4-822e-b648e23003b3
                    </p>
                  </div>
                </div>

                {hardwareConn.bluetoothConnected && (
                  <span className="text-[10px] font-mono bg-[#00FF9D]/10 text-[#00FF9D] px-2.5 py-1 rounded-full border border-[#00FF9D]/30 flex items-center gap-1 font-bold">
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
                  className="w-full py-3 px-4 bg-[#00D4FF] hover:bg-cyan-300 disabled:opacity-50 text-[#020408] font-bold text-xs rounded-xl transition-all shadow-[0_0_12px_rgba(0,212,255,0.3)] flex items-center justify-center gap-2 font-mono"
                >
                  <RefreshCw className={`w-4 h-4 ${isScanningBle ? 'animate-spin' : ''}`} />
                  {isScanningBle ? 'Connecting BLE...' : 'Connect LoRa Device (Web BLE)'}
                </button>
              </div>

              {bleError && (
                <div className="p-3.5 bg-[#FF4D4D]/10 border border-[#FF4D4D]/40 rounded-xl text-xs text-[#FF4D4D] space-y-2 font-mono animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#FF4D4D]" />
                    <div className="space-y-1">
                      <strong className="block text-white font-google">Bluetooth Connection Error</strong>
                      <p className="text-[11px] text-[#FF8080] leading-relaxed">{bleError}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#FF4D4D]/20 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="px-2.5 py-1 bg-[#1E293B] hover:bg-[#334155] text-white text-[10px] rounded-lg border border-[#475569] font-bold flex items-center gap-1 transition-all"
                    >
                      <ExternalLink className="w-3 h-3 text-[#00D4FF]" />
                      Open in New Tab (Direct BLE)
                    </button>
                    <button
                      onClick={() => setActiveTab('USB')}
                      className="px-2.5 py-1 bg-[#00FF9D]/10 hover:bg-[#00FF9D]/20 text-[#00FF9D] text-[10px] rounded-lg border border-[#00FF9D]/30 font-bold flex items-center gap-1 transition-all"
                    >
                      <Plug className="w-3 h-3" />
                      Try USB Serial
                    </button>
                  </div>
                </div>
              )}

              {/* Connected Active Nodes List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-[#64748B] block">
                    Connected & Detected Nodes ({deduplicateNodes(nodes).length})
                  </label>
                  {onClearDemoNodes && deduplicateNodes(nodes).some((n) => !n.isDeviceGps && n.connectionType !== 'PHONE' && n.connectionType !== 'TABLET' && (n.id.startsWith('node-') || n.id.startsWith('!TECHO-') || n.id.startsWith('mock-'))) && (
                    <button
                      onClick={onClearDemoNodes}
                      className="text-[9.5px] font-mono font-bold text-red-400 hover:text-red-200 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all"
                      title="Clear all demo/simulated nodes"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear Demo Nodes</span>
                    </button>
                  )}
                </div>

                {deduplicateNodes(nodes).length === 0 ? (
                  <div className="p-4 bg-[#060B16] border border-dashed border-[#1E293B] rounded-xl text-center text-xs text-[#64748B] font-mono">
                    No nodes connected yet. Click "Connect LoRa Device (Web BLE)" or "Simulate" above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deduplicateNodes(nodes).map((node) => {
                      const isBle = node.isBluetoothConnected || node.connectionType === 'BLE';
                      const isDemo = !node.isDeviceGps && !node.isBluetoothConnected && node.connectionType !== 'BLE' && node.connectionType !== 'PHONE' && node.connectionType !== 'TABLET' && (node.id.startsWith('node-') || node.id.startsWith('mock-'));
                      const hasBme280 = node.sensorModel?.includes('BME280') || node.barometricPressure !== undefined || node.temperature !== undefined || node.humidity !== undefined;

                      return (
                        <div
                          key={node.id}
                          className="p-3 bg-[#060B16] rounded-xl border border-[#1E293B] hover:border-[#00D4FF]/40 transition-all flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded bg-[#0A0F1E] border border-[#1E293B] ${isBle ? 'text-[#00FF9D]' : 'text-[#00D4FF]'}`}>
                                <Bluetooth className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">{node.longName}</span>
                                  <span className="text-[10px] font-mono text-[#00D4FF] bg-[#00D4FF]/10 px-1.5 py-0.5 rounded">
                                    {node.id}
                                  </span>
                                  {isDemo && (
                                    <span className="text-[8px] font-mono text-purple-300 bg-purple-500/20 border border-purple-500/40 px-1.5 py-0.2 rounded font-bold">
                                      DEMO
                                    </span>
                                  )}
                                  {isBle && (
                                    <span className="text-[8px] font-mono text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.2 rounded font-bold">
                                      BLE LORA DEVICE
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-[#64748B] font-mono">
                                  Battery: <strong className="text-white">{node.battery}% ({node.voltage}V)</strong> • Sats:{' '}
                                  <strong className="text-[#00FF9D]">{node.satsInView}</strong> • RSSI: {node.rssi} dBm
                                </p>
                                {node.lat && node.lng ? (
                                  <p className="text-[9.5px] text-slate-300 font-mono">
                                    GPS: <strong className="text-white">{safeFixed(node.lat, 5)}°N, {safeFixed(node.lng, 5)}°E</strong> • SOG: <strong className="text-[#00D4FF]">{safeFixed(node.speedKt, 1, '0.0')}kt</strong> • COG: <strong className="text-emerald-400">{node.headingDeg ?? 0}°</strong>
                                  </p>
                                ) : null}
                                <p className="text-[9px] text-[#94A3B8] font-mono flex items-center gap-1 mt-0.5">
                                  <Clock className="w-2.5 h-2.5 text-[#00D4FF]" />
                                  Last Heard: <strong className="text-[#00D4FF]">{formatLastHeard(node.lastPingTime)}</strong>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono bg-[#00FF9D]/10 text-[#00FF9D] px-2 py-0.5 rounded border border-[#00FF9D]/20">
                                {node.connectionType}
                              </span>
                              {onDeleteNode && (
                                <button
                                  onClick={() => onDeleteNode(node.id)}
                                  className="p-1.5 rounded bg-[#0A0F1E] hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700/50 hover:border-red-500/40 transition-all"
                                  title={`Delete / remove ${node.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Environmental telemetry strip */}
                          {hasBme280 && (
                            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg px-2.5 py-1 flex items-center justify-between text-[9px] font-mono text-emerald-300 flex-wrap gap-1">
                              <span className="flex items-center gap-1 font-bold text-emerald-400">
                                <Gauge className="w-3 h-3 text-emerald-400" />
                                <span>BME280:</span>
                              </span>
                              {node.barometricPressure !== undefined && node.barometricPressure !== null && (
                                <span>🧭 {safeFixed(node.barometricPressure, 1)} hPa</span>
                              )}
                              {node.temperature !== undefined && node.temperature !== null && (
                                <span>🌡️ {safeFixed(node.temperature, 1)}°C</span>
                              )}
                              {node.humidity !== undefined && node.humidity !== null && (
                                <span>💧 {safeFixed(node.humidity, 1)}% RH</span>
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
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#060B16] border border-[#1E293B] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Plug className="w-5 h-5 text-[#00FF9D]" />
                    <h4 className="text-xs font-bold text-white">USB-C Serial Interface</h4>
                  </div>
                  {hardwareConn.usbConnected ? (
                    <span className="text-[10px] font-mono bg-[#00FF9D]/10 text-[#00FF9D] px-2.5 py-1 rounded-full border border-[#00FF9D]/30 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      CONNECTED ({hardwareConn.baudRate} BAUD)
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#64748B]">DISCONNECTED</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#64748B] font-mono block mb-1">
                      Baud Rate
                    </label>
                    <select
                      value={selectedBaud}
                      onChange={(e) => setSelectedBaud(Number(e.target.value))}
                      className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-xs text-[#00FF9D] font-mono focus:border-[#00FF9D] outline-none"
                    >
                      <option value={115200}>115200 Baud (Meshtastic Standard)</option>
                      <option value={9600}>9600 Baud (NMEA GPS Standard)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#64748B] font-mono block mb-1">
                      Protocol
                    </label>
                    <div className="bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-xs text-white font-mono">
                      Meshtastic Serial Protobuf
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleWebSerialConnect}
                  disabled={isConnectingUsb}
                  className="w-full py-3 px-4 bg-[#00FF9D] hover:bg-emerald-300 disabled:opacity-50 text-[#020408] font-bold text-xs rounded-xl transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] flex items-center justify-center gap-2 font-mono"
                >
                  <Plug className="w-4 h-4" />
                  {isConnectingUsb ? 'Connecting USB...' : 'Accept USB Connection'}
                </button>
              </div>

              {usbError && (
                <div className="p-3 bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-xl text-xs text-[#FF4D4D] flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{usbError}</span>
                </div>
              )}

              <div className="bg-[#020408] border border-[#1E293B] rounded-xl p-3 font-mono text-xs space-y-1.5 h-36 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between text-[10px] text-[#64748B] border-b border-[#1E293B] pb-1 mb-2">
                  <span className="text-[#00FF9D] flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5" /> USB SERIAL LOG
                  </span>
                  <span>115200 8N1</span>
                </div>
                {serialLogs.map((log, idx) => (
                  <div key={idx} className="text-[#94A3B8] text-[11px] truncate">
                    &gt; {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MQTT LIVE STREAM TAB */}
          {activeTab === 'MQTT' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#060B16] border border-[#1E293B] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Wifi className="w-5 h-5 text-[#C084FC]" />
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        Official Meshtastic MQTT Broker Stream
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30">
                          Root: msh
                        </span>
                      </h4>
                      <p className="text-[10px] text-[#64748B] font-mono">
                        Subscribing to official Meshtastic MQTT mesh feed
                      </p>
                    </div>
                  </div>
                  {mqttConnected ? (
                    <span className="text-[10px] font-mono bg-[#00FF9D]/10 text-[#00FF9D] px-2.5 py-1 rounded-full border border-[#00FF9D]/30 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      STREAMING LIVE
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#64748B]">DISCONNECTED</span>
                  )}
                </div>

                {/* Broker Preset Pills */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-[#64748B] font-mono uppercase block font-semibold">
                      Broker Server Presets
                    </label>
                    <span className="text-[9px] font-mono text-[#38BDF8]">Auto Server Bridge & WSS</span>
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
                        className={`text-[10px] font-mono px-2 py-1 rounded-md border transition-all ${
                          mqttConfig.brokerUrl === b.url || (b.url === 'mqtt.meshtastic.org' && mqttConfig.brokerUrl.includes('mqtt.meshtastic.org'))
                            ? 'bg-[#C084FC]/20 text-[#E0E6ED] border-[#C084FC] font-bold'
                            : 'bg-[#0A0F1E] text-[#94A3B8] border-[#1E293B] hover:border-[#475569]'
                        }`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div>
                    <label className="text-[10px] text-[#64748B] block mb-1">
                      Broker Host / WebSocket URL <span className="text-[#38BDF8]">(Default: mqtt.meshtastic.org)</span>
                    </label>
                    <input
                      type="text"
                      value={mqttConfig.brokerUrl}
                      onChange={(e) => updateAndSaveMqttConfig({ brokerUrl: e.target.value })}
                      placeholder="mqtt.meshtastic.org"
                      className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-white text-xs focus:border-[#C084FC] outline-none"
                    />
                    {mqttConfig.brokerUrl.includes('mqtt.meshtastic.org') && (
                      <p className="text-[10px] text-[#81C995] font-mono mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#81C995]" />
                        Connecting via backend container TCP bridge (Port 1883) to prevent browser WSS timeout.
                      </p>
                    )}
                  </div>

                  {/* Root Topic and Topic Presets */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-[#64748B] block">
                      Subscription Topic / Root Channel <span className="text-[#38BDF8]">(Root: msh)</span>
                    </label>
                    <input
                      type="text"
                      value={mqttConfig.topic}
                      onChange={(e) => updateAndSaveMqttConfig({ topic: e.target.value })}
                      placeholder="msh/2/json/#"
                      className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-white text-xs focus:border-[#C084FC] outline-none"
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
                          className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-all ${
                            mqttConfig.topic === t.topic
                              ? 'bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8] font-bold'
                              : 'bg-[#0A0F1E] text-[#64748B] border-[#1E293B] hover:text-[#E0E6ED]'
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
                      <label className="text-[10px] text-[#64748B] block mb-1">
                        Username <span className="text-[#94A3B8]">(Official: meshdev)</span>
                      </label>
                      <input
                        type="text"
                        value={mqttConfig.username || ''}
                        onChange={(e) => updateAndSaveMqttConfig({ username: e.target.value })}
                        placeholder="meshdev"
                        className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-white text-xs focus:border-[#C084FC] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#64748B] block mb-1">
                        Password <span className="text-[#94A3B8]">(Official: large4cats)</span>
                      </label>
                      <input
                        type="password"
                        value={mqttConfig.password || ''}
                        onChange={(e) => updateAndSaveMqttConfig({ password: e.target.value })}
                        placeholder="large4cats"
                        className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-white text-xs focus:border-[#C084FC] outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="streamOutbound"
                      checked={mqttConfig.streamOutbound}
                      onChange={(e) => setMqttConfig({ ...mqttConfig, streamOutbound: e.target.checked })}
                      className="accent-[#C084FC]"
                    />
                    <label htmlFor="streamOutbound" className="text-xs text-[#E0E6ED] select-none">
                      Stream Local LoRa Device / Telemetry Outbound to MQTT
                    </label>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConnectMqtt}
                disabled={isConnectingMqtt}
                className={`w-full py-3 px-4 font-bold text-xs rounded-xl transition-all font-mono flex items-center justify-center gap-2 ${
                  mqttConnected
                    ? 'bg-[#FF4D4D] text-white hover:bg-red-600'
                    : 'bg-[#C084FC] text-[#020408] hover:bg-purple-300 shadow-[0_0_12px_rgba(192,132,252,0.4)]'
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
                <div className="p-3 bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-xl text-xs text-[#FF4D4D] flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{mqttError}</span>
                </div>
              )}

              {/* Add Detected LoRa Mesh Node manually or automatically */}
              <div className="p-3 bg-[#060B16] border border-[#1E293B] rounded-xl space-y-2">
                <label className="text-[10px] font-mono text-[#8AB4F8] block font-bold flex items-center gap-1">
                  <TowerControl className="w-3.5 h-3.5 text-[#8AB4F8]" />
                  Add LoRa Mesh Node Detected by LoRa Device
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discoveredLoraNodeId}
                    onChange={(e) => setDiscoveredLoraNodeId(e.target.value)}
                    placeholder="Node ID (e.g. 4F92)"
                    className="flex-1 bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={discoveredLoraNodeName}
                    onChange={(e) => setDiscoveredLoraNodeName(e.target.value)}
                    placeholder="Node Name (e.g. SeaGhost)"
                    className="flex-1 bg-[#0A0F1E] border border-[#1E293B] rounded-lg p-2 text-xs text-white font-mono"
                  />
                  <button
                    onClick={handleAddManualDiscoveredNode}
                    className="px-3 bg-[#00D4FF] text-[#020408] font-bold rounded-lg text-xs hover:bg-cyan-300 font-mono flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-[#060B16]/90 border-t border-[#1E293B] flex items-center justify-between shrink-0 flex-wrap gap-2">
          <span className="text-[11px] text-[#00FF9D] font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Config Saved
          </span>
          <button
            onClick={() => {
              saveMqttConfig({ ...mqttConfig, enabled: mqttConnected });
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-[#00D4FF] text-[#020408] font-bold text-xs shadow-[0_0_12px_rgba(0,212,255,0.3)] hover:bg-cyan-300 transition-all font-mono"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
