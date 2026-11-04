import mqtt, { MqttClient } from 'mqtt';
import { MeshtasticNode, BackfillPoint } from '../types/regatta';
import { canonicalNodeId, nodeNumFromId } from '../utils/nodeId';
import { nodeStatusFromLastPing } from '../utils/formatters';

// Core Meshtastic BLE Service & Characteristic UUIDs
export const MESHTASTIC_SERVICE_UUID = '6ba1b218-15a8-461f-9fa8-5dcae273eafd';
export const FROM_RADIO_UUID        = '2c55e69e-4993-11ed-b878-0242ac120002'; // Read LoRa packets from node
export const TO_RADIO_UUID          = 'f75c76d2-129e-4dad-a1dd-7866124401e7'; // Write commands / TX packets
export const FROM_NUM_UUID          = 'ed9da18c-a800-4f66-a670-aa7547e34453'; // Notify on new packet queue

// Standard Bluetooth SIG Services for direct hardware state
export const BATTERY_SERVICE_UUID   = '0000180f-0000-1000-8000-00805f9b34fb';
export const BATTERY_LEVEL_UUID     = '00002a19-0000-1000-8000-00805f9b34fb';

// Legacy & Alternative Meshtastic and Serial GATT Service UUIDs
export const MESHTASTIC_BLE_SERVICE_UUID = MESHTASTIC_SERVICE_UUID;
export const MESHTASTIC_BLE_SERVICE_UUID_ALT = '6ba1b088-ab49-438c-a079-038223b22c6f'; // Legacy Meshtastic
export const MESHTASTIC_BLE_SERVICE_UUID_ALT2 = 'cb0b0001-035f-45f4-822e-b648e23003b3';
export const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // Nordic UART Serial
export const LOCATION_NAV_SERVICE_UUID = '00001819-0000-1000-8000-00805f9b34fb'; // Standard Location & Navigation

export const MESHTASTIC_CHAR_FROMRADIO = FROM_RADIO_UUID;
export const MESHTASTIC_CHAR_TORADIO = TO_RADIO_UUID;
export const MESHTASTIC_CHAR_FROMNUM = FROM_NUM_UUID;

export const MESHTASTIC_CHAR_FROMRADIO_ALT = '2c55e69e-4993-11ea-b77f-2e728ce88125';
export const MESHTASTIC_CHAR_TORADIO_ALT = 'f75c76d2-129e-11ea-8793-2e728ce88125';
export const MESHTASTIC_CHAR_FROMRADIO_ALT2 = 'cb0b0004-035f-45f4-822e-b648e23003b3';
export const MESHTASTIC_CHAR_TORADIO_ALT2 = 'cb0b0003-035f-45f4-822e-b648e23003b3';
export const MESHTASTIC_CHAR_FROMNUM_ALT2 = 'cb0b0002-035f-45f4-822e-b648e23003b3';

export const NORDIC_UART_CHAR_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
export const NORDIC_UART_CHAR_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

/**
 * Lightweight Zero-Dependency Binary Protobuf Stream Parser for Meshtastic BLE/Serial Payloads
 */
export class ProtoReader {
  private buffer: Uint8Array;
  private offset = 0;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
  }

  public hasMore(): boolean {
    return this.offset < this.buffer.length;
  }

  public readTag(): { fieldNum: number; wireType: number } | null {
    if (!this.hasMore()) return null;
    const tag = this.readVarint();
    return { fieldNum: tag >>> 3, wireType: tag & 0x07 };
  }

  public readVarint(): number {
    let result = 0;
    let shift = 0;
    while (this.offset < this.buffer.length) {
      const b = this.buffer[this.offset++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
      if (shift >= 35) {
        // Handle 64-bit sign-extended varints safely
        while (this.offset < this.buffer.length && (this.buffer[this.offset++] & 0x80) !== 0) {}
        break;
      }
    }
    return result >>> 0;
  }

  public readInt32(): number {
    return this.readVarint() | 0; // Properly handles negative signed integers (e.g. RSSI, Noise)
  }

  public readFloat(): number {
    if (this.offset + 4 > this.buffer.length) return 0;
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.offset, 4);
    this.offset += 4;
    return view.getFloat32(0, true);
  }

  public readFixed32(): number {
    if (this.offset + 4 > this.buffer.length) return 0;
    const view = new DataView(this.buffer.buffer, this.buffer.byteOffset + this.offset, 4);
    this.offset += 4;
    return view.getInt32(0, true);
  }

  public readBytes(): Uint8Array {
    const len = this.readVarint();
    const slice = this.buffer.subarray(this.offset, Math.min(this.buffer.length, this.offset + len));
    this.offset += len;
    return slice;
  }

  public readString(): string {
    const bytes = this.readBytes();
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  public skip(wireType: number): void {
    if (wireType === 0) this.readVarint();
    else if (wireType === 1) this.offset += 8;
    else if (wireType === 2) {
      const len = this.readVarint();
      this.offset += len;
    } else if (wireType === 5) this.offset += 4;
  }
}

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

class MeshtasticBleMqttService {
  private gattDevice: any = null;
  private gattServer: any = null;
  private fromRadioChar: any = null;
  private toRadioChar: any = null;
  private fromNumChar: any = null;
  private nusTxChar: any = null;
  private pollIntervalTimer: any = null;


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
    return this.isBleConnected;
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
   * Encodes a variable-length integer (varint) according to Protobuf specification
   */
  private encodeVarintBytes(value: number): number[] {
    const bytes: number[] = [];
    let v = value >>> 0;
    while (v >= 0x80) {
      bytes.push((v & 0x7F) | 0x80);
      v >>>= 7;
    }
    bytes.push(v & 0x7F);
    return bytes;
  }

  /**
   * Encodes a 32-bit fixed integer (little-endian)
   */
  private encodeFixed32Bytes(value: number): number[] {
    const v = value >>> 0;
    return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF];
  }

  /**
   * Constructs a 100% Meshtastic Protocol-compliant ToRadio Protobuf packet for text messages
   */
  public buildMeshtasticTextToRadioPacket(
    text: string,
    destinationNodeId: string = '^all'
  ): { packetV1: Uint8Array; packetV2: Uint8Array; packetId: number; toNodeNum: number; fromNodeNum: number } {
    const encoder = new TextEncoder();
    const textBytes = Array.from(encoder.encode(text));

    // Parse destination to uint32 node number
    let toNodeNum = 0xFFFFFFFF; // Default broadcast: 4294967295 (^all / !FFFFFFFF)
    const isBroadcast =
      !destinationNodeId ||
      destinationNodeId === '^all' ||
      destinationNodeId === '*' ||
      destinationNodeId.toLowerCase() === 'broadcast' ||
      destinationNodeId.toUpperCase() === '!FFFFFFFF';

    if (!isBroadcast) {
      const cleanHex = destinationNodeId.replace(/^(node-|!|0x)/i, '').replace(/[^0-9a-fA-F]/g, '');
      if (cleanHex.length > 0) {
        const parsed = parseInt(cleanHex, 16);
        if (!isNaN(parsed) && parsed > 0) {
          toNodeNum = parsed >>> 0;
        }
      } else {
        const parsedInt = parseInt(destinationNodeId, 10);
        if (!isNaN(parsedInt) && parsedInt > 0) {
          toNodeNum = parsedInt >>> 0;
        }
      }
    }

    // Parse source node number
    let fromNodeNum = 0x00000000;
    if (this.connectedNodeId) {
      const cleanFromHex = this.connectedNodeId.replace(/^(node-|!|0x)/i, '').replace(/[^0-9a-fA-F]/g, '');
      if (cleanFromHex.length > 0) {
        const parsedFrom = parseInt(cleanFromHex, 16);
        if (!isNaN(parsedFrom) && parsedFrom > 0) {
          fromNodeNum = parsedFrom >>> 0;
        }
      }
    }

    const randomPktId = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    const isDirectUnicast = !isBroadcast;
    const nowSec = Math.floor(Date.now() / 1000) >>> 0;

    // 1. Construct Data sub-message (Port 1 = TEXT_MESSAGE_APP)
    // Field 1: portnum (varint)        -> (1 << 3) | 0 = 0x08, value = 1 (TEXT_MESSAGE_APP)
    // Field 2: payload (bytes)         -> (2 << 3) | 2 = 0x12, len, ...textBytes
    // Field 3: want_response (varint)  -> (3 << 3) | 0 = 0x18, value = 1 (if direct unicast)
    // Field 4: dest (fixed32)          -> (4 << 3) | 5 = 0x25, toNodeNum
    // Field 5: source (fixed32)        -> (5 << 3) | 5 = 0x2D, fromNodeNum
    const dataFields: number[] = [
      0x08, 0x01, // portnum: TEXT_MESSAGE_APP (1)
      0x12, ...this.encodeVarintBytes(textBytes.length), ...textBytes, // payload string bytes
    ];
    if (isDirectUnicast) {
      dataFields.push(0x18, 0x01); // want_response: true
      dataFields.push(0x25, ...this.encodeFixed32Bytes(toNodeNum)); // dest
      if (fromNodeNum > 0) {
        dataFields.push(0x2D, ...this.encodeFixed32Bytes(fromNodeNum)); // source
      }
    }

    // 2. Construct MeshPacket message
    // Field 1: from (fixed32)          -> (1 << 3) | 5 = 0x0D, fromNodeNum
    // Field 2: to (fixed32)            -> (2 << 3) | 5 = 0x15, toNodeNum
    // Field 3: channel (varint)        -> (3 << 3) | 0 = 0x18, 0 (Primary)
    // Field 4: decoded (Data message)  -> (4 << 3) | 2 = 0x22, len, ...dataFields
    // Field 5: want_ack (varint)       -> (5 << 3) | 0 = 0x28, 1 (if direct)
    // Field 6: id (fixed32)            -> (6 << 3) | 5 = 0x35, fixed32 randomPktId
    // Field 7: rx_time (fixed32)       -> (7 << 3) | 5 = 0x3D, nowSec
    // Field 10: hop_limit (varint)     -> (10 << 3) | 0 = 0x50, 3 hops
    // Field 8: hop_limit (legacy varint) -> (8 << 3) | 0 = 0x40, 3 hops
    const meshPacketFields: number[] = [];
    if (fromNodeNum > 0) {
      meshPacketFields.push(0x0D, ...this.encodeFixed32Bytes(fromNodeNum));
    }
    meshPacketFields.push(
      0x15, ...this.encodeFixed32Bytes(toNodeNum), // to = uint32 fixed32
      0x18, 0x00, // channel = 0
      0x22, ...this.encodeVarintBytes(dataFields.length), ...dataFields, // decoded Data payload
    );

    if (isDirectUnicast) {
      meshPacketFields.push(0x28, 0x01); // want_ack = true
    }

    meshPacketFields.push(
      0x35, ...this.encodeFixed32Bytes(randomPktId), // id = random uint32
      0x3D, ...this.encodeFixed32Bytes(nowSec), // rx_time
      0x50, 0x03, // hop_limit = 3 hops (Meshtastic v2.x field 10)
      0x40, 0x03  // hop_limit = 3 hops (legacy field 8)
    );

    // 3. Wrap into ToRadio message envelopes (Field 1 = 0x0A standard, Field 2 = 0x12 legacy fallback)
    const toRadioV1 = new Uint8Array([
      0x0A, ...this.encodeVarintBytes(meshPacketFields.length), ...meshPacketFields,
    ]);

    const toRadioV2 = new Uint8Array([
      0x12, ...this.encodeVarintBytes(meshPacketFields.length), ...meshPacketFields,
    ]);

    return {
      packetV1: toRadioV1,
      packetV2: toRadioV2,
      packetId: randomPktId,
      toNodeNum,
      fromNodeNum,
    };
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

    const hasBle = Boolean(this.toRadioChar && this.isBleConnected);
    const hasMqtt = Boolean(this.mqttClient && this.mqttClient.connected);
    if (!hasBle && !hasMqtt) {
      return {
        success: false,
        error: 'No tracker is connected. Connect one over Bluetooth (or connect to an MQTT broker) to send messages.',
      };
    }

    const myNodeId = this.connectedNodeId || 'this device';
    const myName = this.connectedDeviceName || undefined;

    const { packetV1, packetV2, packetId, toNodeNum, fromNodeNum } = this.buildMeshtasticTextToRadioPacket(
      cleanText,
      destinationNodeId
    );

    const isBroadcast =
      destinationNodeId === '^all' ||
      destinationNodeId === '*' ||
      destinationNodeId.toLowerCase() === 'broadcast' ||
      destinationNodeId.toUpperCase() === '!FFFFFFFF';
    const targetDisplay = isBroadcast ? 'Broadcast (^all)' : `Direct (${destinationNodeId})`;

    let via: 'BLE' | 'MQTT' | undefined;
    const errors: string[] = [];

    // 1. Hand the packet to the tracker over Bluetooth
    if (hasBle) {
      const write = async (packet: Uint8Array) => {
        if (typeof this.toRadioChar.writeValueWithoutResponse === 'function') {
          await this.toRadioChar.writeValueWithoutResponse(packet);
        } else {
          await this.toRadioChar.writeValue(packet);
        }
      };
      try {
        await write(packetV1);
        via = 'BLE';
      } catch (err: any) {
        try {
          await write(packetV2);
          via = 'BLE';
        } catch (e2: any) {
          errors.push(`Bluetooth write failed: ${e2?.message || err?.message || 'unknown error'}`);
        }
      }
    }

    // 2. Otherwise publish to the MQTT broker
    if (!via && hasMqtt) {
      try {
        const cleanBase = this.mqttConfig.topic.replace(/\/?[+#]$/, '').replace(/\/+$/, '');
        const hasChannel = cleanBase.split('/').length >= 4;
        const dest = canonicalNodeId(destinationNodeId) || '^all';
        const topic = hasChannel ? `${cleanBase}/${dest}` : `${cleanBase}/LongFast/${dest}`;

        const mqttPayload = JSON.stringify({
          channel: 0,
          from: fromNodeNum || undefined,
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
      id: `pkt-tx-${packetId || Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      rawTimestamp: Date.now(),
      fromNode: myNodeId,
      fromNodeName: myName,
      toNode: destinationNodeId,
      portnum: 'TEXT_MESSAGE_APP',
      hops: 0,
      payload: `TX via ${via === 'BLE' ? 'tracker (Bluetooth)' : 'MQTT broker'} [${targetDisplay}]: "${cleanText}"`,
      textMessage: cleanText,
    });
    return { success: true, packetId, via };
  }

  public getConnectedNodeState(): MeshtasticNode | null {
    return this.tEchoNodeState;
  }

  // --- WEB BLUETOOTH T-ECHO CONNECT ---
  /**
   * Connects to a Meshtastic tracker over Web Bluetooth. The tracker's node only appears once
   * the tracker has reported its own node number (MyNodeInfo); nothing is emitted before then,
   * and its position only ever comes from packets the tracker sends.
   */
  public async connectTEchoBle(): Promise<{ success: boolean; deviceName: string; nodeId: string; node?: MeshtasticNode; error?: string }> {
    if (!('bluetooth' in navigator)) {
      return { success: false, deviceName: '', nodeId: '', error: 'Web Bluetooth API is not supported in this browser. Please use Google Chrome, Edge, or Brave.' };
    }

    try {
      // Include all standard Meshtastic & BLE service UUID variants
      const optionalServicesList = [
        'battery_service',
        'device_information',
        MESHTASTIC_BLE_SERVICE_UUID,
        MESHTASTIC_BLE_SERVICE_UUID_ALT,
        NORDIC_UART_SERVICE_UUID,
        LOCATION_NAV_SERVICE_UUID,
        '6ba10000-0000-1000-8000-00805f9b34fb',
        '6ba1b080-b13f-4152-80b1-205e21271180',
        '0000180f-0000-1000-8000-00805f9b34fb',
        '0000180a-0000-1000-8000-00805f9b34fb',
      ];

      let device: any = null;
      try {
        device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: optionalServicesList,
        });
      } catch (reqErr: any) {
        if (reqErr.name === 'NotFoundError' || reqErr.message?.includes('cancelled')) {
          return { success: false, deviceName: '', nodeId: '', error: 'Bluetooth connection request cancelled by user.' };
        }
        throw reqErr;
      }

      if (!device) {
        return { success: false, deviceName: '', nodeId: '', error: 'No Bluetooth device selected.' };
      }

      this.gattDevice = device;
      this.connectedDeviceName = device.name || '';
      this.connectedNodeId = '';
      this.tEchoNodeState = null;
      this.pendingBatteryLevel = undefined;

      device.addEventListener('gattserverdisconnected', () => {
        this.isBleConnected = false;
        if (this.pollIntervalTimer) {
          clearInterval(this.pollIntervalTimer);
          this.pollIntervalTimer = null;
        }
        // Keep the node and its last-heard time; it goes stale, then offline, on its own
        if (this.tEchoNodeState) {
          this.tEchoNodeState = { ...this.tEchoNodeState, isBluetoothConnected: false };
          this.discoveredBleNodes.set(this.tEchoNodeState.id, this.tEchoNodeState);
          this.emitNode(this.tEchoNodeState);
        }
        console.warn('T-Echo BLE Device Disconnected');
      });

      console.log(`Connecting to GATT Server on ${this.connectedDeviceName}...`);

      // Robust GATT Connection with retry fallback
      let server: any = null;
      try {
        server = await device.gatt.connect();
      } catch (firstConnectErr: any) {
        console.warn('First GATT connect attempt failed, retrying in 600ms...', firstConnectErr);
        await new Promise((resolve) => setTimeout(resolve, 600));
        try {
          server = await device.gatt.connect();
        } catch (secondConnectErr: any) {
          if (device.gatt && device.gatt.connected) {
            device.gatt.disconnect();
          }
          const isIframe = window.self !== window.top;
          let detailedErr = `BLE Connection Error: Connection attempt failed. (${secondConnectErr.message || secondConnectErr}).`;
          if (isIframe) {
            detailedErr += ' Web Bluetooth may be blocked inside this embedded preview. Open the app in its own tab and try again.';
          } else {
            detailedErr += ' Ensure your T-Echo node is powered ON, Bluetooth is enabled, and it is NOT currently connected to the Meshtastic Mobile App or another device.';
          }
          return {
            success: false,
            deviceName: this.connectedDeviceName,
            nodeId: '',
            error: detailedErr,
          };
        }
      }

      this.gattServer = server;
      this.isBleConnected = true;

      // Battery level from the standard BLE battery service, if the tracker exposes it. It's
      // applied to the tracker's node once the tracker has told us its node number.
      try {
        const batService = await server.getPrimaryService('battery_service');
        const batChar = await batService.getCharacteristic('00002a19-0000-1000-8000-00805f9b34fb');
        const val = await batChar.readValue();
        this.pendingBatteryLevel = val.getUint8(0);
      } catch (batErr) {
        console.log('Battery service not exposed or skipped:', batErr);
      }

      // Subscribe to the Meshtastic characteristics and request the config / NodeDB dump
      await this.setupBleCharacteristics(server);

      // Start periodic packet reader / heartbeat query
      this.startBleHeartbeatPolling();

      // Wait for MyNodeInfo so the tracker is listed under its real node id
      const myId = await this.waitForMyNodeId(10_000);
      if (!myId) {
        return {
          success: true,
          deviceName: this.connectedDeviceName,
          nodeId: '',
          error: 'Connected, but the tracker has not reported its node id yet. It will appear in the list once it does.',
        };
      }

      return {
        success: true,
        deviceName: this.connectedDeviceName,
        nodeId: myId,
        node: this.tEchoNodeState ?? undefined,
      };
    } catch (err: any) {
      console.error('BLE Connect error:', err);
      return { success: false, deviceName: '', nodeId: '', error: err.message || 'Bluetooth connection failed.' };
    }
  }

  private waitForMyNodeId(timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
      const started = Date.now();
      const check = () => {
        if (this.connectedNodeId) return resolve(this.connectedNodeId);
        if (!this.isBleConnected || Date.now() - started >= timeoutMs) return resolve(null);
        setTimeout(check, 200);
      };
      check();
    });
  }

  // Find and setup GATT characteristics across Meshtastic and Nordic UART profiles
  public async setupBleCharacteristics(server: any) {
    await this.listenToRadioPackets(server);
  }

  /**
   * 1. Subscribe to FromNum notifications and discover characteristics
   */
  public async listenToRadioPackets(server: any) {
    let service: any = null;

    // Try Official Meshtastic Service first, fallback to legacy
    try {
      service = await server.getPrimaryService(MESHTASTIC_SERVICE_UUID);
      console.log('[BLE] Found Official Meshtastic BLE Service');
    } catch (e) {
      try {
        service = await server.getPrimaryService(MESHTASTIC_BLE_SERVICE_UUID_ALT);
        console.log('[BLE] Found Legacy Meshtastic BLE Service');
      } catch (e2) {
        try {
          service = await server.getPrimaryService(MESHTASTIC_BLE_SERVICE_UUID_ALT2);
          console.log('[BLE] Found Alternative Meshtastic BLE Service');
        } catch (e3) {
          console.warn('[BLE] Meshtastic Primary Service not found, checking NUS...');
        }
      }
    }

    if (service) {
      try {
        this.fromNumChar = await service.getCharacteristic(FROM_NUM_UUID);
        await this.fromNumChar.startNotifications();
        this.fromNumChar.addEventListener('characteristicvaluechanged', async () => {
          await this.readAllPendingFromRadio(this.fromRadioChar);
        });
        console.log('[BLE] Subscribed to fromNum notifications');
      } catch (err) {
        try {
          this.fromNumChar = await service.getCharacteristic(MESHTASTIC_CHAR_FROMNUM_ALT2);
          await this.fromNumChar.startNotifications();
          this.fromNumChar.addEventListener('characteristicvaluechanged', async () => {
            await this.readAllPendingFromRadio(this.fromRadioChar);
          });
        } catch (e) {
          console.warn('[BLE] fromNum characteristic not found or failed to subscribe:', err);
        }
      }

      try {
        this.fromRadioChar = await service.getCharacteristic(FROM_RADIO_UUID);
        try {
          await this.fromRadioChar.startNotifications();
          this.fromRadioChar.addEventListener('characteristicvaluechanged', (evt: any) => {
            const dataView = evt.target.value;
            if (dataView && dataView.byteLength > 0) {
              const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
              this.decodeFromRadioPacket(bytes);
            }
          });
          console.log('[BLE] Subscribed to fromRadio direct notifications');
        } catch (_) {}
      } catch (err) {
        try {
          this.fromRadioChar = await service.getCharacteristic(MESHTASTIC_CHAR_FROMRADIO_ALT);
        } catch (e) {
          try {
            this.fromRadioChar = await service.getCharacteristic(MESHTASTIC_CHAR_FROMRADIO_ALT2);
          } catch (e2) {
            console.warn('[BLE] fromRadio characteristic not found:', err);
          }
        }
      }

      try {
        this.toRadioChar = await service.getCharacteristic(TO_RADIO_UUID);
        console.log('[BLE] Found toRadio characteristic');
        await this.sendToRadioHandshake();
      } catch (err) {
        try {
          this.toRadioChar = await service.getCharacteristic(MESHTASTIC_CHAR_TORADIO_ALT);
          await this.sendToRadioHandshake();
        } catch (e) {
          try {
            this.toRadioChar = await service.getCharacteristic(MESHTASTIC_CHAR_TORADIO_ALT2);
            await this.sendToRadioHandshake();
          } catch (e2) {
            console.warn('[BLE] toRadio characteristic not found:', err);
          }
        }
      }

      // Initial read to clear queue & fetch first packets
      await this.readAllPendingFromRadio(this.fromRadioChar);
    }

    // Also check Nordic UART Service for NMEA / Serial Stream
    try {
      const nusService = await server.getPrimaryService(NORDIC_UART_SERVICE_UUID);
      if (nusService) {
        try {
          this.nusTxChar = await nusService.getCharacteristic(NORDIC_UART_CHAR_TX);
          await this.nusTxChar.startNotifications();
          this.nusTxChar.addEventListener('characteristicvaluechanged', (evt: any) => {
            this.handleBleNotification(evt.target.value);
          });
          console.log('[BLE] Subscribed to Nordic UART TX stream');
        } catch (e) {}
      }
    } catch (e) {}
  }

  /**
   * 2. Drain all pending packets from FromRadio until empty
   */
  public async readAllPendingFromRadio(fromRadioChar?: any): Promise<void> {
    const targetChar = fromRadioChar || this.fromRadioChar;
    if (!targetChar) return;

    let emptyStreak = 0;
    while (emptyStreak < 2) {
      try {
        const dataView = await targetChar.readValue();
        if (!dataView || dataView.byteLength === 0) {
          emptyStreak++;
          break;
        }
        emptyStreak = 0;
        const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
        this.decodeFromRadioPacket(bytes);
      } catch (err) {
        break;
      }
    }
  }

  // Send Meshtastic Handshake Packet to ToRadio to request NodeDB (including remote LoRa mesh nodes)
  public async sendToRadioHandshake() {
    if (!this.toRadioChar) return;
    try {
      // Meshtastic ToRadio want_config_id is field 3: (3 << 3) | 0 = 0x18
      const randId = Math.floor(Math.random() * 1000000) + 1;
      const handshake = this.encodeVarintField(3, randId);
      if (typeof this.toRadioChar.writeValueWithoutResponse === 'function') {
        await this.toRadioChar.writeValueWithoutResponse(handshake);
      } else {
        await this.toRadioChar.writeValue(handshake);
      }
      console.log(`[BLE] Sent ToRadio want_config_id (${randId}) to trigger full NodeDB dump`);
    } catch (e) {
      try {
        const randId = Math.floor(Math.random() * 1000000) + 1;
        const fallback = this.encodeVarintField(100, randId);
        await this.toRadioChar.writeValue(fallback);
      } catch (e2) {
        console.warn('[BLE] Could not write handshake to ToRadio:', e);
      }
    }
  }

  private encodeVarintField(fieldNum: number, value: number): Uint8Array {
    const tag = (fieldNum << 3) | 0;
    const bytes = [tag];
    let v = value >>> 0;
    while (v >= 0x80) {
      bytes.push((v & 0x7F) | 0x80);
      v >>>= 7;
    }
    bytes.push(v & 0x7F);
    return new Uint8Array(bytes);
  }

  // Start periodic polling fallback
  private startBleHeartbeatPolling() {
    if (this.pollIntervalTimer) clearInterval(this.pollIntervalTimer);
    this.pollIntervalTimer = setInterval(async () => {
      if (!this.isBleConnected || !this.gattServer || !this.gattServer.connected) {
        return;
      }
      try {
        await this.readAllPendingFromRadio();
      } catch (_) {}
    }, 2500);
  }


  // Parse incoming BLE GATT characteristic notifications (binary Protobuf and text/NMEA)
  private handleBleNotification(dataView: DataView) {
    try {
      const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
      if (bytes.length === 0) return;

      // Check if text/NMEA string was sent over serial BLE ($GNRMC, $GNGGA, JSON)
      try {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        if (text.includes('$GP') || text.includes('$GN') || text.includes('{')) {
          this.parseRawTextTelemetry(text);
          return;
        }
      } catch (_) {}

      // Binary Protobuf Parser for Meshtastic FromRadio
      this.decodeFromRadioPacket(bytes);
    } catch (e) {
      console.error('Notification parse error:', e);
    }
  }

  // Helper: Read a single protobuf varint
  private readVarint(bytes: Uint8Array, offset: number): { value: number; nextOffset: number } {
    let val = 0;
    let shift = 0;
    let curr = offset;
    while (curr < bytes.length) {
      const b = bytes[curr++];
      val |= (b & 0x7F) << shift;
      shift += 7;
      if ((b & 0x80) === 0) break;
    }
    return { value: val >>> 0, nextOffset: curr };
  }

  // Helper: Read length-delimited bytes sub-slice
  private readBytes(bytes: Uint8Array, offset: number): { data: Uint8Array; nextOffset: number } {
    const { value: len, nextOffset } = this.readVarint(bytes, offset);
    const end = Math.min(bytes.length, nextOffset + len);
    const data = bytes.subarray(nextOffset, end);
    return { data, nextOffset: end };
  }

  // Helper: Read string
  private readString(bytes: Uint8Array, offset: number): { str: string; nextOffset: number } {
    const { data, nextOffset } = this.readBytes(bytes, offset);
    const str = new TextDecoder('utf-8', { fatal: false }).decode(data);
    return { str, nextOffset };
  }

  // Parse Position message protobuf payload
  private parseProtobufPosition(bytes: Uint8Array): {
    lat: number | null;
    lng: number | null;
    alt: number | null;
    speedKt: number | null;
    headingDeg: number | null;
    sats: number | null;
    precisionBits: number | null;
    time: number | null;
  } {
    let offset = 0;
    let lat: number | null = null;
    let lng: number | null = null;
    let alt: number | null = null;
    let speedKt: number | null = null;
    let headingDeg: number | null = null;
    let sats: number | null = null;
    let precisionBits: number | null = null;
    let time: number | null = null;

    while (offset < bytes.length) {
      const tagByte = bytes[offset++];
      const wireType = tagByte & 0x07;
      const fieldNum = tagByte >> 3;

      if (wireType === 0) { // Varint
        const { value, nextOffset } = this.readVarint(bytes, offset);
        offset = nextOffset;
        if (fieldNum === 3) alt = value;
        if (fieldNum === 8) speedKt = +(value * 1.94384).toFixed(1); // m/s -> knots
        if (fieldNum === 9) headingDeg = value;
        if (fieldNum === 10) sats = value;
        if (fieldNum === 11) precisionBits = value;
      } else if (wireType === 5) { // 32-bit fixed
        if (offset + 4 <= bytes.length) {
          const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
          const intVal = dv.getInt32(0, true);
          offset += 4;
          if (fieldNum === 1) lat = intVal / 1e7;
          else if (fieldNum === 2) lng = intVal / 1e7;
          else if (fieldNum === 4) time = intVal;
          else if (fieldNum === 8) {
            const floatVal = dv.getFloat32(0, true);
            if (!isNaN(floatVal) && floatVal >= 0) speedKt = +(floatVal * 1.94384).toFixed(1);
          }
          else if (fieldNum === 9) {
            const floatVal = dv.getFloat32(0, true);
            if (!isNaN(floatVal) && floatVal >= 0) headingDeg = Math.round(floatVal);
          }
        } else {
          break;
        }
      } else if (wireType === 2) { // Length-delimited
        const { nextOffset } = this.readBytes(bytes, offset);
        offset = nextOffset;
      } else if (wireType === 1) { // 64-bit
        offset += 8;
      } else {
        break;
      }
    }

    return { lat, lng, alt, speedKt, headingDeg, sats, precisionBits, time };
  }

  // Parse User message protobuf payload
  private parseProtobufUser(bytes: Uint8Array): {
    id?: string;
    longName?: string;
    shortName?: string;
    hwModel?: string;
  } {
    let offset = 0;
    let id: string | undefined;
    let longName: string | undefined;
    let shortName: string | undefined;

    while (offset < bytes.length) {
      const tagByte = bytes[offset++];
      const wireType = tagByte & 0x07;
      const fieldNum = tagByte >> 3;

      if (wireType === 2) {
        const { str, nextOffset } = this.readString(bytes, offset);
        offset = nextOffset;
        if (fieldNum === 1) id = str;
        if (fieldNum === 2) longName = str;
        if (fieldNum === 3) shortName = str;
      } else if (wireType === 0) {
        const { nextOffset } = this.readVarint(bytes, offset);
        offset = nextOffset;
      } else if (wireType === 5) {
        offset += 4;
      } else if (wireType === 1) {
        offset += 8;
      } else {
        break;
      }
    }

    return { id, longName, shortName };
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

    this.emitNode(node);

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

  /**
   * 3. Decode incoming FromRadio Protobuf packet using ProtoReader
   */
  public decodeFromRadioPacket(bytes: Uint8Array) {
    try {
      const reader = new ProtoReader(bytes);
      while (reader.hasMore()) {
        const tag = reader.readTag();
        if (!tag) break;

        switch (tag.fieldNum) {
          // Tag 2 & 11: MeshPacket (LoRa radio packet)
          case 2:
          case 11: {
            if (tag.wireType === 2) {
              const packetBytes = reader.readBytes();
              this.decodeMeshPacket(packetBytes);
            } else {
              reader.skip(tag.wireType);
            }
            break;
          }

          // Tag 3: MyNodeInfo (Node's own identity)
          case 3: {
            if (tag.wireType === 2) {
              const infoBytes = reader.readBytes();
              this.decodeMyInfo(infoBytes);
            } else {
              reader.skip(tag.wireType);
            }
            break;
          }

          // Tag 4: NodeInfo (Other nodes discovered in mesh / NodeDB)
          case 4: {
            if (tag.wireType === 2) {
              const nodeBytes = reader.readBytes();
              this.decodeNodeInfo(nodeBytes);
            } else {
              reader.skip(tag.wireType);
            }
            break;
          }

          // Tag 7: config_complete_id
          case 7: {
            if (tag.wireType === 0) {
              const configId = reader.readVarint();
              console.log(`[BLE] Mesh NodeDB & Config sync complete (ID: ${configId})`);
            } else {
              reader.skip(tag.wireType);
            }
            break;
          }

          default:
            reader.skip(tag.wireType);
            break;
        }
      }
    } catch (err) {
      console.warn('[BLE] decodeFromRadioPacket parse notice:', err);
    }
  }

  /**
   * Decode MyNodeInfo (Tag 3 in FromRadio)
   */
  public decodeMyInfo(infoBytes: Uint8Array) {
    const reader = new ProtoReader(infoBytes);
    let myNodeNum: number | null = null;
    let hasGps = false;
    let firmwareVersion: string | undefined;

    while (reader.hasMore()) {
      const tag = reader.readTag();
      if (!tag) break;

      if (tag.fieldNum === 1 && (tag.wireType === 0 || tag.wireType === 5)) { // my_node_num
        myNodeNum = tag.wireType === 0 ? reader.readVarint() : reader.readFixed32() >>> 0;
      } else if (tag.fieldNum === 2 && tag.wireType === 0) { // has_gps
        hasGps = reader.readVarint() !== 0;
      } else if (tag.fieldNum === 4 && tag.wireType === 2) { // firmware_version
        firmwareVersion = reader.readString();
      } else {
        reader.skip(tag.wireType);
      }
    }

    if (myNodeNum !== null) {
      const myHexId = canonicalNodeId(myNodeNum);
      this.connectedNodeId = myHexId;
      const node = this.upsertDiscoveredNode(myHexId, {
        longName: this.connectedDeviceName || undefined,
        connectionType: 'BLE',
        firmwareVersion,
        battery: this.pendingBatteryLevel,
        // The tracker is talking to us over Bluetooth right now
        lastPingTime: Date.now(),
      }, true);
      this.pendingBatteryLevel = undefined;
      this.tEchoNodeState = node;
      console.log(`[BLE] MyNodeInfo decoded: ${myHexId}${firmwareVersion ? ` (${firmwareVersion})` : ''}${hasGps ? ', has GPS' : ''}`);
    }
  }

  /**
   * Decode NodeInfo (Tag 4 in FromRadio - Node Database entry from LoRa mesh)
   */
  public decodeNodeInfo(nodeBytes: Uint8Array) {
    const reader = new ProtoReader(nodeBytes);
    let nodeNum: number | null = null;
    let user: { id?: string; longName?: string; shortName?: string; hwModel?: string } = {};
    let pos: { lat: number | null; lng: number | null; alt: number | null; speedKt: number | null; headingDeg: number | null; sats: number | null } = { lat: null, lng: null, alt: null, speedKt: null, headingDeg: null, sats: null };
    let snr: number | undefined;
    let lastHeardSec: number | undefined;
    let metrics: { batteryLevel?: number; voltage?: number; channelUtil?: number; airUtilTx?: number } = {};
    let hopsAway: number | undefined;

    while (reader.hasMore()) {
      const tag = reader.readTag();
      if (!tag) break;

      if (tag.fieldNum === 1 && (tag.wireType === 0 || tag.wireType === 5)) { // num
        nodeNum = tag.wireType === 0 ? reader.readVarint() : reader.readFixed32() >>> 0;
      } else if (tag.fieldNum === 2 && tag.wireType === 2) { // user
        const uReader = new ProtoReader(reader.readBytes());
        while (uReader.hasMore()) {
          const uTag = uReader.readTag();
          if (!uTag) break;
          if (uTag.fieldNum === 1 && uTag.wireType === 2) user.id = uReader.readString();
          else if (uTag.fieldNum === 2 && uTag.wireType === 2) user.longName = uReader.readString();
          else if (uTag.fieldNum === 3 && uTag.wireType === 2) user.shortName = uReader.readString();
          else if (uTag.fieldNum === 5 && uTag.wireType === 0) user.hwModel = `HW_${uReader.readVarint()}`;
          else uReader.skip(uTag.wireType);
        }
      } else if (tag.fieldNum === 3 && tag.wireType === 2) { // position
        const pReader = new ProtoReader(reader.readBytes());
        while (pReader.hasMore()) {
          const pTag = pReader.readTag();
          if (!pTag) break;
          if (pTag.fieldNum === 1 && (pTag.wireType === 5 || pTag.wireType === 0)) {
            const rawLat = pTag.wireType === 5 ? pReader.readFixed32() : pReader.readInt32();
            pos.lat = rawLat / 1e7;
          } else if (pTag.fieldNum === 2 && (pTag.wireType === 5 || pTag.wireType === 0)) {
            const rawLng = pTag.wireType === 5 ? pReader.readFixed32() : pReader.readInt32();
            pos.lng = rawLng / 1e7;
          } else if (pTag.fieldNum === 3 && (pTag.wireType === 0 || pTag.wireType === 5)) {
            pos.alt = pTag.wireType === 0 ? pReader.readInt32() : pReader.readFixed32();
          } else if (pTag.fieldNum === 8 && (pTag.wireType === 0 || pTag.wireType === 5)) {
            const spd = pTag.wireType === 0 ? pReader.readVarint() : pReader.readFloat();
            pos.speedKt = +(spd * 1.94384).toFixed(1);
          } else if (pTag.fieldNum === 9 && (pTag.wireType === 0 || pTag.wireType === 5)) {
            const hdg = pTag.wireType === 0 ? pReader.readVarint() : pReader.readFloat();
            pos.headingDeg = Math.round(hdg);
          } else if (pTag.fieldNum === 10 && pTag.wireType === 0) {
            pos.sats = pReader.readVarint();
          } else {
            pReader.skip(pTag.wireType);
          }
        }
      } else if (tag.fieldNum === 4 && tag.wireType === 5) { // snr
        snr = +reader.readFloat().toFixed(1);
      } else if (tag.fieldNum === 5 && tag.wireType === 5) { // last_heard (seconds since epoch)
        lastHeardSec = reader.readFixed32() >>> 0;
      } else if (tag.fieldNum === 6 && tag.wireType === 2) { // device_metrics
        const mReader = new ProtoReader(reader.readBytes());
        while (mReader.hasMore()) {
          const mTag = mReader.readTag();
          if (!mTag) break;
          if (mTag.fieldNum === 1 && mTag.wireType === 0) metrics.batteryLevel = Math.max(0, mReader.readVarint()); // 101 = external power
          else if (mTag.fieldNum === 2 && mTag.wireType === 5) metrics.voltage = +mReader.readFloat().toFixed(2);
          else if (mTag.fieldNum === 3 && mTag.wireType === 5) metrics.channelUtil = +mReader.readFloat().toFixed(1);
          else if (mTag.fieldNum === 4 && mTag.wireType === 5) metrics.airUtilTx = +mReader.readFloat().toFixed(1);
          else mReader.skip(mTag.wireType);
        }
      } else if (tag.fieldNum === 7 && tag.wireType === 0) { // hops_away
        hopsAway = reader.readVarint();
      } else {
        reader.skip(tag.wireType);
      }
    }

    if (nodeNum !== null || user.id) {
      const canonicalId = canonicalNodeId(user.id || nodeNum!);
      // Only the tracker's own entry is local, and we only know which that is once MyNodeInfo arrived
      const isLocal = Boolean(this.connectedNodeId) && canonicalId === this.connectedNodeId;

      // The radio's NodeDB says when it last heard each node; a node it never heard has no time.
      // Our own tracker is connected right now.
      const lastPingTime = isLocal
        ? Date.now()
        : (lastHeardSec && lastHeardSec > 0 ? Math.min(lastHeardSec * 1000, Date.now()) : undefined);

      const discovered = this.upsertDiscoveredNode(canonicalId, {
        longName: user.longName || (isLocal ? this.connectedDeviceName || undefined : undefined),
        shortName: user.shortName,
        hardwareModel: user.hwModel,
        lat: (pos.lat !== null && !isNaN(pos.lat) && pos.lat !== 0) ? pos.lat : undefined,
        lng: (pos.lng !== null && !isNaN(pos.lng) && pos.lng !== 0) ? pos.lng : undefined,
        altitudeMeters: pos.alt ?? undefined,
        speedKt: pos.speedKt ?? undefined,
        headingDeg: pos.headingDeg ?? undefined,
        satsInFix: pos.sats ?? undefined,
        battery: metrics.batteryLevel ?? undefined,
        voltage: metrics.voltage ?? undefined,
        channelUtil: metrics.channelUtil ?? undefined,
        airUtilTx: metrics.airUtilTx ?? undefined,
        snr,
        hops: isLocal ? 0 : hopsAway,
        connectionType: isLocal ? 'BLE' : 'LORA_MESH',
        lastPingTime,
      }, isLocal);

      this.emitPacketLog({
        id: 'pkt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        timestamp: new Date().toLocaleTimeString(),
        rawTimestamp: Date.now(),
        fromNode: discovered.id,
        fromNodeName: discovered.longName,
        toNode: '^all',
        portnum: 'NODEINFO_APP',
        snr,
        hops: isLocal ? 0 : hopsAway,
        payload: `NodeDB Entry: ${discovered.longName} (${discovered.id}) ${discovered.lat ? `Pos:${discovered.lat.toFixed(4)},${discovered.lng?.toFixed(4)}` : 'No GPS Fix'}${hopsAway !== undefined ? ` Hops:${hopsAway}` : ''}`,
      });

      console.log(`[BLE] Discovered LoRa Node from NodeDB: ${discovered.id} (${discovered.longName})`);
    }
  }

  /**
   * Decode MeshPacket (Tag 2 & 11 in FromRadio)
   */
  public decodeMeshPacket(packetBytes: Uint8Array) {
    const reader = new ProtoReader(packetBytes);
    let fromNum: number | null = null;
    let toNum: number | null = null;
    let portnum = 0;
    let payloadBytes: Uint8Array | null = null;
    let rxSnr: number | undefined;
    let rxRssi: number | undefined;

    while (reader.hasMore()) {
      const tag = reader.readTag();
      if (!tag) break;

      if (tag.fieldNum === 1 && (tag.wireType === 0 || tag.wireType === 5)) { // from
        fromNum = tag.wireType === 0 ? reader.readVarint() : reader.readFixed32() >>> 0;
      } else if (tag.fieldNum === 2 && (tag.wireType === 0 || tag.wireType === 5)) { // to
        toNum = tag.wireType === 0 ? reader.readVarint() : reader.readFixed32() >>> 0;
      } else if (tag.fieldNum === 4 && tag.wireType === 2) { // decoded (Data)
        const dReader = new ProtoReader(reader.readBytes());
        while (dReader.hasMore()) {
          const dTag = dReader.readTag();
          if (!dTag) break;
          if (dTag.fieldNum === 1 && dTag.wireType === 0) portnum = dReader.readVarint();
          else if (dTag.fieldNum === 2 && dTag.wireType === 2) payloadBytes = dReader.readBytes();
          else dReader.skip(dTag.wireType);
        }
      } else if (tag.fieldNum === 7 && tag.wireType === 5) { // rx_snr
        rxSnr = +reader.readFloat().toFixed(1);
      } else if (tag.fieldNum === 11 && (tag.wireType === 0 || tag.wireType === 5)) { // rx_rssi
        rxRssi = reader.readInt32();
        if (rxRssi > 0) rxRssi = -rxRssi;
      } else {
        reader.skip(tag.wireType);
      }
    }

    if (fromNum !== null) {
      const senderId = canonicalNodeId(fromNum);
      const isLocal = Boolean(this.connectedNodeId) && senderId === this.connectedNodeId;

      let updates: Partial<MeshtasticNode> = {
        snr: rxSnr,
        rssi: rxRssi,
        hops: isLocal ? 0 : undefined,
        connectionType: isLocal ? 'BLE' : 'LORA_MESH',
        // We just received a packet from this node
        lastPingTime: Date.now(),
      };
      let logPayload = `PortNum ${portnum}`;
      let textMsg: string | undefined;

      if (payloadBytes && payloadBytes.length > 0) {
        // Port 1: TEXT_MESSAGE_APP
        if (portnum === 1) {
          textMsg = new TextDecoder('utf-8', { fatal: false }).decode(payloadBytes);
          logPayload = `Text: "${textMsg}"`;
        }
        // Port 3: POSITION_APP
        else if (portnum === 3) {
          const pos = this.parseProtobufPosition(payloadBytes);
          if (pos.lat !== null && pos.lng !== null && !isNaN(pos.lat) && !isNaN(pos.lng) && (pos.lat !== 0 || pos.lng !== 0)) {
            updates.lat = pos.lat;
            updates.lng = pos.lng;
            if (pos.alt !== null) updates.altitudeMeters = pos.alt;
            if (pos.speedKt !== null) updates.speedKt = pos.speedKt;
            if (pos.headingDeg !== null) updates.headingDeg = pos.headingDeg;
            if (pos.sats !== null) updates.satsInFix = pos.sats;

            // GNSS satellite atomic hardware timestamp (pos.time is in seconds since epoch from GPS receiver)
            const gnssSatelliteTime = (pos.time !== null && pos.time > 1000000000) ? Math.min(pos.time * 1000, Date.now()) : Date.now();

            // Buffer point for Store-and-Forward trajectory replay and mark rounding backfill
            const backfillPt: BackfillPoint = {
              lat: pos.lat,
              lng: pos.lng,
              speedKt: pos.speedKt ?? 0,
              headingDeg: pos.headingDeg ?? 0,
              altitudeMeters: pos.alt ?? 0,
              accuracy: (pos.sats && pos.sats >= 4) ? Math.max(2, 20 - pos.sats) : 5,
              timestamp: gnssSatelliteTime,
            };
            const buf = this.nodePositionBuffers.get(senderId) || [];
            buf.push(backfillPt);
            if (buf.length > 2000) buf.shift();
            this.nodePositionBuffers.set(senderId, buf);

            const timeStr = new Date(gnssSatelliteTime).toISOString().slice(11, 19);
            logPayload = `GNSS Sat Fix: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} SOG:${pos.speedKt ?? 0}kt COG:${pos.headingDeg ?? 0}° [GPS Time: ${timeStr}Z]`;
          }
        }
        // Port 4: NODEINFO_APP
        else if (portnum === 4) {
          const user = this.parseProtobufUser(payloadBytes);
          if (user.longName) updates.longName = user.longName;
          if (user.shortName) updates.shortName = user.shortName;
          logPayload = `Node Info: ${user.longName || user.shortName || senderId}`;
        }
        // Port 67: TELEMETRY_APP
        else if (portnum === 67) {
          const telemetry = this.decodeTelemetryPacket(payloadBytes);
          if (telemetry.batteryPct !== undefined) updates.battery = telemetry.batteryPct;
          if (telemetry.voltage !== undefined) updates.voltage = telemetry.voltage;
          if (telemetry.tempC !== undefined) updates.temperature = telemetry.tempC;
          if (telemetry.humPct !== undefined) {
            updates.humidity = telemetry.humPct;
            updates.relativeHumidity = telemetry.humPct;
          }
          if (telemetry.pressureHpa !== undefined) updates.barometricPressure = telemetry.pressureHpa;
          if (telemetry.tempC !== undefined || telemetry.pressureHpa !== undefined) {
            updates.sensorModel = 'BME280';
            logPayload = `BME280: ${telemetry.tempC ?? '?'}°C, ${telemetry.humPct ?? '?'}% RH, ${telemetry.pressureHpa ?? '?'} hPa`;
          } else if (telemetry.batteryPct !== undefined) {
            logPayload = `Device Telemetry: Bat ${telemetry.batteryPct}% (${telemetry.voltage ?? '?'}V)`;
          }
        }
      }

      const senderNode = this.upsertDiscoveredNode(senderId, updates, isLocal);

      this.emitPacketLog({
        id: 'pkt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        timestamp: new Date().toLocaleTimeString(),
        rawTimestamp: Date.now(),
        fromNode: senderNode.id,
        fromNodeName: senderNode.longName,
        toNode: toNum && toNum !== 0xFFFFFFFF ? canonicalNodeId(toNum) : '^all',
        portnum: portnum === 1 ? 'TEXT_MESSAGE_APP' : (portnum === 3 ? 'POSITION_APP' : (portnum === 4 ? 'NODEINFO_APP' : (portnum === 67 ? 'TELEMETRY_APP' : 'ROUTING_APP'))),
        snr: rxSnr,
        rssi: rxRssi,
        hops: updates.hops,
        payload: logPayload,
        textMessage: textMsg,
      });
    }
  }

  /**
   * 4. Decode Telemetry Protobuf Packet (Port 67)
   */
  public decodeTelemetryPacket(payloadBytes: Uint8Array): {
    tempC?: number;
    humPct?: number;
    pressureHpa?: number;
    batteryPct?: number;
    voltage?: number;
  } {
    const reader = new ProtoReader(payloadBytes);
    let tempC: number | undefined;
    let humPct: number | undefined;
    let pressureHpa: number | undefined;
    let batteryPct: number | undefined;
    let voltage: number | undefined;

    while (reader.hasMore()) {
      const tag = reader.readTag();
      if (!tag) break;

      // Field 2: DeviceMetrics (Battery, Voltage, Channel Util)
      if (tag.fieldNum === 2) {
        const dmReader = new ProtoReader(reader.readBytes());
        while (dmReader.hasMore()) {
          const dTag = dmReader.readTag();
          if (dTag.fieldNum === 1) batteryPct = dmReader.readVarint();
          else if (dTag.fieldNum === 2) voltage = parseFloat(dmReader.readFloat().toFixed(2));
          else dmReader.skip(dTag.wireType);
        }
      }
      // Field 3: EnvironmentMetrics (BME280 / SHTC3 Onboard Sensor)
      else if (tag.fieldNum === 3) {
        const envReader = new ProtoReader(reader.readBytes());
        while (envReader.hasMore()) {
          const eTag = envReader.readTag();
          if (eTag.fieldNum === 1) tempC = parseFloat(envReader.readFloat().toFixed(1));
          else if (eTag.fieldNum === 2) humPct = Math.round(envReader.readFloat());
          else if (eTag.fieldNum === 3) pressureHpa = parseFloat(envReader.readFloat().toFixed(1));
          else envReader.skip(eTag.wireType);
        }
      } else {
        reader.skip(tag.wireType);
      }
    }

    return { tempC, humPct, pressureHpa, batteryPct, voltage };
  }

  /**
   * 5. Request BME280 / Environmental Telemetry from local or remote node
   */
  public async requestBmeTelemetry(toRadioChar?: any): Promise<boolean> {
    const targetChar = toRadioChar || this.toRadioChar;
    if (!targetChar) {
      console.warn('[BLE] toRadio characteristic not ready');
      return false;
    }

    try {
      // Construct a MeshPacket targeting broadcast with want_response: true on Port 67 (0x43)
      const dataPayload = new Uint8Array([
        0x08, 0x43, // portnum: 67 (TELEMETRY_APP)
        0x18, 0x01, // want_response: true
      ]);

      const meshPkt = new Uint8Array([
        0x10, 0xff, 0xff, 0xff, 0xff, 0x0f, // to = 0xFFFFFFFF (broadcast)
        0x22, dataPayload.length, ...dataPayload // decoded Data field
      ]);

      // Wrap in ToRadio envelope (field 2 = packet)
      const toRadioPacket = new Uint8Array([0x12, meshPkt.length, ...meshPkt]);
      if (typeof targetChar.writeValueWithoutResponse === 'function') {
        await targetChar.writeValueWithoutResponse(toRadioPacket);
      } else {
        await targetChar.writeValue(toRadioPacket);
      }
      console.log('[BLE] Sent BME280 Telemetry Request (Port 67 want_response)');
      return true;
    } catch (err) {
      console.warn('[BLE] Failed to send BME telemetry request:', err);
      return false;
    }
  }


  // Parse Text / NMEA if Bluetooth serial stream is used ($GNRMC, $GNGGA, $GNVTG)
  private parseRawTextTelemetry(text: string) {
    if (!this.tEchoNodeState) return;

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('$')) continue;

      if (trimmed.includes('RMC')) {
        const parts = trimmed.split(',');
        if (parts.length > 6 && parts[2] === 'A') { // Valid fix
          const rawLat = parseFloat(parts[3]);
          const latDeg = Math.floor(rawLat / 100);
          const latMin = rawLat - latDeg * 100;
          let lat = latDeg + latMin / 60;
          if (parts[4] === 'S') lat = -lat;

          const rawLng = parseFloat(parts[5]);
          const lngDeg = Math.floor(rawLng / 100);
          const lngMin = rawLng - lngDeg * 100;
          let lng = lngDeg + lngMin / 60;
          if (parts[6] === 'W') lng = -lng;

          const spdKt = parseFloat(parts[7]) || 0;
          const cog = parseFloat(parts[8]) || 0;

          this.tEchoNodeState.lat = lat;
          this.tEchoNodeState.lng = lng;
          this.tEchoNodeState.speedKt = spdKt;
          this.tEchoNodeState.headingDeg = Math.round(cog);
          this.tEchoNodeState.gpsFix = true;
          this.tEchoNodeState.lastPingTime = Date.now();
          this.emitNode(this.tEchoNodeState);
        }
      } else if (trimmed.includes('GGA')) {
        const parts = trimmed.split(',');
        if (parts.length > 9) {
          const fixQuality = parseInt(parts[6], 10);
          if (fixQuality > 0) {
            const rawLat = parseFloat(parts[2]);
            const latDeg = Math.floor(rawLat / 100);
            const latMin = rawLat - latDeg * 100;
            let lat = latDeg + latMin / 60;
            if (parts[3] === 'S') lat = -lat;

            const rawLng = parseFloat(parts[4]);
            const lngDeg = Math.floor(rawLng / 100);
            const lngMin = rawLng - lngDeg * 100;
            let lng = lngDeg + lngMin / 60;
            if (parts[5] === 'W') lng = -lng;

            const sats = parseInt(parts[7], 10);
            const alt = parseFloat(parts[9]);

            this.tEchoNodeState.lat = lat;
            this.tEchoNodeState.lng = lng;
            if (!isNaN(sats)) this.tEchoNodeState.satsInFix = sats;
            if (!isNaN(alt)) this.tEchoNodeState.altitudeMeters = alt;
            this.tEchoNodeState.gpsFix = true;
            this.tEchoNodeState.lastPingTime = Date.now();
            this.emitNode(this.tEchoNodeState);
          }
        }
      } else if (trimmed.includes('VTG')) {
        const parts = trimmed.split(',');
        if (parts.length > 7) {
          const cog = parseFloat(parts[1]) || 0;
          const spdKt = parseFloat(parts[7]) || 0;
          this.tEchoNodeState.headingDeg = Math.round(cog);
          this.tEchoNodeState.speedKt = spdKt;
          this.tEchoNodeState.lastPingTime = Date.now();
          this.emitNode(this.tEchoNodeState);
        }
      }
    }
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
        // ground_speed is m/s in the Meshtastic spec (1 knot = 0.514444 m/s)
        ground_speed: node.speedKt !== undefined ? +(node.speedKt * 0.514444).toFixed(1) : undefined,
        ground_track: node.headingDeg !== undefined ? Math.round(node.headingDeg) : undefined,
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
        // ground_speed in the Meshtastic position message is m/s (1 m/s = 1.94384 knots)
        const speedKt = num(p.ground_speed) !== undefined ? +(p.ground_speed * 1.94384).toFixed(1) : num(p.speed);
        const headingDeg = num(p.ground_track) ?? num(p.heading);

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
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
    if (this.gattDevice && this.gattDevice.gatt && this.gattDevice.gatt.connected) {
      this.gattDevice.gatt.disconnect();
    }
    this.isBleConnected = false;
    this.gattServer = null;
    this.fromRadioChar = null;
    this.toRadioChar = null;
    this.fromNumChar = null;
    this.nusTxChar = null;

    if (this.mqttClient) {
      this.mqttClient.end();
      this.mqttClient = null;
    }
  }
}

export const meshtasticService = new MeshtasticBleMqttService();
