import { meshtasticService } from './meshtasticBleMqttService';
import {
  DeviceTrackerProfile,
  DeviceGpsState,
  HybridFleetMember,
  MeshtasticNode,
  TrackerDeviceType,
  TrackerVesselRole,
  CourseMark,
  RaceState,
  Boat,
  VhfBulletin,
  CompletedRace,
  BackfillPoint,
  GpsBatchBackfillPayload,
} from '../types/regatta';

// Detect Device Info from Browser User Agent
function detectDeviceType(): { type: TrackerDeviceType; name: string } {
  if (typeof window === 'undefined') {
    return { type: 'PC', name: 'Browser Client' };
  }

  const ua = navigator.userAgent || '';
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';

  if (/iPad|Tablet/i.test(ua) || (/Macintosh/i.test(ua) && 'ontouchend' in document)) {
    return { type: 'TABLET', name: 'iPad / Marine Tablet' };
  }
  if (/iPhone/i.test(ua)) {
    return { type: 'PHONE', name: 'Apple iPhone GPS' };
  }
  if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) {
      return { type: 'PHONE', name: 'Android Phone GPS' };
    }
    return { type: 'TABLET', name: 'Android Marine Tablet' };
  }
  if (/Mac/i.test(platform)) {
    return { type: 'PC', name: 'MacBook Nav Station' };
  }
  if (/Win/i.test(platform)) {
    return { type: 'PC', name: 'Windows PC Nav Station' };
  }
  return { type: 'PHONE', name: 'Mobile Web GPS' };
}

// Generate persistent unique Device ID
function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'DEV-' + Math.random().toString(16).substring(2, 6).toUpperCase();
  try {
    let id = localStorage.getItem('tmtrac_device_tracker_id') || localStorage.getItem('sailmesh_device_tracker_id');
    if (!id) {
      const rand = Math.random().toString(16).substring(2, 6).toUpperCase();
      id = `DEV-${rand}`;
      localStorage.setItem('tmtrac_device_tracker_id', id);
    }
    return id;
  } catch (e) {
    return 'DEV-' + Math.random().toString(16).substring(2, 6).toUpperCase();
  }
}

// Default Device Tracker Profile
export function getDefaultDeviceProfile(): DeviceTrackerProfile {
  const detected = detectDeviceType();
  const deviceId = getOrCreateDeviceId();
  const roleColors: Record<TrackerVesselRole, string> = {
    COMPETITOR: '#00D4FF',
    SAFETY_BOAT: '#FF9900',
    RACE_COMMITTEE: '#FF4D4D',
    SPECTATOR: '#00FF9D',
    VIP_CHASE: '#C084FC',
    MEDIA: '#E879F9',
  };

  let savedName = '';
  let savedRole: TrackerVesselRole = 'COMPETITOR';
  let savedColor = roleColors.COMPETITOR;

  if (typeof window !== 'undefined') {
    try {
      savedName = localStorage.getItem('tmtrac_tracker_name') || localStorage.getItem('sailmesh_tracker_name') || '';
      const r = (localStorage.getItem('tmtrac_tracker_role') || localStorage.getItem('sailmesh_tracker_role')) as TrackerVesselRole;
      if (r) savedRole = r;
      savedColor = localStorage.getItem('tmtrac_tracker_color') || localStorage.getItem('sailmesh_tracker_color') || roleColors[savedRole] || '#00D4FF';
    } catch (e) {}
  }

  return {
    deviceId,
    deviceName: savedName || `${detected.name} (${deviceId.slice(-4)})`,
    deviceType: detected.type,
    role: savedRole,
    boundBoatId: null,
    sailNumber: undefined,
    color: savedColor,
    isBroadcasting: true,
    updateIntervalSec: 2,
    packetsTransmitted: 0,
  };
}

import { roomService } from './roomService';
import { authService } from './authService';
import { recordRoundTrip, recordServerTimestamp } from './serverClock';

export type FleetMemberUpdateCallback = (members: HybridFleetMember[]) => void;
export type DeviceGpsUpdateCallback = (gpsState: DeviceGpsState) => void;
export type RemoteNodeGeneratedCallback = (node: MeshtasticNode) => void;
export type PeerCountCallback = (count: number) => void;
export type SessionSyncCallback = (session: {
  sessionId: string;
  roomCode?: string;
  title?: string;
  locationName?: string;
  isAdmin?: boolean;
  // Whether this connection may edit the room (Race Officer or admin), as decided by the server
  canEdit?: boolean;
  raceState?: Partial<RaceState>;
  marks?: CourseMark[];
  boats?: Boat[];
  trackers?: any[];
  vhfBulletins?: VhfBulletin[];
  seriesRaces?: CompletedRace[];
}) => void;
export type RemoteMarksCallback = (marks: CourseMark[]) => void;
export type RemoteRaceStateCallback = (raceState: Partial<RaceState>) => void;
export type RemoteBoatsCallback = (boats: Boat[]) => void;
export type RemoteVhfCallback = (bulletin: VhfBulletin) => void;
export type RemoteSeriesRacesCallback = (series: CompletedRace[]) => void;
export type BatchBackfillCallback = (payload: GpsBatchBackfillPayload) => void;
export type EditRejectedCallback = (rejection: { action: string; roomCode: string; role: string; reason: string }) => void;

class HybridDeviceTrackerService {
  private profile: DeviceTrackerProfile = getDefaultDeviceProfile();
  private gpsWatchId: number | null = null;
  private batteryLevel: number | null = 88;

  private currentGpsState: DeviceGpsState;

  // Remote fleet members connected from other visitor phones, tablets, and PCs
  private remoteMembers: Map<string, HybridFleetMember> = new Map();
  private fleetCallbacks: FleetMemberUpdateCallback[] = [];
  private gpsCallbacks: DeviceGpsUpdateCallback[] = [];
  private remoteNodeCallbacks: RemoteNodeGeneratedCallback[] = [];
  private peerCountCallbacks: PeerCountCallback[] = [];
  private sessionSyncCallbacks: SessionSyncCallback[] = [];
  private remoteMarksCallbacks: RemoteMarksCallback[] = [];
  private remoteRaceStateCallbacks: RemoteRaceStateCallback[] = [];
  private remoteBoatsCallbacks: RemoteBoatsCallback[] = [];
  private remoteVhfCallbacks: RemoteVhfCallback[] = [];
  private remoteSeriesRacesCallbacks: RemoteSeriesRacesCallback[] = [];
  private batchBackfillCallbacks: BatchBackfillCallback[] = [];
  private editRejectedCallbacks: EditRejectedCallback[] = [];

  // Store-and-Forward Offline FIFO Buffer
  private offlinePointsBuffer: BackfillPoint[] = [];
  // Replayed batches waiting for the server's GPS_BATCH_ACK; they stay on the device until then
  private pendingGpsBatches: Map<string, BackfillPoint[]> = new Map();

  // Live WebSocket Connection to Server
  private ws: WebSocket | null = null;
  // The login the current socket was opened with; the server decides room rights from it
  private wsToken = '';
  private wsConnected = false;
  private wsReconnectTimer: any = null;
  private pingTimer: any = null;
  private connectedPeerCount = 1;
  // Room + PIN last sent to the server, so a PIN unlocked after connecting still reaches the socket
  private joinedRoomCode = '';
  // Device time of the last PING, to measure the round trip when its PONG arrives
  private lastPingSentAt = 0;
  private joinedRoomPin = '';

  // Secondary communication channels
  private broadcastChannel: BroadcastChannel | null = null;
  private broadcastIntervalTimer: any = null;

  // Previous position to calculate speed/heading if device doesn't report it
  private prevCoords: { lat: number; lng: number; time: number } | null = null;

  // Real-time Compass Sensor (Magnetic / True Heading from Device Orientation)
  private compassHeadingDeg: number | null = null;
  private orientationListener: ((e: any) => void) | null = null;

  // Internal store of node-to-boat binding mappings (nodeId -> boatId)
  private nodeBoatBindings: Map<string, string> = new Map();

  constructor() {
    // Generate deterministic initial anchor coordinates so device is immediately mappable
    const devHash = (this.profile.deviceId.charCodeAt(4) || 65) % 20;
    const initialLat = 6.308 + (devHash - 10) * 0.0018;
    const initialLng = 99.845 + (devHash - 10) * 0.0018;

    this.currentGpsState = {
      active: false,
      lat: initialLat,
      lng: initialLng,
      accuracy: 8,
      speedKt: 0,
      headingDeg: 0,
      altitudeMeters: 5,
      batteryLevel: this.batteryLevel,
      timestamp: Date.now(),
      error: null,
      isSharing: true,
      packetsSent: 0,
      profile: this.profile,
    };

    // Restore any offline points saved across browser reload / disconnection
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('tmtrac_offline_gps_buffer');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            this.offlinePointsBuffer = parsed;
          }
        }
      }
    } catch (e) {}

    this.initBroadcastChannel();
    this.initBatteryReporting();
    this.initWebSocketClient();

    // Listen to network online event to flush buffered points on reconnection
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('📶 Internet connectivity restored on mobile device, flushing Store-and-Forward buffer...');
        if (!this.wsConnected) {
          this.initWebSocketClient();
        } else {
          this.flushOfflineBuffer();
        }
      });
    }

    // Listen to active room changes and seamlessly switch WebSocket room
    roomService.onRoomChange((code) => {
      const pin = roomService.getActiveRoomPin();
      if (code !== this.joinedRoomCode || pin !== this.joinedRoomPin) {
        this.switchRoom(code, pin);
      }
    });

    // Location is only shared after the person turns tracking on (Track, or the Device Tracker
    // toggle). If they did and the page reloads, e.g. a phone mid-race, sharing resumes.
    if (typeof window !== 'undefined' && HybridDeviceTrackerService.hasGpsOptIn()) {
      setTimeout(() => {
        this.startGpsTracking().catch(() => {});
      }, 500);
    }
  }

  public getProfile(): DeviceTrackerProfile {
    return { ...this.profile };
  }

  public getGpsState(): DeviceGpsState {
    return { ...this.currentGpsState };
  }

  public getRemoteMembers(): HybridFleetMember[] {
    return Array.from(this.remoteMembers.values());
  }

  public getPeerCount(): number {
    return this.connectedPeerCount;
  }

  public isServerConnected(): boolean {
    return this.wsConnected;
  }

  public onFleetUpdate(cb: FleetMemberUpdateCallback) {
    this.fleetCallbacks.push(cb);
    cb(this.getRemoteMembers());
    return () => {
      this.fleetCallbacks = this.fleetCallbacks.filter((c) => c !== cb);
    };
  }

  public onGpsUpdate(cb: DeviceGpsUpdateCallback) {
    this.gpsCallbacks.push(cb);
    cb(this.getGpsState());
    return () => {
      this.gpsCallbacks = this.gpsCallbacks.filter((c) => c !== cb);
    };
  }

  public onRemoteNodeGenerated(cb: RemoteNodeGeneratedCallback) {
    this.remoteNodeCallbacks.push(cb);
    // Immediately replay all currently known remote devices as MeshtasticNodes
    this.remoteMembers.forEach((member) => {
      const node = this.convertMemberToNode(member);
      cb(node);
    });
    return () => {
      this.remoteNodeCallbacks = this.remoteNodeCallbacks.filter((c) => c !== cb);
    };
  }

  public onPeerCount(cb: PeerCountCallback) {
    this.peerCountCallbacks.push(cb);
    cb(this.connectedPeerCount);
    return () => {
      this.peerCountCallbacks = this.peerCountCallbacks.filter((c) => c !== cb);
    };
  }

  public onSessionSync(cb: SessionSyncCallback) {
    this.sessionSyncCallbacks.push(cb);
    return () => {
      this.sessionSyncCallbacks = this.sessionSyncCallbacks.filter((c) => c !== cb);
    };
  }

  public onRemoteMarks(cb: RemoteMarksCallback) {
    this.remoteMarksCallbacks.push(cb);
    return () => {
      this.remoteMarksCallbacks = this.remoteMarksCallbacks.filter((c) => c !== cb);
    };
  }

  public onRemoteRaceState(cb: RemoteRaceStateCallback) {
    this.remoteRaceStateCallbacks.push(cb);
    return () => {
      this.remoteRaceStateCallbacks = this.remoteRaceStateCallbacks.filter((c) => c !== cb);
    };
  }

  public onRemoteBoats(cb: RemoteBoatsCallback) {
    this.remoteBoatsCallbacks.push(cb);
    return () => {
      this.remoteBoatsCallbacks = this.remoteBoatsCallbacks.filter((c) => c !== cb);
    };
  }

  public onRemoteVhf(cb: RemoteVhfCallback) {
    this.remoteVhfCallbacks.push(cb);
    return () => {
      this.remoteVhfCallbacks = this.remoteVhfCallbacks.filter((c) => c !== cb);
    };
  }

  public onRemoteSeriesRaces(cb: RemoteSeriesRacesCallback) {
    this.remoteSeriesRacesCallbacks.push(cb);
    return () => {
      this.remoteSeriesRacesCallbacks = this.remoteSeriesRacesCallbacks.filter((c) => c !== cb);
    };
  }

  public onBatchBackfill(cb: BatchBackfillCallback) {
    this.batchBackfillCallbacks.push(cb);
    return () => {
      this.batchBackfillCallbacks = this.batchBackfillCallbacks.filter((c) => c !== cb);
    };
  }

  public getOfflineBufferCount(): number {
    let pending = 0;
    this.pendingGpsBatches.forEach((points) => (pending += points.length));
    return this.offlinePointsBuffer.length + pending;
  }

  // Saves queued and not-yet-confirmed points together, so a reload or crash loses neither
  private persistOfflineBuffer() {
    try {
      if (typeof localStorage === 'undefined') return;
      const all: BackfillPoint[] = [];
      this.pendingGpsBatches.forEach((points) => all.push(...points));
      all.push(...this.offlinePointsBuffer);
      if (all.length === 0) {
        localStorage.removeItem('tmtrac_offline_gps_buffer');
      } else {
        localStorage.setItem('tmtrac_offline_gps_buffer', JSON.stringify(all.slice(-2000)));
      }
    } catch (e) {}
  }

  // Puts unconfirmed batches back at the front of the queue (oldest first) for the next flush
  private requeuePendingBatches(batchIds?: string[]) {
    const ids = batchIds || Array.from(this.pendingGpsBatches.keys());
    const back: BackfillPoint[] = [];
    ids.forEach((id) => {
      const points = this.pendingGpsBatches.get(id);
      if (points) back.push(...points);
      this.pendingGpsBatches.delete(id);
    });
    if (back.length > 0) {
      this.offlinePointsBuffer = [...back, ...this.offlinePointsBuffer].slice(-5000);
    }
    this.persistOfflineBuffer();
  }

  public flushOfflineBuffer() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.offlinePointsBuffer.length === 0) return;
    // One replay at a time: wait for the server to answer the batches already in flight
    if (this.pendingGpsBatches.size > 0) return;

    console.log(`🚀 [Store-and-Forward] Flushing ${this.offlinePointsBuffer.length} queued offline GPS points to server...`);
    const pointsToSend = [...this.offlinePointsBuffer];
    this.offlinePointsBuffer = [];

    // Transmit in chunks of 200 fixes to prevent buffer overload
    const CHUNK_SIZE = 200;
    const flushId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    for (let i = 0; i < pointsToSend.length; i += CHUNK_SIZE) {
      const chunk = pointsToSend.slice(i, i + CHUNK_SIZE);
      const batchId = `${flushId}-${i / CHUNK_SIZE}`;
      this.pendingGpsBatches.set(batchId, chunk);
      const payload: GpsBatchBackfillPayload = {
        deviceId: this.profile.deviceId,
        deviceName: this.profile.deviceName,
        deviceType: this.profile.deviceType,
        boundBoatId: this.profile.boundBoatId,
        points: chunk,
        batchId,
      };
      if (!this.sendWs('GPS_BATCH_BACKFILL', payload)) {
        this.requeuePendingBatches([batchId]);
        continue;
      }
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({ type: 'FLEET_GPS_BATCH_BACKFILL', payload });
        } catch (e) {}
      }
    }
    this.persistOfflineBuffer();
  }

  // Called when the server refuses an edit from this device (no edit rights in the room)
  public onEditRejected(cb: EditRejectedCallback): () => void {
    this.editRejectedCallbacks.push(cb);
    return () => {
      this.editRejectedCallbacks = this.editRejectedCallbacks.filter((c) => c !== cb);
    };
  }

  // Allow LoRa Gateway / Node (Meshtastic) to broadcast historical backfilled points (from internal flash or burst RF)
  public broadcastHardwareBatch(nodeId: string, points: BackfillPoint[], boundBoatId?: string | null) {
    if (!nodeId || !Array.isArray(points) || points.length === 0) return;
    const cleanId = nodeId.startsWith('!') ? nodeId.toUpperCase() : `!${nodeId.toUpperCase()}`;
    const payload: GpsBatchBackfillPayload = {
      deviceId: cleanId,
      deviceName: `LoRa Node ${cleanId.slice(-4)}`,
      deviceType: 'LORA_MESH',
      boundBoatId: boundBoatId || this.nodeBoatBindings.get(nodeId) || null,
      points,
    };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendWs('GPS_BATCH_BACKFILL', payload);
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'FLEET_GPS_BATCH_BACKFILL', payload });
      } catch (e) {}
    }
    // Also notify local components so course progress evaluates immediately
    this.batchBackfillCallbacks.forEach((cb) => cb(payload));
  }

  private notifyFleet() {
    const list = this.getRemoteMembers();
    this.fleetCallbacks.forEach((cb) => cb(list));
  }

  private notifyGps() {
    this.gpsCallbacks.forEach((cb) => cb({ ...this.currentGpsState }));
  }

  private notifyPeerCount(count: number) {
    this.connectedPeerCount = count;
    this.peerCountCallbacks.forEach((cb) => cb(count));
  }

  public setNodeBoundBoat(nodeId: string, boatId: string | null) {
    if (boatId) {
      this.nodeBoatBindings.set(nodeId, boatId);
    } else {
      this.nodeBoatBindings.delete(nodeId);
    }

    // If this matches local profile device ID, update profile too
    if (nodeId === this.profile.deviceId || nodeId === this.getLocalNode().id) {
      this.profile.boundBoatId = boatId || null;
      this.currentGpsState.profile = this.profile;
      this.notifyGps();
    }
  }

  public getNodeBoundBoat(nodeId: string): string | null {
    return this.nodeBoatBindings.get(nodeId) || (nodeId === this.profile.deviceId ? this.profile.boundBoatId : null);
  }

  public convertMemberToNode(member: HybridFleetMember): MeshtasticNode {
    const isHardwareLora = member.deviceId.startsWith('!') || 
      member.deviceType.startsWith('LORA') || 
      member.deviceType === 'CUSTOM_MQTT' ||
      /^[0-9a-fA-F]{8}$/.test(member.deviceId);

    const canonicalNodeId = isHardwareLora
      ? (member.deviceId.startsWith('!') ? member.deviceId.toUpperCase() : `!${member.deviceId.toUpperCase()}`)
      : `!DEV-${member.deviceId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}`;

    const boundBoatId = member.boundBoatId || 
      this.nodeBoatBindings.get(canonicalNodeId) || 
      this.nodeBoatBindings.get(member.deviceId) || 
      null;

    return {
      id: canonicalNodeId,
      longName: member.deviceName,
      shortName: member.deviceId.slice(-4).toUpperCase(),
      mac: isHardwareLora ? `LORA:${member.deviceId.slice(-4).toUpperCase()}` : `GPS:${member.deviceId.slice(-4).toUpperCase()}`,
      battery: member.battery || 85,
      voltage: 3.95,
      satsInView: 12,
      satsInFix: 10,
      gpsFix: typeof member.lat === 'number' && typeof member.lng === 'number' && member.lat !== 0 && member.lng !== 0,
      altitudeMeters: member.altitudeMeters || 8,
      speedKt: member.speedKt,
      headingDeg: member.headingDeg,
      lat: member.lat,
      lng: member.lng,
      snr: 12,
      rssi: -52,
      hops: 0,
      boundBoatId: boundBoatId,
      status: 'OPTIMAL',
      connectionType: isHardwareLora 
        ? 'LORA_MESH' 
        : (member.deviceType === 'TABLET' ? 'TABLET' : member.deviceType === 'PHONE' ? 'PHONE' : 'DEVICE_GPS'),
      lastPingTime: member.timestamp || Date.now(),
      hardwareModel: `${member.deviceType} (${member.role})`,
      firmwareVersion: 'TMTRAC WebGPS v2.5',
      isDeviceGps: !isHardwareLora,
      deviceRole: member.role,
      trail: member.trail,
    };
  }

  public getLocalNode(): MeshtasticNode {
    const localId = `!DEV-${this.profile.deviceId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}`;
    const boundBoatId = this.profile.boundBoatId || this.nodeBoatBindings.get(this.profile.deviceId) || this.nodeBoatBindings.get(localId) || null;
    const isActive = !!this.currentGpsState.active;
    const hasCoords = isActive && typeof this.currentGpsState.lat === 'number' && typeof this.currentGpsState.lng === 'number';

    return {
      id: localId,
      longName: `${this.profile.deviceName} (This Device)`,
      shortName: this.profile.deviceId.slice(-4),
      mac: `GPS:${this.profile.deviceId.slice(-4)}`,
      battery: this.batteryLevel || 90,
      voltage: 4.1,
      satsInView: isActive ? 14 : 0,
      satsInFix: isActive ? 12 : 0,
      gpsFix: isActive,
      altitudeMeters: isActive ? (this.currentGpsState.altitudeMeters || 5) : undefined,
      speedKt: isActive ? (this.currentGpsState.speedKt ?? 0) : undefined,
      headingDeg: isActive ? (this.currentGpsState.headingDeg ?? 0) : undefined,
      lat: hasCoords ? this.currentGpsState.lat : undefined,
      lng: hasCoords ? this.currentGpsState.lng : undefined,
      snr: 14,
      rssi: -45,
      hops: 0,
      boundBoatId: boundBoatId,
      status: isActive ? 'OPTIMAL' : 'OFFLINE',
      connectionType: this.profile.deviceType === 'TABLET' ? 'TABLET' : this.profile.deviceType === 'PHONE' ? 'PHONE' : 'DEVICE_GPS',
      lastPingTime: isActive ? Date.now() : 0,
      hardwareModel: `${this.profile.deviceType} Nav Station`,
      firmwareVersion: 'TMTRAC WebGPS Host',
      isDeviceGps: true,
      deviceRole: this.profile.role,
      trail: hasCoords && this.currentGpsState.lat && this.currentGpsState.lng ? [{ lat: this.currentGpsState.lat, lng: this.currentGpsState.lng }] : [],
    };
  }

  public getBroadcastPayload() {
    const localId = `!DEV-${this.profile.deviceId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}`;
    const boundBoatId = this.profile.boundBoatId || this.nodeBoatBindings.get(this.profile.deviceId) || this.nodeBoatBindings.get(localId) || null;
    return {
      deviceId: this.profile.deviceId,
      deviceName: this.profile.deviceName,
      deviceType: this.profile.deviceType,
      role: this.profile.role,
      boundBoatId: boundBoatId,
      sailNumber: this.profile.sailNumber,
      color: this.profile.color,
      lat: this.currentGpsState.lat ?? 6.308,
      lng: this.currentGpsState.lng ?? 99.845,
      accuracy: this.currentGpsState.accuracy || 6,
      speedKt: this.currentGpsState.speedKt || 0,
      headingDeg: this.currentGpsState.headingDeg || 0,
      altitudeMeters: this.currentGpsState.altitudeMeters || 5,
      battery: this.batteryLevel || 88,
      timestamp: Date.now(),
      trail: [{ lat: this.currentGpsState.lat ?? 6.308, lng: this.currentGpsState.lng ?? 99.845 }],
      isOnline: true,
    };
  }

  public announceDevice() {
    const payload = this.getBroadcastPayload();
    this.sendWs('DEVICE_ANNOUNCE', payload);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'FLEET_GPS_BROADCAST',
          payload,
        });
      } catch (e) {}
    }
  }

  // --- Real-time WebSocket Client for Shared Multi-Device Regatta Session ---
  private initWebSocketClient() {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    const connect = () => {
      try {
        const activeRoom = roomService.getActiveRoomCode();
        const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('tmtrac_auth_token_v1') || '') : '';
        this.wsToken = token;
        const wsUrl = `${protocol}//${host}/ws?room=${encodeURIComponent(activeRoom)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          this.ws = socket;
          this.wsConnected = true;
          console.log('⚡ Connected to TMTRAC Central Real-Time Regatta Server:', wsUrl);

          // Start ping heartbeat
          if (this.pingTimer) clearInterval(this.pingTimer);
          const sendPing = () => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.lastPingSentAt = Date.now();
              this.ws.send(JSON.stringify({ type: 'PING' }));
            }
          };
          this.pingTimer = setInterval(sendPing, 15000);
          // A few quick pings right after connecting so the race clock is accurate within seconds
          [0, 1000, 3000].forEach((delay) => setTimeout(sendPing, delay));

          // The connect URL carries only room + login token; re-join with the room PIN so
          // PIN-unlocked Race Officers and participants get their role on this socket
          const activePin = roomService.getActiveRoomPin();
          this.joinedRoomCode = activeRoom;
          this.joinedRoomPin = activePin;
          if (activePin) {
            this.sendWs('JOIN_ROOM', { roomCode: activeRoom, pin: activePin });
          }

          // Immediately announce this device to server and all connected clients
          this.announceDevice();
          this.broadcastCurrentLocation();
          this.startBroadcastTimer();
          // Flush any points queued during cellular blackout / offline period
          this.flushOfflineBuffer();
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const { type, payload } = data;

            switch (type) {
              case 'SESSION_INIT_STATE': {
                if (payload) {
                  if (typeof payload.serverTime === 'number') recordServerTimestamp(payload.serverTime);
                  if (payload.connectedClients) {
                    this.notifyPeerCount(payload.connectedClients);
                  }
                  if (payload.trackers && Array.isArray(payload.trackers)) {
                    payload.trackers.forEach((t: any) => this.handleIncomingFleetPacket(t));
                  }
                  this.sessionSyncCallbacks.forEach((cb) => cb(payload));
                  // A (re)join may have granted participant rights: retry points the server refused earlier
                  this.flushOfflineBuffer();
                }
                break;
              }

              case 'GPS_BATCH_ACK': {
                if (payload?.batchId && this.pendingGpsBatches.delete(payload.batchId)) {
                  this.persistOfflineBuffer();
                  if (this.pendingGpsBatches.size === 0) this.flushOfflineBuffer();
                }
                break;
              }

              case 'GPS_BATCH_REJECTED': {
                if (payload?.batchId) {
                  console.warn(`[Store-and-Forward] Server kept none of batch ${payload.batchId} (${payload.reason}); points stay queued`);
                  this.requeuePendingBatches([payload.batchId]);
                }
                break;
              }

              case 'UPDATE_REJECTED': {
                if (payload) {
                  this.editRejectedCallbacks.forEach((cb) => cb(payload));
                }
                break;
              }

              case 'PONG': {
                if (this.lastPingSentAt && typeof data.timestamp === 'number') {
                  recordRoundTrip(this.lastPingSentAt, data.timestamp, Date.now());
                  this.lastPingSentAt = 0;
                }
                break;
              }

              case 'PEER_COUNT_UPDATE': {
                if (payload && typeof payload.count === 'number') {
                  this.notifyPeerCount(payload.count);
                }
                break;
              }

              case 'TRACKER_POSITION_UPDATE': {
                this.handleIncomingFleetPacket(payload);
                break;
              }

              case 'TRACKER_BATCH_BACKFILL': {
                if (payload && Array.isArray(payload.points) && payload.points.length > 0) {
                  this.handleIncomingBatchBackfill(payload);
                }
                break;
              }

              case 'MARKS_UPDATED': {
                if (Array.isArray(payload)) {
                  this.remoteMarksCallbacks.forEach((cb) => cb(payload));
                }
                break;
              }

              case 'RACE_STATE_UPDATED': {
                if (payload) {
                  this.remoteRaceStateCallbacks.forEach((cb) => cb(payload));
                }
                break;
              }

              case 'BOATS_UPDATED': {
                if (Array.isArray(payload)) {
                  this.remoteBoatsCallbacks.forEach((cb) => cb(payload));
                }
                break;
              }

              case 'SERIES_RACES_UPDATED': {
                if (Array.isArray(payload)) {
                  this.remoteSeriesRacesCallbacks.forEach((cb) => cb(payload));
                }
                break;
              }

              case 'VHF_NOTICE_BROADCAST': {
                if (payload) {
                  this.remoteVhfCallbacks.forEach((cb) => cb(payload));
                }
                break;
              }

              case 'PACKAGES_UPDATED': {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('packages-updated', { detail: payload }));
                }
                break;
              }

              case 'FLEET_SYNC': {
                if (Array.isArray(payload)) {
                  this.remoteMembers.clear();
                  payload.forEach((t: any) => this.handleIncomingFleetPacket(t));
                }
                break;
              }

              case 'TRACKERS_CLEARED': {
                this.remoteMembers.clear();
                this.notifyFleet();
                break;
              }

              case 'SERVER_MQTT_STATUS': {
                if (payload) {
                  meshtasticService.handleServerMqttStatus(payload);
                }
                break;
              }

              default:
                break;
            }
          } catch (err) {
            console.error('Error parsing WS message:', err);
          }
        };

        socket.onclose = () => {
          this.wsConnected = false;
          this.ws = null;
          // Batches the server never confirmed go back in the queue for the next connection
          this.requeuePendingBatches();
          if (this.pingTimer) clearInterval(this.pingTimer);
          // Auto reconnect after 2 seconds
          if (!this.wsReconnectTimer) {
            this.wsReconnectTimer = setTimeout(() => {
              this.wsReconnectTimer = null;
              connect();
            }, 2500);
          }
        };

        socket.onerror = (e) => {
          console.warn('TMTRAC WebSocket notice:', e);
        };
      } catch (err) {
        console.warn('TMTRAC WebSocket connect error:', err);
      }
    };

    connect();

    // Signing in or out after the page loaded must reach the server, or the room keeps treating
    // this device as the old identity (e.g. an owner who signed in would have edits rejected).
    authService.onAuthChange(() => {
      const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('tmtrac_auth_token_v1') || '') : '';
      if (token === this.wsToken) return;
      const old = this.ws;
      if (old) {
        old.onclose = null;
        old.close();
        this.ws = null;
        this.wsConnected = false;
        this.requeuePendingBatches();
        if (this.pingTimer) clearInterval(this.pingTimer);
      }
      if (this.wsReconnectTimer) {
        clearTimeout(this.wsReconnectTimer);
        this.wsReconnectTimer = null;
      }
      connect();
    });
  }

  // Broadcast helper to Server WebSocket (returns boolean for Store-and-Forward offline detection)
  private sendWs(type: string, payload: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type, payload }));
        return true;
      } catch (e) {
        console.warn('WS send error:', e);
        return false;
      }
    }
    return false;
  }

  // Switch the real-time session to another regatta room
  public switchRoom(roomCode: string, pin?: string) {
    const effectivePin = pin ?? (roomCode === roomService.getActiveRoomCode() ? roomService.getActiveRoomPin() : '');
    if (roomCode !== this.joinedRoomCode) {
      this.remoteMembers.clear();
      this.notifyFleet();
    }
    this.joinedRoomCode = roomCode;
    this.joinedRoomPin = effectivePin;
    this.sendWs('JOIN_ROOM', { roomCode, pin: effectivePin });
  }

  // HTTP fallback for room edits when the socket is down; carries room, PIN and login like the socket does
  private postSessionUpdate(endpoint: string, body: unknown) {
    try {
      const room = roomService.getActiveRoomCode();
      const pin = roomService.getActiveRoomPin();
      const headers: Record<string, string> = { ...authService.getAuthHeaders(), 'x-regatta-room': room };
      if (pin) headers['x-admin-pin'] = pin;
      fetch(`${endpoint}?room=${encodeURIComponent(room)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
        .then((res) => {
          if (!res.ok) console.warn(`Room update ${endpoint} rejected by server (HTTP ${res.status})`);
        })
        .catch(() => {});
    } catch (e) {}
  }

  // Broadcast a connected Bluetooth / USB / LoRa hardware node to the server so other users see it publicly
  public broadcastHardwareNode(node: MeshtasticNode) {
    if (!node || typeof node.lat !== 'number' || typeof node.lng !== 'number' || node.lat === 0 || node.lng === 0) return;
    const modelStr = (node.hardwareModel || '').toLowerCase();
    const devType: TrackerDeviceType = modelStr.includes('heltec')
      ? 'LORA_HELTEC'
      : modelStr.includes('rak')
      ? 'LORA_RAK'
      : modelStr.includes('mqtt')
      ? 'CUSTOM_MQTT'
      : 'LORA_TECHO';

    const payload: HybridFleetMember = {
      deviceId: node.id,
      deviceName: node.longName || node.shortName || node.id,
      deviceType: devType,
      role: (node.deviceRole as any) || 'COMPETITOR',
      boundBoatId: node.boundBoatId || null,
      color: '#00FF9D',
      lat: node.lat,
      lng: node.lng,
      accuracy: 3,
      speedKt: node.speedKt || 0,
      headingDeg: node.headingDeg || 0,
      altitudeMeters: node.altitudeMeters || 0,
      battery: node.battery || 85,
      timestamp: Date.now(),
      isLocalUser: false,
      trail: node.trail || [{ lat: node.lat, lng: node.lng }],
    };
    this.sendWs('GPS_BROADCAST', payload);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'FLEET_GPS_BROADCAST', payload });
      } catch (e) {}
    }
  }

  // Synchronize Mark Updates across all connected phones & server
  public broadcastMarks(marks: CourseMark[]) {
    const sent = this.sendWs('UPDATE_MARKS', marks);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'MARKS_UPDATED', payload: marks });
      } catch (e) {}
    }
    if (!sent) this.postSessionUpdate('/api/session/marks', marks);
  }

  // Synchronize Race State & Start Countdown across all phones
  public broadcastRaceState(raceState: Partial<RaceState>) {
    const sent = this.sendWs('UPDATE_RACE_STATE', raceState);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'RACE_STATE_UPDATED', payload: raceState });
      } catch (e) {}
    }
    if (!sent) this.postSessionUpdate('/api/session/racestate', raceState);
  }

  // Synchronize Fleet Boats across all phones
  public broadcastBoats(boats: Boat[]) {
    const sent = this.sendWs('UPDATE_BOATS', boats);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'BOATS_UPDATED', payload: boats });
      } catch (e) {}
    }
    if (!sent) this.postSessionUpdate('/api/session/boats', boats);
  }

  // Synchronize Official Scoring Series Races across all connected devices in room
  public broadcastSeriesRaces(seriesRaces: CompletedRace[]) {
    const sent = this.sendWs('UPDATE_SERIES_RACES', seriesRaces);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'SERIES_RACES_UPDATED', payload: seriesRaces });
      } catch (e) {}
    }
    if (!sent) this.postSessionUpdate('/api/session/series', seriesRaces);
  }

  // Synchronize VHF Bulletins across all phones
  public broadcastVhf(bulletin: VhfBulletin) {
    this.sendWs('SEND_VHF_NOTICE', bulletin);
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'VHF_NOTICE_BROADCAST', payload: bulletin });
      } catch (e) {}
    }
  }

  // Battery status API
  private async initBatteryReporting() {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).getBattery) {
        const battery = await (navigator as any).getBattery();
        this.batteryLevel = Math.round(battery.level * 100);
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = Math.round(battery.level * 100);
          this.currentGpsState.batteryLevel = this.batteryLevel;
          this.notifyGps();
        });
      }
    } catch (e) {
      this.batteryLevel = 90;
    }
  }

  // Cross-tab / Cross-window broadcast channel
  private initBroadcastChannel() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.broadcastChannel = new BroadcastChannel('tmtrac_hybrid_fleet_channel');
      this.broadcastChannel.onmessage = (evt) => {
        if (!evt || !evt.data) return;
        const { type, payload } = evt.data;
        if (type === 'FLEET_GPS_BROADCAST') {
          this.handleIncomingFleetPacket(payload);
        } else if (type === 'FLEET_GPS_BATCH_BACKFILL' && payload) {
          this.handleIncomingBatchBackfill(payload);
        } else if (type === 'MARKS_UPDATED' && Array.isArray(payload)) {
          this.remoteMarksCallbacks.forEach((cb) => cb(payload));
        } else if (type === 'BOATS_UPDATED' && Array.isArray(payload)) {
          this.remoteBoatsCallbacks.forEach((cb) => cb(payload));
        } else if (type === 'SERIES_RACES_UPDATED' && Array.isArray(payload)) {
          this.remoteSeriesRacesCallbacks.forEach((cb) => cb(payload));
        } else if (type === 'RACE_STATE_UPDATED' && payload) {
          this.remoteRaceStateCallbacks.forEach((cb) => cb(payload));
        } else if (type === 'VHF_NOTICE_BROADCAST' && payload) {
          this.remoteVhfCallbacks.forEach((cb) => cb(payload));
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  // Handle packet received from another phone/tablet/PC
  private handleIncomingFleetPacket(payload: any) {
    if (!payload || !payload.deviceId || payload.deviceId === this.profile.deviceId) return;
    if (typeof payload.lat !== 'number' || typeof payload.lng !== 'number') return;
    if (isNaN(payload.lat) || isNaN(payload.lng) || payload.lat === 0) return;

    const existing = this.remoteMembers.get(payload.deviceId);
    const trail = existing ? [...existing.trail, { lat: payload.lat, lng: payload.lng }].slice(-100) : [{ lat: payload.lat, lng: payload.lng }];

    const member: HybridFleetMember = {
      deviceId: payload.deviceId,
      deviceName: payload.deviceName || `Device ${payload.deviceId.slice(-4)}`,
      deviceType: payload.deviceType || 'PHONE',
      role: payload.role || 'COMPETITOR',
      lat: payload.lat,
      lng: payload.lng,
      accuracy: payload.accuracy || 10,
      speedKt: typeof payload.speedKt === 'number' ? payload.speedKt : 0,
      headingDeg: typeof payload.headingDeg === 'number' ? payload.headingDeg : 0,
      altitudeMeters: payload.altitudeMeters,
      battery: payload.battery || 85,
      timestamp: payload.timestamp || Date.now(),
      isLocalUser: false,
      boundBoatId: payload.boundBoatId || null,
      color: payload.color || '#00D4FF',
      trail,
    };

    this.remoteMembers.set(member.deviceId, member);
    this.notifyFleet();

    // Map this remote visitor device to a unified MeshtasticNode using canonical deduplicated ID
    const remoteNode: MeshtasticNode = this.convertMemberToNode(member);

    this.remoteNodeCallbacks.forEach((cb) => cb(remoteNode));
  }

  // Handle batch of historical backfilled points received from a reconnected tracker or LoRa node
  private handleIncomingBatchBackfill(payload: GpsBatchBackfillPayload) {
    if (!payload || !payload.deviceId || !Array.isArray(payload.points) || payload.points.length === 0) return;

    const existing = this.remoteMembers.get(payload.deviceId);
    const existingTrail = existing ? existing.trail : [];
    const newCoords = payload.points.map((p) => ({ lat: p.lat, lng: p.lng }));
    const mergedTrail = [...existingTrail, ...newCoords].slice(-2000);
    const lastPoint = payload.points[payload.points.length - 1];

    if (existing) {
      existing.lat = lastPoint.lat;
      existing.lng = lastPoint.lng;
      if (typeof lastPoint.speedKt === 'number') existing.speedKt = lastPoint.speedKt;
      if (typeof lastPoint.headingDeg === 'number') existing.headingDeg = lastPoint.headingDeg;
      existing.timestamp = lastPoint.timestamp || Date.now();
      existing.trail = mergedTrail;
      this.remoteMembers.set(payload.deviceId, existing);
      this.notifyFleet();
      const node = this.convertMemberToNode(existing);
      this.remoteNodeCallbacks.forEach((cb) => cb(node));
    }

    // Notify any subscribers (such as App.tsx course progress replay engine)
    this.batchBackfillCallbacks.forEach((cb) => cb(payload));
  }

  // Update profile
  public updateProfile(updates: Partial<DeviceTrackerProfile>) {
    this.profile = { ...this.profile, ...updates };
    this.currentGpsState.profile = this.profile;

    if (typeof window !== 'undefined') {
      try {
        if (updates.deviceName) localStorage.setItem('tmtrac_tracker_name', updates.deviceName);
        if (updates.role) localStorage.setItem('tmtrac_tracker_role', updates.role);
        if (updates.color) localStorage.setItem('tmtrac_tracker_color', updates.color);
      } catch (e) {}
    }

    this.notifyGps();
    if (this.currentGpsState.active && this.currentGpsState.lat && this.currentGpsState.lng) {
      this.broadcastCurrentLocation();
    }
  }

  // Start watching native Geolocation & Magnetometer Compass
  private static readonly GPS_OPT_IN_KEY = 'tmtrac_gps_sharing_opt_in';

  private static hasGpsOptIn(): boolean {
    try {
      return localStorage.getItem(HybridDeviceTrackerService.GPS_OPT_IN_KEY) === '1';
    } catch {
      return false;
    }
  }

  /** The person chose to share this device's location. Remembered so a reload resumes it. */
  public startSharingByUser(): Promise<boolean> {
    try {
      localStorage.setItem(HybridDeviceTrackerService.GPS_OPT_IN_KEY, '1');
    } catch {}
    return this.startGpsTracking();
  }

  /** The person stopped sharing this device's location. */
  public stopSharingByUser() {
    try {
      localStorage.removeItem(HybridDeviceTrackerService.GPS_OPT_IN_KEY);
    } catch {}
    this.stopGpsTracking();
  }

  public startGpsTracking(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('geolocation' in navigator)) {
        this.currentGpsState.error = 'Geolocation API not supported on this device/browser.';
        this.notifyGps();
        resolve(false);
        return;
      }

      this.stopGpsTracking();

      this.currentGpsState.active = true;
      this.currentGpsState.error = null;
      this.notifyGps();

      // Start compass orientation sensor listener
      this.startCompassListener();

      // Start periodic position broadcasting timer
      this.startBroadcastTimer();

      this.gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy || 5);
          const altitudeMeters = pos.coords.altitude ? Math.round(pos.coords.altitude) : null;
          let speedKt = pos.coords.speed !== null && pos.coords.speed !== undefined ? pos.coords.speed * 1.94384 : null;
          let headingDeg = pos.coords.heading !== null && pos.coords.heading !== undefined && !isNaN(pos.coords.heading) ? Math.round(pos.coords.heading) : null;

          // If GPS heading is unavailable or vessel is nearly stationary, use magnetometer compass heading
          if (headingDeg === null && this.compassHeadingDeg !== null) {
            headingDeg = this.compassHeadingDeg;
          }

          // Use GNSS satellite hardware atomic clock time if reported by receiver
          const now = (pos.timestamp && pos.timestamp > 1000000000) ? pos.timestamp : Date.now();
          if (this.prevCoords && (!speedKt || headingDeg === null)) {
            const dtSec = (now - this.prevCoords.time) / 1000;
            if (dtSec >= 1 && dtSec <= 30) {
              const dLat = (lat - this.prevCoords.lat) * (Math.PI / 180);
              const dLng = (lng - this.prevCoords.lng) * (Math.PI / 180);
              const r = 6371000; // meters
              const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.prevCoords.lat * (Math.PI / 180)) *
                  Math.cos(lat * (Math.PI / 180)) *
                  Math.sin(dLng / 2) *
                  Math.sin(dLng / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const distMeters = r * c;

              if (speedKt === null) {
                const calcSpeedMps = distMeters / dtSec;
                speedKt = parseFloat((calcSpeedMps * 1.94384).toFixed(1));
              }

              if (headingDeg === null && distMeters > 3) {
                const y = Math.sin(dLng) * Math.cos(lat * (Math.PI / 180));
                const x =
                  Math.cos(this.prevCoords.lat * (Math.PI / 180)) * Math.sin(lat * (Math.PI / 180)) -
                  Math.sin(this.prevCoords.lat * (Math.PI / 180)) * Math.cos(lat * (Math.PI / 180)) * Math.cos(dLng);
                const brng = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
                headingDeg = Math.round(brng);
              }
            }
          }

          if (headingDeg === null && this.compassHeadingDeg !== null) {
            headingDeg = this.compassHeadingDeg;
          }

          this.prevCoords = { lat, lng, time: now };

          this.currentGpsState = {
            active: true,
            lat,
            lng,
            accuracy,
            speedKt: speedKt !== null ? parseFloat(speedKt.toFixed(1)) : 0,
            headingDeg: headingDeg !== null ? headingDeg : 0,
            altitudeMeters,
            batteryLevel: this.batteryLevel,
            timestamp: now,
            error: null,
            isSharing: this.profile.isBroadcasting,
            packetsSent: this.currentGpsState.packetsSent,
            profile: this.profile,
          };

          this.notifyGps();
          this.broadcastCurrentLocation();
          resolve(true);
        },
        (err) => {
          let errorMsg = 'Failed to acquire device GPS position.';
          if (err.code === err.PERMISSION_DENIED) {
            errorMsg = 'Location permission denied. Please allow location access in your browser.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            errorMsg = 'Device GPS position unavailable. Check device GPS settings.';
          } else if (err.code === err.TIMEOUT) {
            errorMsg = 'GPS acquisition timed out. Retrying...';
          }
          this.currentGpsState.error = errorMsg;
          this.notifyGps();
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 20000,
        }
      );
    });
  }

  // Start mobile device magnetic/true compass listener
  private startCompassListener() {
    if (typeof window === 'undefined') return;

    const handleOrientation = (event: any) => {
      // iOS Safari provides webkitCompassHeading (0-359.9 deg)
      if (typeof event.webkitCompassHeading === 'number' && !isNaN(event.webkitCompassHeading)) {
        this.compassHeadingDeg = Math.round(event.webkitCompassHeading);
      } else if (typeof event.alpha === 'number' && !isNaN(event.alpha)) {
        // Android DeviceOrientation absolute
        let heading = (360 - event.alpha) % 360;
        if (typeof (window as any).orientation === 'number') {
          heading = (heading + (window as any).orientation + 360) % 360;
        }
        this.compassHeadingDeg = Math.round(heading);
      }

      // If active and nearly stationary, update headingDeg immediately
      if (this.currentGpsState.active && this.compassHeadingDeg !== null && (this.currentGpsState.speedKt || 0) < 1.0) {
        this.currentGpsState.headingDeg = this.compassHeadingDeg;
      }
    };

    try {
      if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
        (DeviceOrientationEvent as any).requestPermission().then((res: string) => {
          if (res === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
            this.orientationListener = handleOrientation;
          }
        }).catch(() => {
          window.addEventListener('deviceorientation', handleOrientation, true);
          this.orientationListener = handleOrientation;
        });
      } else {
        if (typeof window !== 'undefined' && 'ondeviceorientationabsolute' in window) {
          (window as any).addEventListener('deviceorientationabsolute', handleOrientation, true);
        } else if (typeof window !== 'undefined') {
          (window as any).addEventListener('deviceorientation', handleOrientation, true);
        }
        this.orientationListener = handleOrientation;
      }
    } catch (e) {
      console.warn('Compass listener registration:', e);
    }
  }

  private stopCompassListener() {
    if (typeof window !== 'undefined' && this.orientationListener) {
      try {
        window.removeEventListener('deviceorientation', this.orientationListener, true);
        window.removeEventListener('deviceorientationabsolute', this.orientationListener, true);
      } catch (e) {}
      this.orientationListener = null;
    }
  }

  // Stop watching GPS
  public stopGpsTracking() {
    if (this.gpsWatchId !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }
    this.stopCompassListener();
    if (this.broadcastIntervalTimer) {
      clearInterval(this.broadcastIntervalTimer);
      this.broadcastIntervalTimer = null;
    }
    this.currentGpsState.active = false;
    this.currentGpsState.lat = undefined;
    this.currentGpsState.lng = undefined;
    this.currentGpsState.speedKt = undefined;
    this.currentGpsState.headingDeg = undefined;
    this.currentGpsState.accuracy = undefined;
    
    // Announce to server/peers that this local tracker is stopped/offline
    this.sendWs('DEVICE_STOPPED', { deviceId: this.profile.deviceId });
    this.notifyGps();
  }

  // Start periodic broadcast loop
  private startBroadcastTimer() {
    if (this.broadcastIntervalTimer) {
      clearInterval(this.broadcastIntervalTimer);
    }
    const intervalMs = Math.max(1000, (this.profile.updateIntervalSec || 2) * 1000);
    this.broadcastIntervalTimer = setInterval(() => {
      if (this.currentGpsState.active && this.currentGpsState.lat && this.currentGpsState.lng) {
        this.broadcastCurrentLocation();
      }
    }, intervalMs);
  }

  // Broadcast current location to all other visitors on the network
  public broadcastCurrentLocation() {
    if (!this.profile.isBroadcasting) return;
    if (!this.currentGpsState.lat || !this.currentGpsState.lng) return;

    const pointTimestamp = this.currentGpsState.timestamp || Date.now();
    const payload = {
      deviceId: this.profile.deviceId,
      deviceName: this.profile.deviceName,
      deviceType: this.profile.deviceType,
      role: this.profile.role,
      boundBoatId: this.profile.boundBoatId,
      sailNumber: this.profile.sailNumber,
      color: this.profile.color,
      lat: this.currentGpsState.lat,
      lng: this.currentGpsState.lng,
      accuracy: this.currentGpsState.accuracy || 5,
      speedKt: this.currentGpsState.speedKt || 0,
      headingDeg: this.currentGpsState.headingDeg || 0,
      altitudeMeters: this.currentGpsState.altitudeMeters || 10,
      battery: this.batteryLevel || 90,
      timestamp: pointTimestamp,
    };

    const backfillPoint: BackfillPoint = {
      lat: this.currentGpsState.lat,
      lng: this.currentGpsState.lng,
      speedKt: this.currentGpsState.speedKt || 0,
      headingDeg: this.currentGpsState.headingDeg || 0,
      altitudeMeters: this.currentGpsState.altitudeMeters || 10,
      accuracy: this.currentGpsState.accuracy || 5,
      timestamp: pointTimestamp,
    };

    // 1. Broadcast over WebSocket to Server
    const sent = this.sendWs('GPS_BROADCAST', payload);
    if (!sent) {
      // Offline / network loss: Queue point in FIFO buffer for Store-and-Forward synchronization
      this.offlinePointsBuffer.push(backfillPoint);
      if (this.offlinePointsBuffer.length > 5000) {
        this.offlinePointsBuffer.shift();
      }
      this.persistOfflineBuffer();
    }

    // 2. Broadcast over local BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'FLEET_GPS_BROADCAST',
          payload,
        });
      } catch (e) {}
    }

    this.currentGpsState.packetsSent += 1;
    this.profile.packetsTransmitted += 1;
    this.profile.lastBroadcastTime = Date.now();
  }

  // Clear all remote fleet devices
  public clearRemoteMembers() {
    this.remoteMembers.clear();
    this.notifyFleet();
  }
}

export const deviceTrackerService = new HybridDeviceTrackerService();
