import mqtt, { MqttClient } from 'mqtt';
import { MeshtasticNode, BackfillPoint } from '../types/regatta';
import { canonicalNodeId, nodeNumFromId } from '../utils/nodeId';
import { nodeStatusFromLastPing, formatBattery } from '../utils/formatters';
import {
  BROADCAST_NUM,
  DeviceMetadataMsg,
  FromRadioMsg,
  KMH_TO_KT,
  MeshPacketMsg,
  NodeInfoMsg,
  PortNum,
  decodeFromRadio,
  decodePosition,
  decodeTelemetry,
  decodeUser,
  encodeToRadioPacket,
  encodeWantConfig,
  hardwareModelName,
  newPacketId,
  positionLatLng,
  positionSpeedKt,
  positionTrackDeg,
} from './meshtastic/protocol';

export interface MeshtasticPacketLog {
  id: string;
  timestamp: string;
  rawTimestamp: number;
  fromNode: string;
  fromNodeName?: string;
  toNode: string;
  portnum: 'POSITION_APP' | 'NODEINFO_APP' | 'TELEMETRY_APP' | 'ENVIRONMENT_METRICS_APP' | 'TEXT_MESSAGE_APP' | 'ROUTING_APP' | 'ADMIN_APP' | string;
  snr?: number;
  rssi?: number;
  hops?: number;
  payload: string;
  textMessage?: string;
  metrics?: {
    temperature?: number;
    humidity?: number;
    relativeHumidity?: number;
    barometricPressure?: number;
    gasResistance?: number;
    iaq?: number;
    voltage?: number;
    batteryLevel?: number;
    sensorModel?: string;
  };
  position?: {
    lat?: number;
    lng?: number;
    alt?: number;
    speedKt?: number;
    headingDeg?: number;
    sats?: number;
  };
}

// Meshtastic Bluetooth service and characteristics (see meshtastic.org "Client API")
export const MESHTASTIC_SERVICE_UUID = '6ba1b218-15a8-461f-9fa8-5dcae273eafd';
export const FROM_RADIO_UUID = '2c55e69e-4993-11ed-b878-0242ac120002'; // read: one FromRadio per read, empty when drained
export const TO_RADIO_UUID = 'f75c76d2-129e-4dad-a1dd-7866124401e7'; // write: one ToRadio per write
export const FROM_NUM_UUID = 'ed9da18c-a800-4f66-a670-aa7547e34453'; // notify: new FromRadio data is waiting

// Standard BLE battery service
export const BATTERY_SERVICE_UUID = '0000180f-0000-1000-8000-00805f9b34fb';
export const BATTERY_LEVEL_UUID = '00002a19-0000-1000-8000-00805f9b34fb';

export type BleConnectionState = 'disconnected' | 'connecting' | 'configuring' | 'connected' | 'reconnecting' | 'lost';

export interface BleStatus {
  state: BleConnectionState;
  deviceName?: string;
  /** Reconnect attempt number while state is 'reconnecting' */
  attempt?: number;
  maxAttempts?: number;
  error?: string;
}

const STORAGE_KEY_LAST_BLE_DEVICE = 'tmtrac_last_ble_device_v1';
// Waits between automatic reconnect attempts; after the last one the user is asked
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];
const CONFIG_TIMEOUT_MS = 20_000;

const PORT_LABELS: Record<number, MeshtasticPacketLog['portnum']> = {
  [PortNum.TEXT_MESSAGE_APP]: 'TEXT_MESSAGE_APP',
  [PortNum.POSITION_APP]: 'POSITION_APP',
  [PortNum.NODEINFO_APP]: 'NODEINFO_APP',
  [PortNum.ROUTING_APP]: 'ROUTING_APP',
  [PortNum.TELEMETRY_APP]: 'TELEMETRY_APP',
};


export interface MqttConfig {
  brokerUrl: string; // Official Meshtastic WebSocket: wss://mqtt.meshtastic.org/mqtt
  topic: string; // Official root topic format: msh/2/json/# or msh/2/c/LongFast/#
  username?: string; // Default: meshdev
  password?: string; // Default: large4cats
  enabled: boolean;
  streamOutbound: boolean;
}

export const DEFAULT_MQTT_CONFIG: MqttConfig = {
  brokerUrl: 'wss://mqtt.meshtastic.org/mqtt',
  topic: 'msh/2/json/#',
  username: 'meshdev',
  password: 'large4cats',
  enabled: false,
  // Off by default: when on, every tracker position is published to the broker, which for the
  // public Meshtastic broker means anyone can see it.
  streamOutbound: false,
};

export const STORAGE_KEY_MQTT_CONFIG = 'tmtrac_mqtt_config_v2';
// Set once the one-time reset of "share positions to the broker" has run on this browser
const STORAGE_KEY_OUTBOUND_RESET = 'tmtrac_mqtt_outbound_off_v1';

// 240-Hour NodeDB Display Filter Cutoff (10 Days = 240 * 3600 * 1000 ms)
export const NODE_DB_MAX_AGE_HOURS = 240;
export const NODE_DB_MAX_AGE_MS = 240 * 60 * 60 * 1000;

/**
 * Filter function to check if a node was heard within the 240-hour window.
 * Returns true if last heard timestamp is within 240 hours from now.
 */
export function isNodeWithin240Hours(node: MeshtasticNode | null | undefined): boolean {
  if (!node) return false;
  if (!node.lastPingTime) return true; // Active / new node
  const ageMs = Date.now() - node.lastPingTime;
  return ageMs <= NODE_DB_MAX_AGE_MS;
}

/**
 * Canonical node id: "!" plus 8 lowercase hex digits for Meshtastic nodes (see utils/nodeId).
 */
export function getCanonicalNodeId(id: string): string {
  return canonicalNodeId(id);
}

/**
 * Deduplicates node lists to ensure each physical node appears exactly once,
 * retaining the newest timestamp and merging telemetry data (BME280 sensor, GPS, battery).
 * Automatically excludes nodes whose lastPingTime is older than 240 hours.
 */
export function deduplicateNodes(nodes: MeshtasticNode[]): MeshtasticNode[] {
  if (!Array.isArray(nodes)) return [];
  const map = new Map<string, MeshtasticNode>();

  for (const node of nodes) {
    if (!node || !node.id) continue;
    if (!isNodeWithin240Hours(node)) continue;

    const canonicalId = getCanonicalNodeId(node.id);
    const existing = map.get(canonicalId);

    if (!existing) {
      map.set(canonicalId, { ...node, id: canonicalId });
    } else {
      // Retain the copy with the latest data and merge all telemetry fields
      const isNewer = (node.lastPingTime || 0) >= (existing.lastPingTime || 0);
      const primary = isNewer ? node : existing;
      const secondary = isNewer ? existing : node;

      const mergedTrail = primary.trail && primary.trail.length > 0
        ? primary.trail
        : (secondary.trail || []);

      const mergedNode: MeshtasticNode = {
        ...secondary,
        ...primary,
        id: canonicalId,
        lat: primary.lat !== undefined && primary.lat !== 0 ? primary.lat : secondary.lat,
        lng: primary.lng !== undefined && primary.lng !== 0 ? primary.lng : secondary.lng,
        trail: mergedTrail,
        temperature: primary.temperature !== undefined ? primary.temperature : secondary.temperature,
        humidity: primary.humidity !== undefined ? primary.humidity : secondary.humidity,
        relativeHumidity: primary.relativeHumidity !== undefined ? primary.relativeHumidity : secondary.relativeHumidity,
        barometricPressure: primary.barometricPressure !== undefined ? primary.barometricPressure : secondary.barometricPressure,
        gasResistance: primary.gasResistance !== undefined ? primary.gasResistance : secondary.gasResistance,
        iaq: primary.iaq !== undefined ? primary.iaq : secondary.iaq,
        sensorModel: primary.sensorModel || secondary.sensorModel || (primary.temperature !== undefined ? 'BME280' : undefined),
        boundBoatId: primary.boundBoatId || secondary.boundBoatId || null,
        isBluetoothConnected: primary.isBluetoothConnected || secondary.isBluetoothConnected || false,
        lastPingTime: Math.max(primary.lastPingTime || 0, secondary.lastPingTime || 0),
      };

      map.set(canonicalId, mergedNode);
    }
  }

  return Array.from(map.values());
}

/**
 * Normalizes user-input broker URLs to valid browser WebSocket URLs (wss:// or ws://)
 * Fixes "Missing protocol" error when users enter domains like "mqtt.meshtastic.org"
 */
export function normalizeMqttWsUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim().replace(/['"]/g, '');
  if (!url) {
    return 'wss://mqtt.meshtastic.org/mqtt';
  }

  // Convert raw TCP or SSL protocols to WebSockets
  if (url.startsWith('mqtt://') || url.startsWith('tcp://')) {
    url = url.replace(/^(mqtt|tcp):\/\//i, 'ws://');
  } else if (url.startsWith('mqtts://') || url.startsWith('ssl://') || url.startsWith('tls://')) {
    url = url.replace(/^(mqtts|ssl|tls):\/\//i, 'wss://');
  }

  // If no scheme was provided at all (e.g. "mqtt.meshtastic.org" or "broker.hivemq.com:8884")
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = `wss://${url}`;
  }

  // Special handling for official Meshtastic broker
  if (url.includes('mqtt.meshtastic.org')) {
    // Strip standard TCP ports (1883/8883) because browsers require WebSocket on port 443
    url = url.replace(':1883', '').replace(':8883', '');
    // Ensure /mqtt path is appended for web clients
    if (!url.includes('/mqtt') && (url.endsWith('mqtt.meshtastic.org') || url.endsWith('mqtt.meshtastic.org/'))) {
      url = url.replace(/\/$/, '') + '/mqtt';
    }
  }

  // Special handling for HiveMQ public broker
  if (url.includes('broker.hivemq.com')) {
    if (!url.includes(':8884')) {
      url = 'wss://broker.hivemq.com:8884/mqtt';
    } else if (!url.includes('/mqtt')) {
      url = `${url.replace(/\/$/, '')}/mqtt`;
    }
  }

  // Special handling for EMQX public broker
  if (url.includes('broker.emqx.io')) {
    if (!url.includes(':8084')) {
      url = 'wss://broker.emqx.io:8084/mqtt';
    } else if (!url.includes('/mqtt')) {
      url = `${url.replace(/\/$/, '')}/mqtt`;
    }
  }

  return url;
}

export function loadSavedMqttConfig(): MqttConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MQTT_CONFIG);
    // Configs saved before broker sharing defaulted to off had it on; turn it off once.
    const needsOutboundReset = localStorage.getItem(STORAGE_KEY_OUTBOUND_RESET) !== '1';
    if (needsOutboundReset) {
      localStorage.setItem(STORAGE_KEY_OUTBOUND_RESET, '1');
    }
    if (saved) {
      const parsed = JSON.parse(saved);
      if (needsOutboundReset && parsed.streamOutbound) {
        parsed.streamOutbound = false;
        localStorage.setItem(STORAGE_KEY_MQTT_CONFIG, JSON.stringify(parsed));
      }
      const brokerUrl = parsed.brokerUrl ? normalizeMqttWsUrl(parsed.brokerUrl) : DEFAULT_MQTT_CONFIG.brokerUrl;
      return { ...DEFAULT_MQTT_CONFIG, ...parsed, brokerUrl, streamOutbound: parsed.streamOutbound === true };
    }
  } catch (e) {
    console.warn('Failed to load saved MQTT config:', e);
  }
  return { ...DEFAULT_MQTT_CONFIG };
}

export function saveMqttConfig(config: Partial<MqttConfig>): MqttConfig {
  try {
    const current = loadSavedMqttConfig();
    const updated = {
      ...current,
      ...config,
      brokerUrl: config.brokerUrl ? normalizeMqttWsUrl(config.brokerUrl) : current.brokerUrl,
    };
    localStorage.setItem(STORAGE_KEY_MQTT_CONFIG, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save MQTT config:', e);
    return { ...DEFAULT_MQTT_CONFIG, ...config };
  }
}

type NodeUpdateCallback = (node: MeshtasticNode) => void;
type PacketCallback = (pktLog: any) => void;

export class MeshtasticBleMqttService {
  private gattDevice: any = null;
  private fromRadioChar: any = null;
  private toRadioChar: any = null;
  private fromNumChar: any = null;
  // Fallback polling, only used when FromNum notifications can't be enabled
  private pollIntervalTimer: any = null;
  private gattChain: Promise<unknown> = Promise.resolve();
  private draining = false;
  private drainAgain = false;
  private configId = 0;
  private configComplete = false;
  private configWaiter: ((ok: boolean) => void) | null = null;
  private pendingMetadata: DeviceMetadataMsg | null = null;
  private userDisconnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private bleStatus: BleStatus = { state: 'disconnected' };
  private bleStatusCallbacks: Array<(status: BleStatus) => void> = [];


  private mqttClient: MqttClient | null = null;
  private isMqttConnected = false;
  private mqttStatusCallbacks: Array<(status: { connected: boolean; brokerUrl?: string; error?: string }) => void> = [];
  private nodeCallbacks: NodeUpdateCallback[] = [];
  private packetCallbacks: PacketCallback[] = [];

  private isBleConnected = false;
  private connectedDeviceName = '';
  private connectedNodeId = '';
  private nodeBindings: Map<string, string> = new Map();
  
  // Track live node state to update dynamically when BLE telemetry arrives
  private tEchoNodeState: MeshtasticNode | null = null;
  // Battery level read from the BLE battery service before the tracker's node id is known
  private pendingBatteryLevel: number | undefined;
  private discoveredBleNodes: Map<string, MeshtasticNode> = new Map();

  // Packet Log Ring Buffer Storage (per-node and global)
  private nodePacketsMap: Map<string, MeshtasticPacketLog[]> = new Map();
  private globalPacketLogs: MeshtasticPacketLog[] = [];

  // Historical Telemetry Point Buffers for LoRa Store-and-Forward Replay
  private nodePositionBuffers: Map<string, BackfillPoint[]> = new Map();

  // Store active MQTT Config
  private mqttConfig: MqttConfig = { ...DEFAULT_MQTT_CONFIG };

  public getNodeHistory(nodeId: string): BackfillPoint[] {
    return this.nodePositionBuffers.get(canonicalNodeId(nodeId)) || [];
  }

  public setNodeBoundBoatId(nodeId: string, boatId: string | null) {
    const canonicalId = canonicalNodeId(nodeId);
    if (boatId) {
      this.nodeBindings.set(canonicalId, boatId);
    } else {
      this.nodeBindings.delete(canonicalId);
    }

    if (this.tEchoNodeState && this.tEchoNodeState.id === canonicalId) {
      this.tEchoNodeState.boundBoatId = boatId;
    }

    const existing = this.discoveredBleNodes.get(canonicalId);
    if (existing) {
      existing.boundBoatId = boatId;
    }
  }

  public getNodeBoundBoatId(nodeId: string): string | null {
    return this.nodeBindings.get(canonicalNodeId(nodeId)) || null;
  }

  /** Turn sharing of tracker positions to the MQTT broker on or off for this session */
  public setStreamOutbound(enabled: boolean) {
    this.mqttConfig = { ...this.mqttConfig, streamOutbound: enabled };
  }

  public onMqttStatusChange(cb: (status: { connected: boolean; brokerUrl?: string; error?: string }) => void) {
    this.mqttStatusCallbacks.push(cb);
    cb({ connected: this.isConnectedToMqtt(), brokerUrl: this.mqttConfig.brokerUrl });
    return () => {
      this.mqttStatusCallbacks = this.mqttStatusCallbacks.filter((c) => c !== cb);
    };
  }

  public emitMqttStatus(status: { connected: boolean; brokerUrl?: string; error?: string }) {
    this.isMqttConnected = status.connected;
    this.mqttStatusCallbacks.forEach((cb) => cb(status));
  }

  public isConnectedToMqtt(): boolean {
    return this.isMqttConnected || Boolean(this.mqttClient && this.mqttClient.connected);
  }

  public isBleActive(): boolean {
    return this.bleStatus.state === 'connected';
  }

  public isUsbActive(): boolean {
    return false;
  }

  public async checkServerMqttStatus(): Promise<boolean> {
    try {
      const res = await fetch('/api/mqtt/status');
      const data = await res.json();
      if (data && typeof data.connected === 'boolean') {
        this.isMqttConnected = data.connected;
        this.emitMqttStatus({
          connected: data.connected,
          brokerUrl: data.brokerUrl,
          error: data.error,
        });
        return data.connected;
      }
    } catch (e) {
      // Offline / fetch failed
    }
    return this.isConnectedToMqtt();
  }

  public handleServerMqttStatus(status: any) {
    if (status && typeof status.connected === 'boolean') {
      this.isMqttConnected = status.connected;
      this.emitMqttStatus({
        connected: status.connected,
        brokerUrl: status.brokerUrl,
        error: status.error,
      });
    }
  }

  public onNodeUpdate(cb: NodeUpdateCallback) {
    this.nodeCallbacks.push(cb);
    return () => {
      this.nodeCallbacks = this.nodeCallbacks.filter((c) => c !== cb);
    };
  }

  public onPacketLog(cb: PacketCallback) {
    this.packetCallbacks.push(cb);
    return () => {
      this.packetCallbacks = this.packetCallbacks.filter((c) => c !== cb);
    };
  }

  public emitNode(node: MeshtasticNode) {
    node.status = nodeStatusFromLastPing(node.lastPingTime);
    this.nodeCallbacks.forEach((cb) => cb(node));
  }

  public emitPacketLog(pkt: Partial<MeshtasticPacketLog> & { fromNode: string; payload: string }) {
    const rawTimestamp = pkt.rawTimestamp || Date.now();
    const formattedTimestamp = pkt.timestamp || new Date(rawTimestamp).toLocaleTimeString();
    const id = pkt.id || `pkt-${rawTimestamp}-${Math.floor(Math.random() * 1000)}`;
    const portnum = pkt.portnum || 'POSITION_APP';
    const toNode = pkt.toNode || '^all';

    const fullLog: MeshtasticPacketLog = {
      id,
      timestamp: formattedTimestamp,
      rawTimestamp,
      fromNode: pkt.fromNode,
      fromNodeName: pkt.fromNodeName,
      toNode,
      portnum,
      snr: pkt.snr,
      rssi: pkt.rssi,
      hops: pkt.hops,
      payload: pkt.payload,
      textMessage: pkt.textMessage,
      metrics: pkt.metrics,
      position: pkt.position,
    };

    // Store in global packet log ring buffer (most recent first, up to 500)
    this.globalPacketLogs = [fullLog, ...this.globalPacketLogs.slice(0, 499)];

    // Store in per-node packet buffer
    const fromCanon = getCanonicalNodeId(fullLog.fromNode);
    const existingFrom = this.nodePacketsMap.get(fromCanon) || [];
    this.nodePacketsMap.set(fromCanon, [fullLog, ...existingFrom.slice(0, 199)]);

    if (toNode && toNode !== '^all' && toNode !== '!FFFFFFFF') {
      const toCanon = getCanonicalNodeId(toNode);
      const existingTo = this.nodePacketsMap.get(toCanon) || [];
      this.nodePacketsMap.set(toCanon, [fullLog, ...existingTo.slice(0, 199)]);
    }

    this.packetCallbacks.forEach((cb) => cb(fullLog));
  }

  /**
   * Retrieves all packet logs captured from or addressed to a specific node
   */
  public getNodePacketLogs(nodeId: string): MeshtasticPacketLog[] {
    if (!nodeId) return [];
    const canon = getCanonicalNodeId(nodeId);
    return this.nodePacketsMap.get(canon) || [];
  }

  /**
   * Retrieves global real-time packet logs
   */
  public getGlobalPacketLogs(): MeshtasticPacketLog[] {
    return this.globalPacketLogs;
  }

  /**
   * Clears captured packet logs (optionally for a specific node)
   */
  public clearPacketLogs(nodeId?: string) {
    if (nodeId) {
      const canon = getCanonicalNodeId(nodeId);
      this.nodePacketsMap.delete(canon);
      this.globalPacketLogs = this.globalPacketLogs.filter((p) => getCanonicalNodeId(p.fromNode) !== canon && getCanonicalNodeId(p.toNode) !== canon);
    } else {
      this.nodePacketsMap.clear();
      this.globalPacketLogs = [];
    }
  }

  /**
   * Sends a text message to the mesh through the connected tracker (Bluetooth ToRadio), or
   * publishes it to the connected MQTT broker. Reports failure, with a reason, when there is no
   * way to send it or every write failed.
   */
  public async sendLoraTextMessage(
    text: string,
    destinationNodeId: string = '^all'
  ): Promise<{ success: boolean; packetId?: number; via?: 'BLE' | 'MQTT'; error?: string }> {
    const cleanText = (text || '').trim();
    if (!cleanText) return { success: false, error: 'Message cannot be empty' };

    const hasBle = Boolean(this.toRadioChar && this.bleStatus.state === 'connected');
    const hasMqtt = Boolean(this.mqttClient && this.mqttClient.connected);
    if (!hasBle && !hasMqtt) {
      return {
        success: false,
        error: 'No tracker is connected. Connect one over Bluetooth (or connect to an MQTT broker) to send messages.',
      };
    }

    const myNodeId = this.connectedNodeId || 'this device';
    const myName = this.connectedDeviceName || undefined;
    const destNum = nodeNumFromId(destinationNodeId);
    const isBroadcast = destNum === null || destNum === BROADCAST_NUM;
    const toNodeNum = isBroadcast ? BROADCAST_NUM : destNum!;
    const targetDisplay = isBroadcast ? 'Broadcast (^all)' : `Direct (${canonicalNodeId(destinationNodeId)})`;
    const packetId = newPacketId();

    let via: 'BLE' | 'MQTT' | undefined;
    const errors: string[] = [];

    // 1. Hand the packet to the tracker over Bluetooth
    if (hasBle) {
      try {
        await this.writeToRadio(encodeToRadioPacket({
          to: toNodeNum,
          portnum: PortNum.TEXT_MESSAGE_APP,
          payload: new TextEncoder().encode(cleanText),
          id: packetId,
          wantAck: !isBroadcast,
          // Meshtastic's default hop limit
          hopLimit: 3,
        }));
        via = 'BLE';
      } catch (err: any) {
        errors.push(`Bluetooth write failed: ${err?.message || 'unknown error'}`);
      }
    }

    // 2. Otherwise publish to the MQTT broker
    if (!via && hasMqtt) {
      try {
        const cleanBase = this.mqttConfig.topic.replace(/\/?[+#]$/, '').replace(/\/+$/, '');
        const hasChannel = cleanBase.split('/').length >= 4;
        const dest = isBroadcast ? '^all' : canonicalNodeId(destinationNodeId);
        const topic = hasChannel ? `${cleanBase}/${dest}` : `${cleanBase}/LongFast/${dest}`;

        const mqttPayload = JSON.stringify({
          channel: 0,
          from: nodeNumFromId(this.connectedNodeId) ?? undefined,
          to: toNodeNum,
          type: 'sendtext',
          sender: myName,
          payload: { text: cleanText },
          id: packetId,
          timestamp: Math.floor(Date.now() / 1000),
        });

        await new Promise<void>((resolve, reject) => {
          this.mqttClient!.publish(topic, mqttPayload, { qos: 0 }, (err) => (err ? reject(err) : resolve()));
        });
        via = 'MQTT';
      } catch (mqttErr: any) {
        errors.push(`MQTT publish failed: ${mqttErr?.message || 'unknown error'}`);
      }
    }

    if (!via) {
      return { success: false, error: errors.join(' ') || 'Message could not be sent.' };
    }

    this.emitPacketLog({
      id: `pkt-tx-${packetId}`,
      timestamp: new Date().toLocaleTimeString(),
      rawTimestamp: Date.now(),
      fromNode: myNodeId,
      fromNodeName: myName,
      toNode: isBroadcast ? '^all' : canonicalNodeId(destinationNodeId),
      portnum: 'TEXT_MESSAGE_APP',
      hops: 0,
      payload: `TX via ${via === 'BLE' ? 'tracker (Bluetooth)' : 'MQTT broker'} [${targetDisplay}]: "${cleanText}"`,
      textMessage: cleanText,
    });
    return { success: true, packetId, via };
  }

  // --- BLUETOOTH CONNECTION STATUS ---

  public onBleStatusChange(cb: (status: BleStatus) => void) {
    this.bleStatusCallbacks.push(cb);
    cb({ ...this.bleStatus });
    return () => {
      this.bleStatusCallbacks = this.bleStatusCallbacks.filter((c) => c !== cb);
    };
  }

  public getBleStatus(): BleStatus {
    return { ...this.bleStatus };
  }

  private setBleStatus(status: BleStatus) {
    this.bleStatus = status;
    this.isBleConnected = status.state === 'connected' || status.state === 'configuring';
    this.bleStatusCallbacks.forEach((cb) => cb({ ...status }));
  }

  /** Name of the tracker last connected over Bluetooth in this browser, if any */
  public getLastBleDeviceName(): string | null {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_LAST_BLE_DEVICE) || 'null');
      return saved?.name || null;
    } catch {
      return null;
    }
  }

  /**
   * The tracker last connected in this browser, if the browser still allows reconnecting to it
   * without the device picker (navigator.bluetooth.getDevices, where supported).
   */
  public async findRememberedBleDevice(): Promise<any | null> {
    try {
      const bt = (navigator as any).bluetooth;
      if (!bt || typeof bt.getDevices !== 'function') return null;
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_LAST_BLE_DEVICE) || 'null');
      if (!saved?.id) return null;
      const devices: any[] = await bt.getDevices();
      return devices.find((d) => d.id === saved.id) || null;
    } catch {
      return null;
    }
  }

  private rememberBleDevice(device: any) {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_BLE_DEVICE, JSON.stringify({ id: device.id, name: device.name || '' }));
    } catch {}
  }

  // --- WEB BLUETOOTH CONNECTION ---
  //
  // Follows the Meshtastic client protocol:
  // 1. Subscribe to FromNum notifications.
  // 2. Write ToRadio { want_config_id }.
  // 3. Read FromRadio until empty, again on each FromNum notification, until config_complete_id
  //    with our id arrives. Only then is the tracker's own node shown.
  // All GATT reads and writes go through one queue, so only one runs at a time.

  /** Shows the browser's device picker and connects to the chosen Meshtastic tracker. */
  public async connectTEchoBle(): Promise<{ success: boolean; deviceName: string; nodeId: string; node?: MeshtasticNode; error?: string }> {
    const bt = (navigator as any).bluetooth;
    if (!bt) {
      return { success: false, deviceName: '', nodeId: '', error: 'Web Bluetooth is not supported in this browser. Use Chrome or Edge (on Android, Windows, macOS or ChromeOS).' };
    }

    let device: any;
    try {
      device = await bt.requestDevice({
        filters: [{ services: [MESHTASTIC_SERVICE_UUID] }],
        optionalServices: [BATTERY_SERVICE_UUID],
      });
    } catch (err: any) {
      if (err?.name === 'NotFoundError') {
        return { success: false, deviceName: '', nodeId: '', error: 'No tracker was selected.' };
      }
      return { success: false, deviceName: '', nodeId: '', error: err?.message || 'Bluetooth request failed.' };
    }
    return this.connectToBleDevice(device, false);
  }

  /** Reconnects to the last tracker without the picker where possible; otherwise shows the picker. */
  public async reconnectBle(): Promise<{ success: boolean; deviceName: string; nodeId: string; node?: MeshtasticNode; error?: string }> {
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;
    const device = this.gattDevice || (await this.findRememberedBleDevice());
    if (device) return this.connectToBleDevice(device, false);
    return this.connectTEchoBle();
  }

  /** Disconnects the Bluetooth tracker on purpose (no automatic reconnect). */
  public disconnectBle() {
    this.userDisconnected = true;
    this.clearReconnectTimer();
    this.teardownGatt(true);
    this.markLocalNodeDisconnected();
    this.setBleStatus({ state: 'disconnected', deviceName: this.connectedDeviceName || undefined });
  }

  private async connectToBleDevice(
    device: any,
    isAutoReconnect: boolean
  ): Promise<{ success: boolean; deviceName: string; nodeId: string; node?: MeshtasticNode; error?: string }> {
    if (this.gattDevice && this.gattDevice !== device) {
      this.gattDevice.removeEventListener?.('gattserverdisconnected', this.onGattDisconnected);
      this.teardownGatt(true);
    }
    this.userDisconnected = false;
    this.gattDevice = device;
    this.connectedDeviceName = device.name || '';
    this.rememberBleDevice(device);
    device.removeEventListener?.('gattserverdisconnected', this.onGattDisconnected);
    device.addEventListener('gattserverdisconnected', this.onGattDisconnected);

    const deviceName = this.connectedDeviceName || undefined;
    if (!isAutoReconnect) {
      this.setBleStatus({ state: 'connecting', deviceName });
    }

    try {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(MESHTASTIC_SERVICE_UUID);
      this.toRadioChar = await service.getCharacteristic(TO_RADIO_UUID);
      this.fromRadioChar = await service.getCharacteristic(FROM_RADIO_UUID);
      this.fromNumChar = await service.getCharacteristic(FROM_NUM_UUID);

      // Battery level from the standard battery service, if exposed; applied once the node id is known
      this.pendingBatteryLevel = undefined;
      try {
        const batService = await server.getPrimaryService(BATTERY_SERVICE_UUID);
        const batChar = await batService.getCharacteristic(BATTERY_LEVEL_UUID);
        const val: DataView = await this.gattOp(() => batChar.readValue());
        this.pendingBatteryLevel = val.getUint8(0);
      } catch {
        // Not exposed by this device
      }

      // FromNum notifications tell us when to read. Poll only if notifications don't work.
      let notifying = false;
      try {
        await this.gattOp(() => this.fromNumChar.startNotifications());
        this.fromNumChar.addEventListener('characteristicvaluechanged', this.onFromNum);
        notifying = true;
      } catch (err) {
        console.warn('[BLE] FromNum notifications unavailable; polling instead', err);
      }
      if (!notifying) this.startFallbackPolling();

      this.setBleStatus({ state: 'configuring', deviceName });
      const ok = await this.runConfigHandshake();
      if (!ok) {
        throw new Error('The tracker did not finish sending its configuration in time.');
      }

      this.reconnectAttempt = 0;
      this.setBleStatus({ state: 'connected', deviceName });
      return { success: true, deviceName: this.connectedDeviceName, nodeId: this.connectedNodeId, node: this.tEchoNodeState ?? undefined };
    } catch (err: any) {
      const message = this.describeBleError(err);
      this.teardownGatt(true);
      if (!isAutoReconnect) {
        this.setBleStatus({ state: 'disconnected', deviceName, error: message });
      }
      return { success: false, deviceName: this.connectedDeviceName, nodeId: '', error: message };
    }
  }

  private describeBleError(err: any): string {
    const raw = err?.message || String(err || 'Bluetooth connection failed.');
    if (/in an iframe|cross-origin|permissions policy/i.test(raw)) {
      return `${raw} Open the app in its own tab and try again.`;
    }
    if (err?.name === 'NetworkError' || /GATT|connection/i.test(raw)) {
      return `${raw} Make sure the tracker is on, in range, and not connected to the Meshtastic app or another device.`;
    }
    return raw;
  }

  private onFromNum = () => {
    void this.drainFromRadio();
  };

  private onGattDisconnected = () => {
    const wasUp = this.bleStatus.state === 'connected' || this.bleStatus.state === 'configuring';
    this.teardownGatt(false);
    this.markLocalNodeDisconnected();
    if (this.userDisconnected || !wasUp) return;
    console.warn('[BLE] Tracker disconnected; reconnecting');
    this.reconnectAttempt = 0;
    this.scheduleReconnect();
  };

  private scheduleReconnect() {
    this.clearReconnectTimer();
    const deviceName = this.connectedDeviceName || undefined;
    if (this.reconnectAttempt >= RECONNECT_DELAYS_MS.length || !this.gattDevice) {
      this.setBleStatus({
        state: 'lost',
        deviceName,
        error: 'Lost the Bluetooth connection to the tracker and could not reconnect.',
      });
      return;
    }
    const delay = RECONNECT_DELAYS_MS[this.reconnectAttempt];
    this.reconnectAttempt += 1;
    this.setBleStatus({ state: 'reconnecting', deviceName, attempt: this.reconnectAttempt, maxAttempts: RECONNECT_DELAYS_MS.length });
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.userDisconnected || !this.gattDevice) return;
      const res = await this.connectToBleDevice(this.gattDevice, true);
      if (!res.success && !this.userDisconnected) this.scheduleReconnect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Drops characteristics and timers. With `disconnectGatt`, also closes the GATT link. */
  private teardownGatt(disconnectGatt: boolean) {
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
    try {
      this.fromNumChar?.removeEventListener('characteristicvaluechanged', this.onFromNum);
    } catch {}
    // The gattserverdisconnected event this causes is ignored: by then the status is no longer
    // 'connected' or 'configuring', or the user disconnected on purpose
    if (disconnectGatt && this.gattDevice?.gatt?.connected) {
      try {
        this.gattDevice.gatt.disconnect();
      } catch {}
    }
    this.fromRadioChar = null;
    this.toRadioChar = null;
    this.fromNumChar = null;
    this.configComplete = false;
    this.configWaiter?.(false);
    this.configWaiter = null;
    this.isBleConnected = false;
  }

  private markLocalNodeDisconnected() {
    // Keep the node and its last-heard time; it goes stale, then offline, on its own
    if (this.tEchoNodeState) {
      this.tEchoNodeState = { ...this.tEchoNodeState, isBluetoothConnected: false };
      this.discoveredBleNodes.set(this.tEchoNodeState.id, this.tEchoNodeState);
      this.emitNode(this.tEchoNodeState);
    }
  }

  private startFallbackPolling() {
    if (this.pollIntervalTimer) clearInterval(this.pollIntervalTimer);
    this.pollIntervalTimer = setInterval(() => {
      if (this.fromRadioChar) void this.drainFromRadio();
    }, 2000);
  }

  /** Runs GATT operations one at a time */
  private gattOp<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.gattChain.then(fn, fn);
    this.gattChain = run.catch(() => undefined);
    return run;
  }

  private async writeToRadio(bytes: Uint8Array) {
    const ch = this.toRadioChar;
    if (!ch) throw new Error('No tracker is connected over Bluetooth.');
    await this.gattOp(() =>
      typeof ch.writeValueWithResponse === 'function' ? ch.writeValueWithResponse(bytes) : ch.writeValue(bytes)
    );
  }

  /** Reads FromRadio until it is empty. A request while draining causes one more pass. */
  private async drainFromRadio() {
    if (this.draining) {
      this.drainAgain = true;
      return;
    }
    this.draining = true;
    try {
      do {
        this.drainAgain = false;
        // Upper bound so a misbehaving device can't keep us here forever
        for (let i = 0; i < 1000; i++) {
          const ch = this.fromRadioChar;
          if (!ch) return;
          const dv: DataView = await this.gattOp(() => ch.readValue());
          if (!dv || dv.byteLength === 0) break;
          this.handleFromRadioBytes(new Uint8Array(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength)));
        }
      } while (this.drainAgain && this.fromRadioChar);
    } catch (err) {
      console.warn('[BLE] FromRadio read failed:', err);
    } finally {
      this.draining = false;
    }
  }

  /** want_config_id, then read until config_complete_id with the same id (or time out) */
  private async runConfigHandshake(): Promise<boolean> {
    this.configComplete = false;
    this.configId = newPacketId();
    const completed = new Promise<boolean>((resolve) => {
      this.configWaiter = resolve;
    });

    await this.writeToRadio(encodeWantConfig(this.configId));

    // Keep draining while the config dump is in progress, in case a notification is missed
    const kick = setInterval(() => void this.drainFromRadio(), 500);
    void this.drainFromRadio();
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), CONFIG_TIMEOUT_MS));
    try {
      return await Promise.race([completed, timeout]);
    } finally {
      clearInterval(kick);
      this.configWaiter = null;
    }
  }

  public getConnectedNodeState(): MeshtasticNode | null {
    return this.tEchoNodeState;
  }

  /**
   * Adds or updates a node from data that node reported, and emits it.
   *
   * - Only fields present in `partial` change; nothing is filled in with made-up defaults.
   * - `lastPingTime` only moves when the caller says the node was just heard (or gives the
   *   time the radio last heard it); otherwise the previous value is kept.
   * - A node's position only comes from that node's own packets.
   */
  private upsertDiscoveredNode(
    nodeId: string,
    partial: Partial<MeshtasticNode>,
    isLocalBleDevice: boolean = false,
    source: 'BLE' | 'MQTT' = 'BLE'
  ): MeshtasticNode {
    const canonicalId = canonicalNodeId(nodeId);
    const hexSuffix = canonicalId.replace('!', '').slice(-4);
    const existing = this.discoveredBleNodes.get(canonicalId);
    // The tracker connected over Bluetooth stays the local device even when it is also heard via MQTT
    const isLocal = isLocalBleDevice || (Boolean(this.connectedNodeId) && canonicalId === this.connectedNodeId);

    const hasNewPosition =
      typeof partial.lat === 'number' && typeof partial.lng === 'number' &&
      Number.isFinite(partial.lat) && Number.isFinite(partial.lng) &&
      (partial.lat !== 0 || partial.lng !== 0);
    const lat = hasNewPosition ? partial.lat : existing?.lat;
    const lng = hasNewPosition ? partial.lng : existing?.lng;

    let trail = existing?.trail || [];
    if (hasNewPosition) {
      const last = trail[trail.length - 1];
      if (!last || last.lat !== lat || last.lng !== lng) {
        trail = [...trail, { lat: lat as number, lng: lng as number }].slice(-1000);
      }
    }

    const nodeTemp = partial.temperature !== undefined ? partial.temperature : existing?.temperature;
    const nodeHum = partial.humidity !== undefined ? partial.humidity : (partial.relativeHumidity !== undefined ? partial.relativeHumidity : existing?.humidity);

    const node: MeshtasticNode = {
      id: canonicalId,
      longName: partial.longName || existing?.longName || `Node ${hexSuffix}`,
      shortName: partial.shortName || existing?.shortName || hexSuffix,
      mac: partial.mac || existing?.mac || '',
      battery: partial.battery ?? existing?.battery,
      voltage: partial.voltage ?? existing?.voltage,
      satsInView: partial.satsInView ?? existing?.satsInView,
      satsInFix: partial.satsInFix ?? existing?.satsInFix,
      gpsFix: typeof lat === 'number' && typeof lng === 'number',
      altitudeMeters: partial.altitudeMeters ?? existing?.altitudeMeters,
      speedKt: partial.speedKt ?? existing?.speedKt,
      headingDeg: partial.headingDeg ?? existing?.headingDeg,
      lat,
      lng,
      snr: partial.snr ?? existing?.snr,
      rssi: partial.rssi ?? existing?.rssi,
      hops: partial.hops ?? existing?.hops,
      boundBoatId: partial.boundBoatId ?? this.nodeBindings.get(canonicalId) ?? existing?.boundBoatId ?? null,
      status: existing?.status ?? 'OFFLINE',
      connectionType: isLocal ? 'BLE' : (partial.connectionType || existing?.connectionType || (source === 'MQTT' ? 'MQTT' : 'LORA_MESH')),
      isBluetoothConnected: isLocal ? this.isBleConnected : false,
      lastPingTime: partial.lastPingTime ?? existing?.lastPingTime ?? 0,
      hardwareModel: partial.hardwareModel || existing?.hardwareModel,
      firmwareVersion: partial.firmwareVersion || existing?.firmwareVersion,
      channelUtil: partial.channelUtil ?? existing?.channelUtil,
      airUtilTx: partial.airUtilTx ?? existing?.airUtilTx,
      trail,

      // Environmental sensor data
      temperature: nodeTemp,
      humidity: nodeHum,
      relativeHumidity: nodeHum,
      barometricPressure: partial.barometricPressure ?? existing?.barometricPressure,
      gasResistance: partial.gasResistance ?? existing?.gasResistance,
      iaq: partial.iaq ?? existing?.iaq,
      sensorModel: partial.sensorModel || existing?.sensorModel,
    };

    this.discoveredBleNodes.set(canonicalId, node);
    if (isLocal) {
      this.tEchoNodeState = node;
    }

    // The tracker's own node is shown once the config handshake has finished
    const holdUntilConfigured = isLocal && source === 'BLE' && !this.configComplete;
    if (!holdUntilConfigured) {
      this.emitNode(node);
    }

    // Only share a fresh position from this node, and never echo MQTT traffic back to the broker
    if (
      source !== 'MQTT' &&
      hasNewPosition &&
      this.mqttConfig.enabled &&
      this.mqttConfig.streamOutbound
    ) {
      this.publishNodeToMqtt(node);
    }

    return node;
  }

  // --- FROMRADIO HANDLING ---

  /** Decodes one FromRadio message (public so recorded packets can be replayed in tests) */
  public handleFromRadioBytes(bytes: Uint8Array) {
    let fr: FromRadioMsg;
    try {
      fr = decodeFromRadio(bytes);
    } catch (err) {
      console.warn('[BLE] Could not decode FromRadio:', err);
      return;
    }

    if (fr.myInfo?.myNodeNum !== undefined) this.handleMyInfo(fr.myInfo.myNodeNum);
    if (fr.metadata) this.handleMetadata(fr.metadata);
    if (fr.nodeInfo) this.handleNodeInfo(fr.nodeInfo);
    if (fr.packet) this.handlePacket(fr.packet);

    if (fr.configCompleteId !== undefined && fr.configCompleteId === this.configId) {
      this.configComplete = true;
      // The tracker's own node is shown only now, with its real id and config
      if (this.tEchoNodeState) this.emitNode(this.tEchoNodeState);
      this.configWaiter?.(true);
      this.configWaiter = null;
    }

    if (fr.rebooted && this.bleStatus.state === 'connected') {
      // The device restarted and forgot our session; ask for its config again
      this.setBleStatus({ state: 'configuring', deviceName: this.connectedDeviceName || undefined });
      void this.runConfigHandshake().then((ok) => {
        if (this.toRadioChar) {
          this.setBleStatus(ok
            ? { state: 'connected', deviceName: this.connectedDeviceName || undefined }
            : { state: 'lost', deviceName: this.connectedDeviceName || undefined, error: 'The tracker restarted and did not resend its configuration.' });
        }
      });
    }
  }

  private handleMyInfo(myNodeNum: number) {
    const myId = canonicalNodeId(myNodeNum);
    this.connectedNodeId = myId;
    this.upsertDiscoveredNode(myId, {
      longName: this.connectedDeviceName || undefined,
      connectionType: 'BLE',
      battery: this.pendingBatteryLevel,
      firmwareVersion: this.pendingMetadata?.firmwareVersion,
      hardwareModel: hardwareModelName(this.pendingMetadata?.hwModel),
      // The tracker is talking to us over Bluetooth right now
      lastPingTime: Date.now(),
    }, true);
    this.pendingBatteryLevel = undefined;
    this.pendingMetadata = null;
  }

  private handleMetadata(md: DeviceMetadataMsg) {
    if (!this.connectedNodeId) {
      this.pendingMetadata = md;
      return;
    }
    this.upsertDiscoveredNode(this.connectedNodeId, {
      firmwareVersion: md.firmwareVersion,
      hardwareModel: hardwareModelName(md.hwModel),
    }, true);
  }

  private handleNodeInfo(ni: NodeInfoMsg) {
    if (ni.num === undefined && !ni.user?.id) return;
    const id = canonicalNodeId(ni.num ?? ni.user!.id!);
    const isLocal = Boolean(this.connectedNodeId) && id === this.connectedNodeId;
    const pos = ni.position;
    const latLng = pos ? positionLatLng(pos) : null;

    // The radio's NodeDB says when it last heard each node; a node it never heard has no time.
    // Our own tracker is connected right now.
    const lastPingTime = isLocal
      ? Date.now()
      : (ni.lastHeard && ni.lastHeard > 0 ? Math.min(ni.lastHeard * 1000, Date.now()) : undefined);

    const node = this.upsertDiscoveredNode(id, {
      longName: ni.user?.longName || (isLocal ? this.connectedDeviceName || undefined : undefined),
      shortName: ni.user?.shortName,
      hardwareModel: hardwareModelName(ni.user?.hwModel),
      lat: latLng?.lat,
      lng: latLng?.lng,
      altitudeMeters: pos?.altitude,
      speedKt: pos ? positionSpeedKt(pos) : undefined,
      headingDeg: pos ? positionTrackDeg(pos) : undefined,
      satsInView: pos?.satsInView,
      battery: ni.deviceMetrics?.batteryLevel,
      voltage: ni.deviceMetrics?.voltage !== undefined ? +ni.deviceMetrics.voltage.toFixed(2) : undefined,
      channelUtil: ni.deviceMetrics?.channelUtilization !== undefined ? +ni.deviceMetrics.channelUtilization.toFixed(1) : undefined,
      airUtilTx: ni.deviceMetrics?.airUtilTx !== undefined ? +ni.deviceMetrics.airUtilTx.toFixed(1) : undefined,
      snr: ni.snr,
      hops: isLocal ? 0 : ni.hopsAway,
      connectionType: isLocal ? 'BLE' : (ni.viaMqtt ? 'MQTT' : 'LORA_MESH'),
      lastPingTime,
    }, isLocal);

    this.emitPacketLog({
      id: `pkt-nodedb-${id}-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      rawTimestamp: Date.now(),
      fromNode: node.id,
      fromNodeName: node.longName,
      toNode: '^all',
      portnum: 'NODEINFO_APP',
      snr: ni.snr,
      hops: isLocal ? 0 : ni.hopsAway,
      payload: `NodeDB entry: ${node.longName} (${node.id})${latLng ? ` at ${latLng.lat.toFixed(4)}, ${latLng.lng.toFixed(4)}` : ', no position'}${ni.hopsAway !== undefined ? `, ${ni.hopsAway} hops away` : ''}`,
    });
  }

  private handlePacket(p: MeshPacketMsg) {
    if (p.from === undefined) return;
    const senderId = canonicalNodeId(p.from);
    const isLocal = Boolean(this.connectedNodeId) && senderId === this.connectedNodeId;
    const hops = isLocal
      ? 0
      : (p.hopStart !== undefined && p.hopLimit !== undefined && p.hopStart >= p.hopLimit ? p.hopStart - p.hopLimit : undefined);

    const updates: Partial<MeshtasticNode> = {
      snr: p.rxSnr,
      rssi: p.rxRssi,
      hops,
      connectionType: isLocal ? 'BLE' : (p.viaMqtt ? 'MQTT' : 'LORA_MESH'),
      // We just received a packet from this node
      lastPingTime: Date.now(),
    };

    const portnum = p.decoded?.portnum;
    const payload = p.decoded?.payload;
    let logPayload = p.encrypted ? 'Encrypted packet (not readable with this channel)' : `Port ${portnum ?? '?'}`;
    let textMsg: string | undefined;
    let logPosition: MeshtasticPacketLog['position'];
    let logMetrics: MeshtasticPacketLog['metrics'];

    try {
      if (payload && portnum === PortNum.TEXT_MESSAGE_APP) {
        textMsg = new TextDecoder('utf-8', { fatal: false }).decode(payload);
        logPayload = `Text: "${textMsg}"`;
      } else if (payload && portnum === PortNum.POSITION_APP) {
        const pos = decodePosition(payload);
        const latLng = positionLatLng(pos);
        if (latLng) {
          const speedKt = positionSpeedKt(pos);
          const headingDeg = positionTrackDeg(pos);
          Object.assign(updates, {
            lat: latLng.lat,
            lng: latLng.lng,
            altitudeMeters: pos.altitude,
            speedKt,
            headingDeg,
            satsInView: pos.satsInView,
          });

          // GPS time of the fix if the tracker sent one, else when we received it
          const gpsSec = pos.timestamp || pos.time;
          const fixTime = gpsSec && gpsSec > 1_000_000_000 ? Math.min(gpsSec * 1000, Date.now()) : Date.now();
          const buf = this.nodePositionBuffers.get(senderId) || [];
          buf.push({ lat: latLng.lat, lng: latLng.lng, speedKt, headingDeg, altitudeMeters: pos.altitude ?? null, timestamp: fixTime });
          if (buf.length > 2000) buf.shift();
          this.nodePositionBuffers.set(senderId, buf);

          logPosition = { lat: latLng.lat, lng: latLng.lng, alt: pos.altitude, speedKt, headingDeg, sats: pos.satsInView };
          logPayload = `Position ${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)}` +
            ` SOG ${speedKt !== undefined ? `${speedKt} kt` : '—'} COG ${headingDeg !== undefined ? `${headingDeg}°` : '—'}` +
            `${gpsSec ? ` (GPS ${new Date(fixTime).toISOString().slice(11, 19)}Z)` : ''}`;
        } else {
          logPayload = 'Position without a fix';
        }
      } else if (payload && portnum === PortNum.NODEINFO_APP) {
        const user = decodeUser(payload);
        if (user.longName) updates.longName = user.longName;
        if (user.shortName) updates.shortName = user.shortName;
        const hw = hardwareModelName(user.hwModel);
        if (hw) updates.hardwareModel = hw;
        logPayload = `Node info: ${user.longName || user.shortName || senderId}`;
      } else if (payload && portnum === PortNum.TELEMETRY_APP) {
        const t = decodeTelemetry(payload);
        const dm = t.deviceMetrics;
        const env = t.environmentMetrics;
        if (dm) {
          if (dm.batteryLevel !== undefined) updates.battery = dm.batteryLevel;
          if (dm.voltage !== undefined) updates.voltage = +dm.voltage.toFixed(2);
          if (dm.channelUtilization !== undefined) updates.channelUtil = +dm.channelUtilization.toFixed(1);
          if (dm.airUtilTx !== undefined) updates.airUtilTx = +dm.airUtilTx.toFixed(1);
          logPayload = `Device telemetry: battery ${dm.batteryLevel !== undefined ? formatBattery(dm.batteryLevel) : '—'}${dm.voltage !== undefined ? ` (${dm.voltage.toFixed(2)} V)` : ''}`;
        }
        if (env) {
          if (env.temperature !== undefined) updates.temperature = +env.temperature.toFixed(1);
          if (env.relativeHumidity !== undefined) {
            updates.humidity = +env.relativeHumidity.toFixed(1);
            updates.relativeHumidity = updates.humidity;
          }
          if (env.barometricPressure !== undefined) updates.barometricPressure = +env.barometricPressure.toFixed(1);
          if (env.gasResistance !== undefined) updates.gasResistance = env.gasResistance;
          if (env.iaq !== undefined) updates.iaq = env.iaq;
          logPayload = `Environment: ${env.temperature !== undefined ? `${env.temperature.toFixed(1)} °C` : '—'}, ` +
            `${env.relativeHumidity !== undefined ? `${env.relativeHumidity.toFixed(0)}% RH` : '—'}, ` +
            `${env.barometricPressure !== undefined ? `${env.barometricPressure.toFixed(1)} hPa` : '—'}`;
        }
        logMetrics = {
          batteryLevel: dm?.batteryLevel,
          voltage: dm?.voltage,
          temperature: env?.temperature,
          relativeHumidity: env?.relativeHumidity,
          barometricPressure: env?.barometricPressure,
          gasResistance: env?.gasResistance,
          iaq: env?.iaq,
        };
      }
    } catch (err) {
      console.warn(`[BLE] Could not decode port ${portnum} payload from ${senderId}:`, err);
    }

    const senderNode = this.upsertDiscoveredNode(senderId, updates, isLocal);

    this.emitPacketLog({
      id: `pkt-${p.id ?? Date.now()}-${senderId}`,
      timestamp: new Date().toLocaleTimeString(),
      rawTimestamp: Date.now(),
      fromNode: senderNode.id,
      fromNodeName: senderNode.longName,
      toNode: p.to !== undefined && p.to !== BROADCAST_NUM ? canonicalNodeId(p.to) : '^all',
      portnum: (portnum !== undefined && PORT_LABELS[portnum]) || (portnum !== undefined ? `PORT_${portnum}` : 'ENCRYPTED'),
      snr: p.rxSnr,
      rssi: p.rxRssi,
      hops,
      payload: logPayload,
      textMessage: textMsg,
      position: logPosition,
      metrics: logMetrics,
    });
  }

  // --- LORA NODES ADDED BY ID ---
  // Registers a node the user typed in. It has no position or readings until it sends a packet.
  public registerDiscoveredLoraNode(id: string, longName: string): MeshtasticNode {
    const canonicalId = canonicalNodeId(id);
    const existing = this.discoveredBleNodes.get(canonicalId);
    if (existing) return existing;
    const loraNode: MeshtasticNode = {
      id: canonicalId,
      longName: longName || `Node ${canonicalId.slice(-4)}`,
      shortName: canonicalId.slice(-4),
      mac: '',
      gpsFix: false,
      boundBoatId: this.nodeBindings.get(canonicalId) ?? null,
      status: 'OFFLINE',
      connectionType: 'LORA_MESH',
      isBluetoothConnected: false,
      // Not heard yet
      lastPingTime: 0,
      trail: [],
    };

    this.discoveredBleNodes.set(canonicalId, loraNode);
    this.emitNode(loraNode);
    return loraNode;
  }

  // --- MQTT INBOUND & OUTBOUND ---
  public async connectMqtt(config: MqttConfig): Promise<{ success: boolean; error?: string }> {
    const rawUrl = (config.brokerUrl || '').trim();
    const isOfficialMeshtastic = rawUrl.includes('mqtt.meshtastic.org');

    if (this.mqttClient) {
      try {
        this.mqttClient.end(true);
      } catch (e) {}
      this.mqttClient = null;
    }

    if (!config.enabled) {
      this.isMqttConnected = false;
      saveMqttConfig({ ...config, enabled: false });
      this.emitMqttStatus({ connected: false, brokerUrl: config.brokerUrl });

      if (isOfficialMeshtastic) {
        try {
          await fetch('/api/mqtt/disconnect', { method: 'POST' });
        } catch (e) {}
      }
      return { success: true };
    }

    // Official Meshtastic broker (mqtt.meshtastic.org) runs on TCP / TLS ports without direct browser WSS.
    // Use our built-in backend bridge to connect seamlessly via TLS/TCP to mqtt.meshtastic.org.
    if (isOfficialMeshtastic) {
      try {
        const res = await fetch('/api/mqtt/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brokerUrl: config.brokerUrl || 'mqtt.meshtastic.org',
            topic: config.topic || 'msh/2/json/#',
            username: config.username || 'meshdev',
            password: config.password || 'large4cats',
          }),
        });
        const data = await res.json();
        if (data && data.success) {
          this.isMqttConnected = true;
          this.mqttConfig = { ...config, enabled: true };
          saveMqttConfig({ ...config, enabled: true });
          this.emitMqttStatus({ connected: true, brokerUrl: config.brokerUrl });
          return { success: true };
        } else {
          this.isMqttConnected = false;
          saveMqttConfig({ ...config, enabled: false });
          this.emitMqttStatus({ connected: false, error: data?.error });
          return {
            success: false,
            error: data?.error || 'Failed to start Meshtastic server MQTT bridge.',
          };
        }
      } catch (err: any) {
        this.isMqttConnected = false;
        saveMqttConfig({ ...config, enabled: false });
        this.emitMqttStatus({ connected: false, error: err?.message });
        return {
          success: false,
          error: `Server Bridge Error: ${err?.message || 'Unable to connect to Meshtastic broker'}`,
        };
      }
    }

    // Direct Browser WebSocket connection for brokers with WSS support (HiveMQ, EMQX, etc.)
    const wsUrl = normalizeMqttWsUrl(config.brokerUrl);
    this.mqttConfig = { ...config, brokerUrl: wsUrl, enabled: true };

    try {
      const client = mqtt.connect(wsUrl, {
        username: config.username || undefined,
        password: config.password || undefined,
        clientId: `tmtrac_${Math.random().toString(16).substring(2, 8)}`,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 5000,
      });

      return new Promise((resolve) => {
        let settled = false;

        const timeoutId = setTimeout(() => {
          if (!settled) {
            settled = true;
            this.isMqttConnected = false;
            this.emitMqttStatus({ connected: false, error: `Connection timed out connecting to ${wsUrl}` });
            try {
              client.end(true);
            } catch (e) {}
            resolve({
              success: false,
              error: `Connection timed out connecting to ${wsUrl}. Verify broker is online or use HiveMQ/EMQX WSS presets.`,
            });
          }
        }, 8500);

        client.on('connect', () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            this.mqttClient = client;
            this.isMqttConnected = true;
            saveMqttConfig({ ...config, brokerUrl: wsUrl, enabled: true });
            this.emitMqttStatus({ connected: true, brokerUrl: wsUrl });

            client.subscribe(config.topic, { qos: 0 }, (err) => {
              if (err) {
                resolve({ success: false, error: err.message });
              } else {
                resolve({ success: true });
              }
            });
          }
        });

        client.on('message', (topic, payload) => {
          this.handleMqttMessage(topic, payload);
        });

        client.on('close', () => {
          this.isMqttConnected = false;
          this.emitMqttStatus({ connected: false, brokerUrl: wsUrl });
        });

        client.on('error', (err: any) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            this.isMqttConnected = false;
            this.emitMqttStatus({ connected: false, error: err?.message });
            try {
              client.end(true);
            } catch (e) {}
            resolve({ success: false, error: err?.message || 'MQTT Connection Error' });
          }
        });
      });
    } catch (err: any) {
      this.isMqttConnected = false;
      this.emitMqttStatus({ connected: false, error: err?.message });
      return { success: false, error: err?.message || 'MQTT Connection Error' };
    }
  }

  public publishNodeToMqtt(node: MeshtasticNode) {
    if (!this.mqttClient || !this.mqttClient.connected) return;

    // Standard Meshtastic MQTT JSON topic: <root_topic>/2/json/<channel>/<node_id>
    const cleanBase = this.mqttConfig.topic.replace(/\/?[+#]$/, '').replace(/\/+$/, '');
    // If base topic doesn't end in channel name (e.g. LongFast), add LongFast/!id
    const hasChannel = cleanBase.split('/').length >= 4;
    const topic = hasChannel
      ? `${cleanBase}/${node.id.startsWith('!') ? node.id : `!${node.id}`}`
      : `${cleanBase}/LongFast/${node.id.startsWith('!') ? node.id : `!${node.id}`}`;

    if (typeof node.lat !== 'number' || typeof node.lng !== 'number') return;
    const fromUint32 = nodeNumFromId(node.id);
    const reportedAtSec = Math.floor((node.lastPingTime || Date.now()) / 1000);

    // Meshtastic JSON position; only fields the tracker actually reported are included
    const payload = JSON.stringify({
      channel: 0,
      from: fromUint32 ?? node.id,
      type: 'position',
      sender: node.longName || node.id,
      payload: {
        latitude_i: Math.round(node.lat * 1e7),
        longitude_i: Math.round(node.lng * 1e7),
        altitude: node.altitudeMeters !== undefined ? Math.round(node.altitudeMeters) : undefined,
        // Same units as the firmware: ground_speed in whole km/h, ground_track in degrees × 1e5
        ground_speed: node.speedKt !== undefined ? Math.round(node.speedKt / KMH_TO_KT) : undefined,
        ground_track: node.headingDeg !== undefined ? Math.round(node.headingDeg * 1e5) : undefined,
        battery_level: node.battery !== undefined ? Math.round(node.battery) : undefined,
        voltage: node.voltage !== undefined ? +node.voltage.toFixed(2) : undefined,
        sats_in_view: node.satsInView,
        time: reportedAtSec,
      },
      timestamp: reportedAtSec,
    });

    this.mqttClient.publish(topic, payload, { qos: 0 });
  }

  private handleMqttMessage(topic: string, payload: Buffer) {
    try {
      const text = payload.toString('utf-8');
      const json = JSON.parse(text);

      let nodeId = '';
      if (typeof json.from === 'number' || (typeof json.from === 'string' && json.from.trim())) {
        nodeId = canonicalNodeId(json.from);
      } else {
        nodeId = canonicalNodeId(topic.split('/').pop() || '');
      }
      if (!nodeId) return;

      this.emitPacketLog({
        id: 'pkt-' + Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        fromNode: nodeId,
        toNode: typeof json.to === 'number' && json.to !== 0xFFFFFFFF ? canonicalNodeId(json.to) : '^all',
        portnum: json.type === 'position' ? 'POSITION_APP' : (json.type === 'telemetry' ? 'TELEMETRY_APP' : (json.type === 'nodeinfo' ? 'NODEINFO_APP' : 'TEXT_MESSAGE_APP')),
        snr: typeof json.snr === 'number' ? json.snr : undefined,
        rssi: typeof json.rssi === 'number' ? json.rssi : undefined,
        payload: text.slice(0, 100),
      });

      if (json.type === 'position' && json.payload) {
        const p = json.payload;
        const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
        const lat = num(p.latitude_i) !== undefined ? p.latitude_i / 1e7 : (num(p.lat) ?? num(p.latitude));
        const lng = num(p.longitude_i) !== undefined ? p.longitude_i / 1e7 : (num(p.lng) ?? num(p.longitude));
        // Firmware JSON carries the raw position fields: ground_speed in whole km/h, ground_track
        // in degrees × 1e5. It leaves them out when they are 0 or the device doesn't send them.
        const speedKt = num(p.ground_speed) !== undefined ? +(p.ground_speed * KMH_TO_KT).toFixed(1) : undefined;
        const headingDeg = num(p.ground_track) !== undefined ? Math.round(p.ground_track / 1e5) % 360 : undefined;

        if (lat === undefined || lng === undefined || (lat === 0 && lng === 0)) return;

        this.upsertDiscoveredNode(nodeId, {
          longName: typeof json.sender === 'string' && json.sender ? json.sender : undefined,
          battery: num(p.battery_level),
          voltage: num(p.voltage),
          satsInView: num(p.sats_in_view),
          altitudeMeters: num(p.altitude),
          speedKt,
          headingDeg,
          lat,
          lng,
          snr: num(json.snr),
          rssi: num(json.rssi),
          hops: num(json.hops_away),
          connectionType: 'MQTT',
          lastPingTime: Date.now(),
        }, false, 'MQTT');
      }
    } catch (e) {
      console.warn('MQTT payload parse error:', e);
    }
  }

  public disconnectAll() {
    this.disconnectBle();
    if (this.mqttClient) {
      this.mqttClient.end();
      this.mqttClient = null;
    }
  }

}

export const meshtasticService = new MeshtasticBleMqttService();
