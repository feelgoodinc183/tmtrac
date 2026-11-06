import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import {
  db,
  initDatabase,
  hashPassword,
  generateToken,
  generateAdminPin,
  generateParticipantPin,
  insertAuditLog,
  PLAN_CONFIG,
  getAllPackages,
  updatePackage,
  createPackage,
  deletePackage,
  getDatabaseStats,
  importDatabaseJson,
  syncStoreJson,
  getComprehensiveDiagnostics,
  repairDatabase,
  dbDiagnosticsState,
} from './src/server/db';
import {
  serverGateMiddleware,
  requireAuth,
  requireTenantAdmin,
  requireSuperAdmin,
  enforcePlanQuota,
  extractPlatform,
  extractRequestToken,
} from './src/server/gate';
import { createSession, endSession, endAllSessionsForUser, findActiveUserByToken } from './src/server/sessions';
import { PlanTier } from './src/types/regatta';
import { registerStripeRoutes } from './src/server/stripe';
import { MAX_RACE_CLASSES, StoredRaceClass, parseStoredRaceClasses, sanitizeRaceClasses } from './src/server/raceClasses';
import { SKIPPER_BIND_MESSAGES, decideSkipperBinding } from './src/server/skipperBinding';
import mqtt from 'mqtt';
import { canonicalNodeId, nodeNumFromId, sameNodeId } from './src/utils/nodeId';
import {
  DEFAULT_ROOM_MQTT_CONFIG,
  MeshtasticMqttBridge,
  RoomMqttConfig,
  mergeRoomMqttConfig,
  toPublicConfig,
} from './src/server/mqttBridge';

const isDevMode = process.env.NODE_ENV !== 'production';

// Initialize SQLite database and run migrations/seeds
initDatabase();

// Default Race State template
const DEFAULT_RACE_STATE = {
  name: 'Regatta Race',
  locationName: 'Coastal Waters',
  status: 'PRE_START',
  countdownSeconds: 300,
  activeClass: 'Class 1',
  startSequenceActive: false,
  telemetryRate: 'HIGH_FREQUENCY',
  mqttBridgeMode: 'CELLULAR',
  mqttConnected: false,
  airtimePercent: 0,
  windSpeedKt: 12.0,
  windDirectionDeg: 210,
  deadReckoningEnabled: true,
  offlineCacheActive: true,
  syncProgress: 100,
  pendingSyncBuffer: 0,
};

// Active in-memory room state for real-time WebSocket broadcast performance
export interface ActiveRoomState {
  id: string;
  tenantId: string;
  tenantName: string;
  code: string;
  title: string;
  locationName: string;
  adminPin: string;
  participantPin: string;
  isPublic: boolean;
  ownerId: string;
  ownerEmail?: string;
  ownerName?: string;
  createdAt: number;
  lastActive: number;
  raceState: typeof DEFAULT_RACE_STATE;
  marks: any[];
  boats: any[];
  /** null until the race office sets classes for this room; clients then show the defaults */
  raceClasses: StoredRaceClass[] | null;
  trackers: Map<string, any>;
  vhfBulletins: any[];
  seriesRaces: any[];
  /** Meshtastic MQTT bridge settings, with secrets. Server-side only. */
  mqttConfig: RoomMqttConfig;
}

function parseRoomMqttConfig(raw: string | null | undefined): RoomMqttConfig {
  if (!raw) return { ...DEFAULT_ROOM_MQTT_CONFIG };
  try {
    const v = JSON.parse(raw);
    const str = (x: unknown, fallback: string) => (typeof x === 'string' ? x : fallback);
    const channels = Array.isArray(v?.channels)
      ? v.channels
          .filter((c: any) => c && typeof c.name === 'string' && typeof c.psk === 'string')
          .map((c: any) => ({ name: c.name, psk: c.psk }))
      : DEFAULT_ROOM_MQTT_CONFIG.channels;
    return {
      enabled: v?.enabled === true,
      brokerUrl: str(v?.brokerUrl, ''),
      username: str(v?.username, ''),
      password: str(v?.password, ''),
      rootTopic: str(v?.rootTopic, DEFAULT_ROOM_MQTT_CONFIG.rootTopic),
      channels,
    };
  } catch {
    return { ...DEFAULT_ROOM_MQTT_CONFIG };
  }
}

// Called when a room is loaded so the MQTT bridge knows its settings (set once the bridge exists)
let onRoomLoaded: (room: ActiveRoomState) => void = () => {};

const activeRooms = new Map<string, ActiveRoomState>();

/**
 * Loads an event from SQLite into the activeRooms memory map, or creates a default record
 */
function getOrLoadRoom(rawCode: string, autoCreate: boolean = true): ActiveRoomState | null {
  const code = (rawCode || 'RLIR26').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'RLIR26';
  let room = activeRooms.get(code);
  if (room) {
    return room;
  }

  // Look up in SQLite
  const row = db.prepare(`
    SELECT e.*, t.name as tenant_name, u.email as owner_email, u.full_name as owner_name
    FROM events e
    LEFT JOIN tenants t ON e.tenant_id = t.id
    LEFT JOIN users u ON e.owner_id = u.id
    WHERE e.code = ?
  `).get(code) as any;

  if (row) {
    let raceState = { ...DEFAULT_RACE_STATE, name: row.title, locationName: row.location_name };
    let marks: any[] = [];
    let boats: any[] = [];
    let vhfBulletins: any[] = [];
    let seriesRaces: any[] = [];

    try {
      if (row.race_state_json) raceState = { ...DEFAULT_RACE_STATE, ...JSON.parse(row.race_state_json) };
      if (row.marks_json) marks = JSON.parse(row.marks_json);
      if (row.boats_json) boats = JSON.parse(row.boats_json);
      if (row.vhf_bulletins_json) vhfBulletins = JSON.parse(row.vhf_bulletins_json);
      if (row.series_races_json) seriesRaces = JSON.parse(row.series_races_json);
    } catch (e) {}

    room = {
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name || 'Organization',
      code: row.code,
      title: row.title,
      locationName: row.location_name,
      adminPin: row.admin_pin,
      participantPin: row.participant_pin || '',
      isPublic: !!row.is_public,
      ownerId: row.owner_id,
      ownerEmail: row.owner_email,
      ownerName: row.owner_name,
      createdAt: row.created_at || Date.now(),
      lastActive: Date.now(),
      raceState,
      marks,
      boats,
      raceClasses: parseStoredRaceClasses(row.race_classes_json),
      trackers: new Map(),
      vhfBulletins,
      seriesRaces,
      mqttConfig: parseRoomMqttConfig(row.mqtt_config_json),
    };
    activeRooms.set(code, room);
    onRoomLoaded(room);
    return room;
  }

  // If not in DB and autoCreate is disabled, reject invalid room code
  if (!autoCreate) {
    return null;
  }

  // Ephemeral fallback (e.g. for initial testing if no DB match yet)
  const fallbackTenant = (db.prepare(`SELECT id, name FROM tenants ORDER BY (id = 'tenant-rlyc-default') DESC, created_at ASC LIMIT 1`).get() as any) || { id: 'tenant-rlyc-default', name: 'Royal Langkawi Yacht Club (RLYC)' };
  room = {
    id: `event-${code.toLowerCase()}`,
    tenantId: fallbackTenant.id,
    tenantName: fallbackTenant.name,
    code,
    title: `${code} Regatta`,
    locationName: 'Coastal Waters',
    adminPin: generateAdminPin(),
    participantPin: generateParticipantPin(),
    isPublic: true,
    ownerId: 'user-admin-0',
    createdAt: Date.now(),
    lastActive: Date.now(),
    raceState: { ...DEFAULT_RACE_STATE, name: `${code} Regatta` },
    marks: [],
    boats: [],
    raceClasses: null,
    trackers: new Map(),
    vhfBulletins: [],
    seriesRaces: [],
    mqttConfig: { ...DEFAULT_ROOM_MQTT_CONFIG },
  };
  activeRooms.set(code, room);
  onRoomLoaded(room);
  return room;
}

function persistRoomMqttConfig(room: ActiveRoomState) {
  try {
    db.prepare('UPDATE events SET mqtt_config_json = ? WHERE code = ?').run(JSON.stringify(room.mqttConfig), room.code);
  } catch (e) {
    console.warn(`Failed to persist MQTT settings for room ${room.code}:`, e);
  }
}

/**
 * Persist room state to SQLite
 */
function persistRoom(room: ActiveRoomState) {
  try {
    const stmt = db.prepare(`
      UPDATE events SET
        title = ?,
        location_name = ?,
        admin_pin = ?,
        participant_pin = ?,
        is_public = ?,
        status = ?,
        race_state_json = ?,
        marks_json = ?,
        boats_json = ?,
        race_classes_json = ?,
        vhf_bulletins_json = ?,
        series_races_json = ?,
        last_active = ?
      WHERE code = ?
    `);

    stmt.run(
      room.title,
      room.locationName,
      room.adminPin,
      room.participantPin,
      room.isPublic ? 1 : 0,
      room.raceState?.status || 'PRE_START',
      JSON.stringify(room.raceState),
      JSON.stringify(room.marks),
      JSON.stringify(room.boats),
      room.raceClasses ? JSON.stringify(room.raceClasses) : null,
      JSON.stringify(room.vhfBulletins),
      JSON.stringify(room.seriesRaces),
      Date.now(),
      room.code
    );
  } catch (e) {
    console.warn(`Failed to persist room ${room.code} to SQLite:`, e);
  }
}

export type RoomRole = 'ADMIN' | 'RACE_OFFICER' | 'PARTICIPANT' | 'SPECTATOR';

export interface RoomRoleUser {
  id: string;
  role: string;
  tenantId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Single source of truth for what a user/PIN may do inside one room.
 * Account roles only apply inside the user's own organization; PINs apply to the room they belong to.
 */
export function resolveRoomRole(user: RoomRoleUser | null, room: ActiveRoomState, pin?: string): RoomRole {
  const cleanPin = (pin || '').trim();
  const sameTenant = !!user && !!user.tenantId && user.tenantId === room.tenantId;

  if (user && (user.isSuperAdmin || user.id === room.ownerId)) return 'ADMIN';
  if (user && user.role === 'ADMIN' && sameTenant) return 'ADMIN';
  if (cleanPin && room.adminPin && cleanPin === room.adminPin) return 'ADMIN';
  if (user && user.role === 'RACE_OFFICER' && sameTenant) return 'RACE_OFFICER';
  if (cleanPin && room.participantPin && cleanPin === room.participantPin) return 'PARTICIPANT';
  if (user && (user.role === 'PARTICIPANT' || user.role === 'SKIPPER')) return 'PARTICIPANT';
  return 'SPECTATOR';
}

function roomRoleUserFromRow(row: any): RoomRoleUser | null {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    tenantId: row.tenant_id || null,
    isSuperAdmin: !!row.is_super_admin,
  };
}

function roomRoleUserFromGate(req: express.Request): RoomRoleUser | null {
  const user = req.gate?.user;
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    tenantId: user.tenantId || null,
    isSuperAdmin: !!(req.gate?.isSuperAdmin || req.gate?.isUniversalAdmin || user.isSuperAdmin),
  };
}

function canEditRoom(role: RoomRole): boolean {
  return role === 'ADMIN' || role === 'RACE_OFFICER';
}

// --- Wrong-PIN limiter: room PINs are short, so cap guesses per client and room ---
const PIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const PIN_MAX_FAILURES = 10;
const pinFailures = new Map<string, { count: number; firstAt: number }>();

export function clientAddress(headers: http.IncomingHttpHeaders, socketAddress?: string): string {
  const forwarded = headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
  return first || socketAddress || 'unknown';
}

export function isPinLocked(client: string, roomCode: string): boolean {
  const entry = pinFailures.get(`${client}|${roomCode}`);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > PIN_FAILURE_WINDOW_MS) {
    pinFailures.delete(`${client}|${roomCode}`);
    return false;
  }
  return entry.count >= PIN_MAX_FAILURES;
}

/**
 * Returns the PIN to evaluate for this room, or '' when the client is locked out.
 * Records whether a non-empty PIN matched either of the room's PINs.
 */
export function checkedPin(client: string, room: ActiveRoomState, pin?: string): string {
  const cleanPin = (pin || '').trim();
  if (!cleanPin) return '';
  if (isPinLocked(client, room.code)) return '';
  const key = `${client}|${room.code}`;
  if (cleanPin === room.adminPin || cleanPin === room.participantPin) {
    pinFailures.delete(key);
  } else {
    const entry = pinFailures.get(key);
    if (!entry || Date.now() - entry.firstAt > PIN_FAILURE_WINDOW_MS) {
      pinFailures.set(key, { count: 1, firstAt: Date.now() });
    } else {
      entry.count++;
      if (entry.count === PIN_MAX_FAILURES) {
        console.warn(`[PIN] ${PIN_MAX_FAILURES} wrong PINs for room ${room.code} from ${client}; ignoring PINs for 15 minutes`);
      }
    }
  }
  return cleanPin;
}

async function startServer() {
  const app = express();
  // Raw body parser for Stripe Webhook
  app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // CORS Middleware supporting ALLOWED_ORIGINS
  const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || 'https://tmtrac.my,https://www.tmtrac.my,https://tmrac.my';
  const allowedOrigins = rawAllowedOrigins.split(',').map((o) => o.trim()).filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      if (
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('tmtrac.my') ||
        origin.includes('localhost') ||
        origin.includes('run.app')
      ) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token, x-super-admin-token, x-admin-pin, x-regatta-room');
      }
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Health check endpoints for uptime monitoring and readiness probes
  app.get(['/api/health', '/healthz', '/api/ping'], (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
      mode: process.env.NODE_ENV || 'development',
    });
  });

  // Attach Server Gate on every single request
  app.use(serverGateMiddleware);

  const server = http.createServer(app);

  // WebSocket Server for Multi-Device Real-Time Sync
  const wss = new WebSocketServer({ server, path: '/ws' });

  function getRoomClientCount(roomCode: string): number {
    let count = 0;
    wss.clients.forEach((c) => {
      if ((c as any).roomCode === roomCode && c.readyState === WebSocket.OPEN) {
        count++;
      }
    });
    return Math.max(1, count);
  }

  function broadcastToRoom(roomCode: string, event: string, payload: any, senderWs?: WebSocket) {
    const message = JSON.stringify({ type: event, payload, roomCode, timestamp: Date.now() });
    wss.clients.forEach((client) => {
      if (client !== senderWs && (client as any).roomCode === roomCode && client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (e) {
          console.error('WS room broadcast error:', e);
        }
      }
    });
  }

  function broadcastAllInRoom(roomCode: string, event: string, payload: any) {
    const message = JSON.stringify({ type: event, payload, roomCode, timestamp: Date.now() });
    wss.clients.forEach((client) => {
      if ((client as any).roomCode === roomCode && client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (e) {
          console.error('WS room broadcastAll error:', e);
        }
      }
    });
  }

  function broadcastGlobal(event: string, payload: any) {
    const message = JSON.stringify({ type: event, payload, timestamp: Date.now() });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (e) {
          console.error('WS broadcastGlobal error:', e);
        }
      }
    });
  }

  // --- Meshtastic MQTT bridge ---
  // Runs a room's MQTT subscriptions only while the room has MQTT on and someone has it open.
  const mqttBridge = new MeshtasticMqttBridge({
    connect: (url, opts) => mqtt.connect(url, opts) as any,
    onNodeUpdate: (roomCode, update) => broadcastAllInRoom(roomCode, 'MQTT_NODE_UPDATE', update),
    onStatus: (roomCode, status) => broadcastAllInRoom(roomCode, 'MQTT_STATUS', status),
    allowAnyBroker: process.env.MQTT_ALLOW_ANY_BROKER === '1',
    maxConnections: Number(process.env.MQTT_MAX_BROKER_CONNECTIONS) || 10,
  });
  onRoomLoaded = (room) => mqttBridge.setRoomConfig(room.code, room.mqttConfig);
  for (const room of activeRooms.values()) onRoomLoaded(room);

  function openClientCount(roomCode: string): number {
    let count = 0;
    wss.clients.forEach((c) => {
      if ((c as any).roomCode === roomCode && c.readyState === WebSocket.OPEN) count++;
    });
    return count;
  }

  function refreshRoomActivity(roomCode: string) {
    mqttBridge.setRoomActive(roomCode, openClientCount(roomCode) > 0);
  }

  // LoRa trackers relayed by a phone: which socket is relaying each one ("room|nodeId"), so the
  // tracker goes offline when that socket closes and another socket can't take it over meanwhile.
  const relayOwners = new Map<string, WebSocket>();

  /**
   * Checks a relayed tracker position. Only a Meshtastic node already bound to a boat in the room
   * can be relayed, and only by one socket at a time; the boat comes from the room's binding, not
   * from the payload. Returns the bound boat id, or null to drop the message.
   */
  function acceptRelay(ws: WebSocket, room: ActiveRoomState, payload: any): string | null {
    if (nodeNumFromId(payload.deviceId) === null) return null;
    const deviceId = canonicalNodeId(payload.deviceId);
    const boat = Array.isArray(room.boats) ? room.boats.find((b: any) => sameNodeId(b.nodeId, deviceId)) : undefined;
    if (!boat) return null;
    const key = `${room.code}|${deviceId}`;
    const owner = relayOwners.get(key);
    if (owner && owner !== ws && owner.readyState === WebSocket.OPEN) return null;
    relayOwners.set(key, ws);
    const owned: Set<string> = ((ws as any).relayedKeys ||= new Set<string>());
    owned.add(key);
    payload.deviceId = deviceId;
    return boat.id;
  }

  /**
   * The boat in this room bound to a device sending its own positions, from the room's bindings
   * (never from the payload). A phone is bound under "!DEV-" + the last 4 letters/digits of its
   * deviceId (deviceTrackerService.getLocalNode); a LoRa tracker under its node id.
   */
  function boundBoatIdFor(room: ActiveRoomState, deviceId: unknown): string | null {
    if (typeof deviceId !== 'string' || !deviceId || !Array.isArray(room.boats)) return null;
    const phoneAlias = `!DEV-${deviceId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase()}`;
    const boat = room.boats.find((b: any) =>
      typeof b?.nodeId === 'string' && (b.nodeId === deviceId || b.nodeId === phoneAlias || sameNodeId(b.nodeId, deviceId)));
    return boat ? boat.id : null;
  }

  // Register Stripe Payment & Subscription Routes
  registerStripeRoutes(app, { broadcastGlobal });

  // --- WebSocket Connection Handling with Server Gate Scoping ---
  wss.on('connection', (ws: WebSocket, req) => {
    const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const initialRoomCode = (reqUrl.searchParams.get('room') || 'RLIR26').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'RLIR26';
    const token = reqUrl.searchParams.get('token') || '';
    const initialPin = reqUrl.searchParams.get('pin') || '';

    // Gate check via token in SQLite
    let authUser: any = null;
    if (token) {
      const userRow = findActiveUserByToken(token);
      if (userRow) {
        authUser = userRow;
      }
    }

    // Unknown codes fall back to LOBBY instead of spawning an unsaved room with the default PIN
    const room = getOrLoadRoom(initialRoomCode, false) || getOrLoadRoom('LOBBY', true)!;
    const roleUser = roomRoleUserFromRow(authUser);
    const clientKey = clientAddress(req.headers, req.socket.remoteAddress);
    const roomRole = resolveRoomRole(roleUser, room, checkedPin(clientKey, room, initialPin));

    (ws as any).id = 'sock-' + crypto.randomBytes(4).toString('hex');
    (ws as any).clientKey = clientKey;
    (ws as any).roomCode = room.code;
    (ws as any).roleUser = roleUser;
    (ws as any).userId = authUser?.id || null;
    (ws as any).userEmail = authUser?.email || null;
    (ws as any).userName = authUser?.full_name || null;
    (ws as any).userRole = roomRole;
    (ws as any).isAdmin = roomRole === 'ADMIN';
    (ws as any).tenantId = room.tenantId;
    (ws as any).tenantName = room.tenantName;
    (ws as any).connectedAt = Date.now();
    (ws as any).remoteAddress = req.socket.remoteAddress || req.headers['x-forwarded-for'] || '127.0.0.1';
    (ws as any).platform = (req.headers['x-device-platform'] || (req.headers['user-agent']?.includes('Android') ? 'ANDROID' : 'WEB'));

    room.lastActive = Date.now();

    // Send full current authoritative session state for this room on initial connection
    const trackerList = Array.from(room.trackers.values());
    const initState = {
      roomCode: room.code,
      title: room.title,
      locationName: room.locationName,
      tenantId: room.tenantId,
      tenantName: room.tenantName,
      isAdmin: (ws as any).isAdmin,
      canEdit: canEditRoom((ws as any).userRole),
      userRole: (ws as any).userRole,
      sessionId: `regatta-room-${room.code}`,
      connectedClients: getRoomClientCount(room.code),
      raceState: room.raceState,
      marks: room.marks,
      boats: room.boats,
      raceClasses: room.raceClasses,
      trackers: trackerList,
      vhfBulletins: room.vhfBulletins,
      seriesRaces: room.seriesRaces || [],
      mqttStatus: mqttBridge.getStatus(room.code),
      serverTime: Date.now(),
    };

    ws.send(JSON.stringify({ type: 'SESSION_INIT_STATE', payload: initState }));
    broadcastAllInRoom(room.code, 'PEER_COUNT_UPDATE', { count: getRoomClientCount(room.code) });
    refreshRoomActivity(room.code);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const { type, payload } = msg;
        const currentRoomCode = (ws as any).roomCode || 'RLIR26';
        const currentRoom = getOrLoadRoom(currentRoomCode);
        currentRoom.lastActive = Date.now();
        const role = (ws as any).userRole || 'SPECTATOR';
        const isAdminSession = (ws as any).isAdmin;
        // Tell the sender an edit was refused, so the app can say "not saved" instead of looking saved
        const rejectEdit = (action: string) => {
          console.warn(`[Server Gate] Blocked unauthorized ${action} by ${role} in room ${currentRoom.code}`);
          ws.send(JSON.stringify({
            type: 'UPDATE_REJECTED',
            payload: { action, roomCode: currentRoom.code, role, reason: 'NOT_ALLOWED' },
          }));
        };

        switch (type) {
          case 'JOIN_ROOM': {
            if (payload && payload.roomCode) {
              const oldCode = (ws as any).roomCode;
              const requestedCode = String(payload.roomCode).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
              const newRoom = getOrLoadRoom(requestedCode, false) || getOrLoadRoom('LOBBY', true)!;
              const newCode = newRoom.code;
              (ws as any).roomCode = newCode;

              // Re-derive the role for the new room; never carry admin over from the previous room
              const joinPin = checkedPin((ws as any).clientKey, newRoom, typeof payload.pin === 'string' ? payload.pin : '');
              const newRole = resolveRoomRole((ws as any).roleUser || null, newRoom, joinPin);
              const isNowAdmin = newRole === 'ADMIN';

              (ws as any).isAdmin = isNowAdmin;
              (ws as any).userRole = newRole;

              const newInitState = {
                roomCode: newRoom.code,
                title: newRoom.title,
                locationName: newRoom.locationName,
                tenantId: newRoom.tenantId,
                tenantName: newRoom.tenantName,
                isAdmin: isNowAdmin,
                canEdit: canEditRoom(newRole),
                userRole: (ws as any).userRole,
                sessionId: `regatta-room-${newRoom.code}`,
                connectedClients: getRoomClientCount(newRoom.code),
                raceState: newRoom.raceState,
                marks: newRoom.marks,
                boats: newRoom.boats,
                raceClasses: newRoom.raceClasses,
                trackers: Array.from(newRoom.trackers.values()),
                vhfBulletins: newRoom.vhfBulletins,
                seriesRaces: newRoom.seriesRaces || [],
                mqttStatus: mqttBridge.getStatus(newRoom.code),
                serverTime: Date.now(),
              };
              ws.send(JSON.stringify({ type: 'SESSION_INIT_STATE', payload: newInitState }));
              refreshRoomActivity(newCode);

              if (oldCode && oldCode !== newCode) {
                broadcastAllInRoom(oldCode, 'PEER_COUNT_UPDATE', { count: getRoomClientCount(oldCode) });
                refreshRoomActivity(oldCode);
              }
              broadcastAllInRoom(newCode, 'PEER_COUNT_UPDATE', { count: getRoomClientCount(newCode) });
            }
            break;
          }

          case 'VERIFY_PIN': {
            const pinAttempt = checkedPin((ws as any).clientKey, currentRoom, typeof payload?.pin === 'string' ? payload.pin : '');
            const isValidAdmin = !!pinAttempt && currentRoom.adminPin === pinAttempt;
            const isValidParticipant = !!pinAttempt && currentRoom.participantPin === pinAttempt;

            if (isValidAdmin) {
              (ws as any).isAdmin = true;
              (ws as any).userRole = 'ADMIN';
            } else if (isValidParticipant) {
              (ws as any).userRole = 'PARTICIPANT';
            }

            ws.send(JSON.stringify({
              type: 'PIN_VERIFICATION_RESULT',
              payload: {
                success: isValidAdmin || isValidParticipant,
                isAdmin: isValidAdmin,
                isParticipant: isValidParticipant,
                roomCode: currentRoom.code,
              },
            }));
            break;
          }

          // Telemetry Ingestion (Allowed for Admin or Participant transmitting own boat)
          case 'DEVICE_ANNOUNCE':
          case 'GPS_BROADCAST': {
            if (payload && payload.deviceId) {
              // Spectators are read-only and cannot inject fake positions
              if (role === 'SPECTATOR' && !isAdminSession) {
                console.warn(`[Server Gate] Ignored GPS_BROADCAST from unauthenticated spectator on room ${currentRoom.code}`);
                return;
              }

              // A phone relaying a LoRa tracker it's connected to sends `relayedBy`. That position
              // belongs to the tracker, not to this socket, so it must not take over the socket's
              // identity (which is what gets marked offline when the socket closes).
              if (payload.relayedBy) {
                const boundBoatId = acceptRelay(ws, currentRoom, payload);
                if (!boundBoatId) return;
                payload.boundBoatId = boundBoatId;
              } else {
                (ws as any).deviceId = payload.deviceId;
                // The boat comes from the room's binding; a claimed boundBoatId is ignored
                payload.boundBoatId = boundBoatIdFor(currentRoom, payload.deviceId);
              }
              const existing = currentRoom.trackers.get(payload.deviceId) || {};
              const updatedTracker = {
                ...existing,
                ...payload,
                lastSeen: payload.timestamp || Date.now(),
                isOnline: true,
              };
              currentRoom.trackers.set(payload.deviceId, updatedTracker);
              broadcastToRoom(currentRoom.code, 'TRACKER_POSITION_UPDATE', updatedTracker, ws);
            }
            break;
          }

          // Offline Store-and-Forward Replay (Android & Web)
          case 'GPS_BATCH_BACKFILL': {
            if (payload && payload.deviceId && Array.isArray(payload.points) && payload.points.length > 0) {
              if (role === 'SPECTATOR' && !isAdminSession) {
                if (payload.batchId) {
                  ws.send(JSON.stringify({ type: 'GPS_BATCH_REJECTED', payload: { batchId: payload.batchId, roomCode: currentRoom.code, reason: 'NOT_PARTICIPANT' } }));
                }
                return;
              }

              // As for GPS_BROADCAST: a relayed tracker's history doesn't take over this socket's identity
              if (payload.relayedBy) {
                const boundBoatId = acceptRelay(ws, currentRoom, payload);
                if (!boundBoatId) {
                  if (payload.batchId) {
                    ws.send(JSON.stringify({ type: 'GPS_BATCH_REJECTED', payload: { batchId: payload.batchId, roomCode: currentRoom.code, reason: 'NOT_RELAYABLE' } }));
                  }
                  return;
                }
                payload.boundBoatId = boundBoatId;
              } else {
                (ws as any).deviceId = payload.deviceId;
                payload.boundBoatId = boundBoatIdFor(currentRoom, payload.deviceId);
              }
              const existing = currentRoom.trackers.get(payload.deviceId) || {};
              const existingTrail = existing.trail || [];
              const newCoords = payload.points.map((p: any) => ({ lat: p.lat, lng: p.lng }));
              const mergedTrail = [...existingTrail, ...newCoords].slice(-2000);
              const lastPoint = payload.points[payload.points.length - 1];

              const updatedTracker = {
                ...existing,
                ...payload,
                lat: lastPoint.lat,
                lng: lastPoint.lng,
                speedKt: lastPoint.speedKt ?? existing.speedKt ?? 0,
                headingDeg: lastPoint.headingDeg ?? existing.headingDeg ?? 0,
                trail: mergedTrail,
                lastSeen: lastPoint.timestamp || Date.now(),
                isOnline: true,
              };
              currentRoom.trackers.set(payload.deviceId, updatedTracker);

              // Update bound boat in race fleet
              // Set above from the room's binding; an older binding stored on the tracker doesn't count
              const targetBoatId = payload.boundBoatId;
              if (targetBoatId && Array.isArray(currentRoom.boats)) {
                currentRoom.boats = currentRoom.boats.map((b: any) => {
                  // Only the bound boat: another boat still naming this tracker (a stale nodeId) stays put
                  if (b.id === targetBoatId) {
                    const oldBoatTrail = b.trail || [];
                    return {
                      ...b,
                      lat: lastPoint.lat,
                      lng: lastPoint.lng,
                      sog: lastPoint.speedKt ?? b.sog,
                      cog: lastPoint.headingDeg ?? b.cog,
                      heading: lastPoint.headingDeg ?? b.heading,
                      trail: [...oldBoatTrail, ...newCoords].slice(-2000),
                    };
                  }
                  return b;
                });
                broadcastToRoom(currentRoom.code, 'BOATS_UPDATED', currentRoom.boats, ws);
                persistRoom(currentRoom);
              }

              broadcastToRoom(currentRoom.code, 'TRACKER_BATCH_BACKFILL', {
                deviceId: payload.deviceId,
                deviceName: payload.deviceName,
                boundBoatId: targetBoatId,
                points: payload.points,
                tracker: updatedTracker,
              }, ws);

              if (payload.batchId) {
                ws.send(JSON.stringify({ type: 'GPS_BATCH_ACK', payload: { batchId: payload.batchId, count: payload.points.length, roomCode: currentRoom.code } }));
              }
            }
            break;
          }

          case 'DEVICE_STOPPED': {
            if (payload && payload.deviceId) {
              if (currentRoom.trackers.has(payload.deviceId)) {
                currentRoom.trackers.delete(payload.deviceId);
                broadcastAllInRoom(currentRoom.code, 'TRACKER_REMOVED', { deviceId: payload.deviceId });
                broadcastAllInRoom(currentRoom.code, 'FLEET_SYNC', Array.from(currentRoom.trackers.values()));
              }
            }
            break;
          }

          // Protected Mutating Messages: Require ADMIN or RACE_OFFICER permission
          case 'UPDATE_MARKS': {
            if (!isAdminSession && role !== 'ADMIN' && role !== 'RACE_OFFICER') {
              rejectEdit('UPDATE_MARKS');
              return;
            }
            if (Array.isArray(payload)) {
              currentRoom.marks = payload;
              broadcastToRoom(currentRoom.code, 'MARKS_UPDATED', payload, ws);
              persistRoom(currentRoom);
              insertAuditLog({
                tenantId: currentRoom.tenantId,
                roomCode: currentRoom.code,
                action: 'UPDATE_MARKS',
                userRole: role,
                details: { marksCount: payload.length },
              });
            }
            break;
          }

          case 'UPDATE_RACE_STATE': {
            if (!isAdminSession && role !== 'ADMIN' && role !== 'RACE_OFFICER') {
              rejectEdit('UPDATE_RACE_STATE');
              return;
            }
            if (payload && typeof payload === 'object') {
              const currentTimestamp = (currentRoom.raceState as any).updatedAt || 0;
              const incomingTimestamp = payload.updatedAt || Date.now();
              if (incomingTimestamp >= currentTimestamp) {
                let targetStartTime = payload.targetStartTime;
                if (payload.startSequenceActive && !targetStartTime && typeof payload.countdownSeconds === 'number' && payload.countdownSeconds > 0) {
                  targetStartTime = incomingTimestamp + (payload.countdownSeconds * 1000);
                }

                currentRoom.raceState = {
                  ...currentRoom.raceState,
                  ...payload,
                  targetStartTime: payload.startSequenceActive ? targetStartTime : undefined,
                  updatedAt: incomingTimestamp,
                };
                broadcastToRoom(currentRoom.code, 'RACE_STATE_UPDATED', currentRoom.raceState, ws);
                persistRoom(currentRoom);

                // Audit log race countdown and finish events
                if (payload.startSequenceActive) {
                  insertAuditLog({
                    tenantId: currentRoom.tenantId,
                    roomCode: currentRoom.code,
                    action: 'START_SEQUENCE_TRIGGERED',
                    userRole: role,
                    details: { countdownSeconds: payload.countdownSeconds, targetStartTime },
                  });
                }
              }
            }
            break;
          }

          case 'UPDATE_BOATS': {
            if (!isAdminSession && role !== 'ADMIN' && role !== 'RACE_OFFICER') {
              rejectEdit('UPDATE_BOATS');
              return;
            }
            if (Array.isArray(payload)) {
              currentRoom.boats = payload;
              broadcastToRoom(currentRoom.code, 'BOATS_UPDATED', payload, ws);
              persistRoom(currentRoom);
            }
            break;
          }

          // A skipper binding their own tracker to a boat, when the race office allows it
          case 'SKIPPER_BIND_TRACKER': {
            const requestId = payload && typeof payload.requestId === 'string' ? payload.requestId.slice(0, 64) : undefined;
            const decision = decideSkipperBinding(currentRoom.boats, currentRoom.raceState, isAdminSession ? 'ADMIN' : role, payload);
            if ('reason' in decision) {
              ws.send(JSON.stringify({
                type: 'SKIPPER_BIND_RESULT',
                payload: { requestId, ok: false, reason: decision.reason, message: SKIPPER_BIND_MESSAGES[decision.reason] },
              }));
              return;
            }
            if (decision.changed) {
              currentRoom.boats = decision.boats;
              // To the sender too: its boats change only when the server has accepted the binding
              broadcastAllInRoom(currentRoom.code, 'BOATS_UPDATED', currentRoom.boats);
              persistRoom(currentRoom);
              insertAuditLog({
                tenantId: currentRoom.tenantId,
                roomCode: currentRoom.code,
                action: 'SKIPPER_BOUND_TRACKER',
                userRole: role,
                details: { boatId: decision.boatId, nodeId: decision.nodeId },
              });
            }
            ws.send(JSON.stringify({
              type: 'SKIPPER_BIND_RESULT',
              payload: { requestId, ok: true, boatId: decision.boatId, nodeId: decision.nodeId },
            }));
            break;
          }

          case 'UPDATE_CLASSES': {
            if (!isAdminSession && role !== 'ADMIN' && role !== 'RACE_OFFICER') {
              rejectEdit('UPDATE_CLASSES');
              return;
            }
            const classes = sanitizeRaceClasses(payload);
            if (classes) {
              currentRoom.raceClasses = classes;
              broadcastToRoom(currentRoom.code, 'CLASSES_UPDATED', classes, ws);
              persistRoom(currentRoom);
            }
            break;
          }

          case 'UPDATE_SERIES_RACES': {
            if (!isAdminSession && role !== 'ADMIN' && role !== 'RACE_OFFICER') {
              rejectEdit('UPDATE_SERIES_RACES');
              return;
            }
            if (Array.isArray(payload)) {
              currentRoom.seriesRaces = payload;
              broadcastToRoom(currentRoom.code, 'SERIES_RACES_UPDATED', payload, ws);
              persistRoom(currentRoom);
            }
            break;
          }

          case 'SEND_VHF_NOTICE': {
            if (!isAdminSession && role !== 'ADMIN' && role !== 'RACE_OFFICER') {
              rejectEdit('SEND_VHF_NOTICE');
              return;
            }
            if (payload) {
              currentRoom.vhfBulletins = [payload, ...currentRoom.vhfBulletins].slice(0, 50);
              broadcastToRoom(currentRoom.code, 'VHF_NOTICE_BROADCAST', payload, ws);
              persistRoom(currentRoom);
              insertAuditLog({
                tenantId: currentRoom.tenantId,
                roomCode: currentRoom.code,
                action: 'VHF_BULLETIN_BROADCAST',
                userRole: role,
                details: { title: payload.title, type: payload.type },
              });
            }
            break;
          }

          case 'PING': {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            break;
          }

          case 'REQUEST_SYNC': {
            ws.send(
              JSON.stringify({
                type: 'SESSION_INIT_STATE',
                payload: {
                  roomCode: currentRoom.code,
                  title: currentRoom.title,
                  locationName: currentRoom.locationName,
                  tenantId: currentRoom.tenantId,
                  tenantName: currentRoom.tenantName,
                  isAdmin: (ws as any).isAdmin,
                  canEdit: canEditRoom((ws as any).userRole),
                  userRole: (ws as any).userRole,
                  sessionId: `regatta-room-${currentRoom.code}`,
                  connectedClients: getRoomClientCount(currentRoom.code),
                  raceState: currentRoom.raceState,
                  marks: currentRoom.marks,
                  boats: currentRoom.boats,
                  raceClasses: currentRoom.raceClasses,
                  trackers: Array.from(currentRoom.trackers.values()),
                  vhfBulletins: currentRoom.vhfBulletins,
                  seriesRaces: currentRoom.seriesRaces || [],
                  serverTime: Date.now(),
                },
              })
            );
            break;
          }

          case 'CLEAR_TRACKERS': {
            if (isAdminSession) {
              currentRoom.trackers.clear();
              broadcastAllInRoom(currentRoom.code, 'TRACKERS_CLEARED', {});
            }
            break;
          }

          default:
            break;
        }
      } catch (e) {
        console.error('Error handling WS message:', e);
      }
    });

    ws.on('close', () => {
      const devId = (ws as any).deviceId;
      const roomCode = (ws as any).roomCode || 'RLIR26';
      const markOffline = (code: string, id: string) => {
        const r = activeRooms.get(code);
        const tracker = r?.trackers.get(id);
        if (r && tracker) {
          tracker.isOnline = false;
          tracker.lastSeen = Date.now();
          r.trackers.set(id, tracker);
          broadcastAllInRoom(code, 'TRACKER_POSITION_UPDATE', tracker);
        }
      };
      if (devId) markOffline(roomCode, devId);
      // Trackers this socket was relaying go offline with it
      const relayedKeys: Set<string> | undefined = (ws as any).relayedKeys;
      if (relayedKeys) {
        for (const key of relayedKeys) {
          if (relayOwners.get(key) !== ws) continue;
          relayOwners.delete(key);
          const sep = key.indexOf('|');
          markOffline(key.slice(0, sep), key.slice(sep + 1));
        }
      }
      broadcastAllInRoom(roomCode, 'PEER_COUNT_UPDATE', { count: getRoomClientCount(roomCode) });
      refreshRoomActivity(roomCode);
    });

    ws.on('error', (err) => {
      console.warn('WS Client error:', err);
    });
  });

  // Prune inactive trackers across active rooms every 30s
  setInterval(() => {
    const now = Date.now();
    for (const room of activeRooms.values()) {
      let changed = false;
      for (const [id, tracker] of room.trackers.entries()) {
        if (now - (tracker.lastSeen || tracker.timestamp || 0) > 300000) {
          room.trackers.delete(id);
          changed = true;
        }
      }
      if (changed) {
        broadcastAllInRoom(room.code, 'FLEET_SYNC', Array.from(room.trackers.values()));
      }
    }
  }, 30000);

  // Helper to extract room from any REST request
  function resolveRoom(req: express.Request): ActiveRoomState {
    const raw = (req.query.room as string) || (req.headers['x-regatta-room'] as string) || 'RLIR26';
    return getOrLoadRoom(raw, false) || getOrLoadRoom('RLIR26', true)!;
  }

  function requestRoomRole(req: express.Request, room: ActiveRoomState): RoomRole {
    const pin = (req.headers['x-admin-pin'] as string) || (typeof req.body?.pin === 'string' ? req.body.pin : '');
    return resolveRoomRole(roomRoleUserFromGate(req), room, checkedPin(clientAddress(req.headers, req.socket.remoteAddress), room, pin));
  }

  // ==========================================
  // MULTI-TENANT & ORGANIZATION REST API
  // ==========================================

  /**
   * Flow: Sign up creates tenant organization + owner admin account
   */
  app.post('/api/auth/register-tenant', (req, res) => {
    const { organizationName, adminEmail, adminUsername, password, fullName, sailingClub } = req.body || {};
    if (!organizationName || !adminEmail || !adminUsername || !password || !fullName) {
      return res.status(400).json({ error: 'Please provide organization name, email, username, password, and full name.' });
    }

    const cleanEmail = adminEmail.trim().toLowerCase();
    const cleanUsername = adminUsername.trim().toLowerCase();
    const orgName = organizationName.trim();
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `org-${Date.now()}`;

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(cleanEmail, cleanUsername);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email or username already exists.' });
    }

    const tenantId = 'tenant-' + crypto.randomBytes(6).toString('hex');
    const userId = 'user-' + crypto.randomBytes(6).toString('hex');
    const token = generateToken();
    const now = Date.now();

    // Default to FREE plan
    const defaultTier: PlanTier = 'FREE';
    const limits = PLAN_CONFIG[defaultTier];

    try {
      db.prepare(`
        INSERT INTO tenants (
          id, name, slug, owner_id, owner_email, plan_tier,
          max_active_rooms, max_boats_per_room, max_admin_seats,
          lora_priority, custom_branding, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tenantId,
        orgName,
        slug,
        userId,
        cleanEmail,
        defaultTier,
        limits.maxActiveRooms,
        limits.maxBoatsPerRoom,
        limits.maxAdminSeats,
        0,
        0,
        now,
        now
      );

      db.prepare(`
        INSERT INTO users (
          id, tenant_id, email, username, password_hash, full_name,
          sailing_club, role, participant_type, status, token,
          stats_json, race_history_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        tenantId,
        cleanEmail,
        cleanUsername,
        hashPassword(password),
        fullName.trim(),
        (sailingClub || orgName).trim(),
        'ADMIN',
        'RACE_OFFICER',
        'ACTIVE',
        token,
        JSON.stringify({ racesOrganized: 0, racesParticipated: 0, podiumFinishes: 0, totalNauticalMiles: 0, vmgEfficiency: 0, winRate: 0 }),
        JSON.stringify([]),
        now
      );

      // Seed initial event for this new club
      const defaultEventCode = slug.substring(0, 6).toUpperCase();
      const defaultAdminPin = generateAdminPin();
      const defaultParticipantPin = generateParticipantPin();
      const eventId = 'event-' + crypto.randomBytes(6).toString('hex');
      const eventTitle = `${orgName} Championship`;

      db.prepare(`
        INSERT INTO events (
          id, tenant_id, code, title, location_name, admin_pin, participant_pin,
          is_public, owner_id, status, race_state_json, marks_json, boats_json,
          vhf_bulletins_json, series_races_json, created_at, last_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        eventId,
        tenantId,
        defaultEventCode,
        eventTitle,
        sailingClub || 'Club Waters',
        defaultAdminPin,
        defaultParticipantPin,
        1,
        userId,
        'PRE_START',
        JSON.stringify({ ...DEFAULT_RACE_STATE, name: eventTitle }),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        now,
        now
      );

      insertAuditLog({
        tenantId,
        eventId,
        roomCode: defaultEventCode,
        userId,
        userEmail: cleanEmail,
        userRole: 'ADMIN',
        action: 'TENANT_ORGANIZATION_CREATED',
        details: { organizationName: orgName, planTier: defaultTier, defaultEventCode },
      });

      res.json({
        success: true,
        tenant: {
          id: tenantId,
          name: orgName,
          slug,
          ownerId: userId,
          planTier: defaultTier,
          limits,
          activeRoomsCount: 1,
          membersCount: 1,
          createdAt: now,
        },
        user: {
          id: userId,
          tenantId,
          tenantName: orgName,
          email: cleanEmail,
          username: cleanUsername,
          fullName: fullName.trim(),
          role: 'ADMIN',
          planTier: defaultTier,
          token,
          createdAt: now,
        },
        defaultEventCode,
        // Only the new club admin ever sees these; there are no shared default PINs any more
        defaultRoomPins: { adminPin: defaultAdminPin, participantPin: defaultParticipantPin },
        token,
      });
    } catch (e: any) {
      console.error('Error creating tenant:', e);
      res.status(500).json({ error: 'Failed to create organization: ' + (e.message || 'Database error') });
    }
  });

  /**
   * Flow: Participant registration (Skipper, Crew, Officer joining an organization or event)
   */
  app.post('/api/auth/register', (req, res) => {
    // role and tenant are never trusted from the client: personal sign-up can't make admins or pick a club.
    // Admins come from club sign-up (/api/auth/register-tenant) or a Super Admin edit.
    const { email, username, password, fullName, sailingClub, sailNumber, handicapRating, role, participantType } = req.body || {};
    if (!email || !username || !password || !fullName) {
      return res.status(400).json({ error: 'Please provide email, username, password, and full name.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();

    // Check duplicate
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(cleanEmail, cleanUsername);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email or username already exists.' });
    }

    const defaultTenant = (db.prepare(`SELECT id FROM tenants ORDER BY (id = 'tenant-rlyc-default') DESC, created_at ASC LIMIT 1`).get() as any);
    const assignedTenantId = defaultTenant?.id || 'tenant-rlyc-default';

    const userId = 'user-' + crypto.randomBytes(6).toString('hex');
    const token = generateToken();
    const now = Date.now();
    const assignedRole = role === 'SPECTATOR' ? 'SPECTATOR' : 'PARTICIPANT';
    const assignedPartType = participantType || (role === 'RACE_OFFICER' ? 'RACE_OFFICER' : 'SKIPPER');

    try {
      db.prepare(`
        INSERT INTO users (
          id, tenant_id, email, username, password_hash, full_name,
          sailing_club, sail_number, handicap_rating, role, participant_type,
          status, token, stats_json, race_history_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        assignedTenantId,
        cleanEmail,
        cleanUsername,
        hashPassword(password),
        fullName.trim(),
        (sailingClub || 'Independent Sailor').trim(),
        (sailNumber || '').trim(),
        (handicapRating || 'Standard').trim(),
        assignedRole,
        assignedPartType,
        'ACTIVE',
        token,
        JSON.stringify({ racesOrganized: 0, racesParticipated: 0, podiumFinishes: 0, totalNauticalMiles: 0, vmgEfficiency: 0, winRate: 0 }),
        JSON.stringify([]),
        now
      );

      const userRow = db.prepare(`
        SELECT u.*, t.name as tenant_name, t.plan_tier 
        FROM users u 
        LEFT JOIN tenants t ON u.tenant_id = t.id 
        WHERE u.id = ?
      `).get(userId) as any;

      // Resilient fallback: If userRow lookup is temporarily delayed or undefined, construct from validated inputs
      const safeUser = userRow || {
        id: userId,
        tenant_id: assignedTenantId,
        tenant_name: (db.prepare('SELECT name FROM tenants WHERE id = ?').get(assignedTenantId) as any)?.name || 'Royal Langkawi Yacht Club',
        email: cleanEmail,
        username: cleanUsername,
        full_name: fullName.trim(),
        sailing_club: (sailingClub || 'Independent Sailor').trim(),
        sail_number: (sailNumber || '').trim(),
        handicap_rating: (handicapRating || 'Standard').trim(),
        role: assignedRole,
        participant_type: assignedPartType,
        status: 'ACTIVE',
        plan_tier: 'FREE',
        created_at: now,
      };

      insertAuditLog({
        tenantId: assignedTenantId,
        userId,
        userEmail: cleanEmail,
        userRole: assignedRole,
        action: 'USER_REGISTERED',
        details: { role: assignedRole, participantType: assignedPartType },
      });

      res.json({
        success: true,
        user: {
          id: safeUser.id,
          tenantId: safeUser.tenant_id,
          tenantName: safeUser.tenant_name,
          email: safeUser.email,
          username: safeUser.username,
          fullName: safeUser.full_name,
          sailingClub: safeUser.sailing_club,
          sailNumber: safeUser.sail_number,
          handicapRating: safeUser.handicap_rating,
          role: safeUser.role,
          participantType: safeUser.participant_type,
          status: safeUser.status,
          planTier: safeUser.plan_tier || 'FREE',
          token,
          createdAt: safeUser.created_at,
        },
        token,
      });
    } catch (e: any) {
      console.error('Error registering user:', e);
      res.status(500).json({ error: 'Failed to register account: ' + (e.message || 'Database error') });
    }
  });

  /**
   * User Login with Universal Admin & Tenant resolution
   */
  app.post('/api/auth/login', (req, res) => {
    const { login, password } = req.body || {};
    if (!login || !password) {
      return res.status(400).json({ error: 'Please provide email/username and password.' });
    }
    const cleanLogin = login.trim().toLowerCase();
    const targetHash = hashPassword(password);

    const userRow = db.prepare(`
      SELECT u.*, t.name as tenant_name, t.plan_tier, t.owner_id as tenant_owner_id
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE (
        LOWER(u.email) = ? 
        OR LOWER(u.username) = ? 
        OR (? = 'admin' AND (u.id = 'user-admin-0' OR u.role = 'ADMIN' OR u.is_super_admin = 1))
      )
    `).get(cleanLogin, cleanLogin, cleanLogin) as any;

    if (!userRow) {
      return res.status(401).json({ error: 'Invalid credentials. Please check your username/email and password.' });
    }

    if (userRow.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Account has been suspended. Please contact your organization administrator.' });
    }

    // Password hash validation
    // Super Admin access comes from the account's flag only; the owner's flag is re-applied at startup.
    const isUnivAdmin = !!userRow.is_super_admin;
    if (userRow.password_hash !== targetHash) {
      return res.status(401).json({ error: 'Invalid credentials. Please check your username/email and password.' });
    }

    // New session for this device; other devices stay signed in
    let token: string;
    try {
      token = createSession(userRow.id, req.headers['user-agent'] || null);
    } catch (tokenErr: any) {
      console.error('Failed to create session on login:', tokenErr);
      return res.status(500).json({ error: 'Could not start a session. Please try again.' });
    }
    userRow.token = token;

    let stats = { racesOrganized: 0, racesParticipated: 0, podiumFinishes: 0, totalNauticalMiles: 0, vmgEfficiency: 0, winRate: 0 };
    let raceHistory = [];
    try {
      if (userRow.stats_json) stats = JSON.parse(userRow.stats_json);
      if (userRow.race_history_json) raceHistory = JSON.parse(userRow.race_history_json);
    } catch (e) {}

    res.json({
      success: true,
      user: {
        id: userRow.id,
        tenantId: userRow.tenant_id,
        tenantName: userRow.tenant_name,
        email: userRow.email,
        username: userRow.username,
        fullName: userRow.full_name,
        sailingClub: userRow.sailing_club,
        sailNumber: userRow.sail_number,
        handicapRating: userRow.handicap_rating,
        role: isUnivAdmin ? 'ADMIN' : userRow.role,
        participantType: userRow.participant_type,
        status: userRow.status,
        planTier: userRow.plan_tier || 'FREE',
        isOwner: userRow.tenant_owner_id === userRow.id || isUnivAdmin,
        isSuperAdmin: !!userRow.is_super_admin || isUnivAdmin,
        stats,
        raceHistory,
        token,
        createdAt: userRow.created_at,
      },
      token,
    });
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.gate?.user) {
      return res.status(401).json({ error: 'Not authenticated', user: null });
    }
    res.json({ success: true, user: req.gate.user, tenant: req.gate.tenant });
  });

  app.put('/api/auth/profile', requireAuth(), (req, res) => {
    const user = req.gate!.user!;
    const { fullName, sailingClub, sailNumber, handicapRating } = req.body || {};

    try {
      db.prepare(`
        UPDATE users SET
          full_name = COALESCE(?, full_name),
          sailing_club = COALESCE(?, sailing_club),
          sail_number = COALESCE(?, sail_number),
          handicap_rating = COALESCE(?, handicap_rating)
        WHERE id = ?
      `).run(
        fullName ? fullName.trim() : null,
        sailingClub !== undefined ? sailingClub.trim() : null,
        sailNumber !== undefined ? sailNumber.trim() : null,
        handicapRating !== undefined ? handicapRating.trim() : null,
        user.id
      );

      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
      res.json({ success: true, user: { ...user, fullName: updated.full_name, sailingClub: updated.sailing_club, sailNumber: updated.sail_number, handicapRating: updated.handicap_rating } });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to update profile: ' + e.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    // Signs out this device only
    endSession(extractRequestToken(req));
    res.json({ success: true });
  });

  // ==========================================
  // IN-APP SUBSCRIPTION & PLAN MANAGER
  // ==========================================

  app.get('/api/tenants/current', requireAuth(), (req, res) => {
    const tenantId = req.gate!.tenant?.id || req.gate!.user?.tenantId;
    if (!tenantId) {
      return res.status(404).json({ error: 'Organization tenant not found.' });
    }

    const tenantRow = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenantRow) {
      return res.status(404).json({ error: 'Tenant record not found in database.' });
    }

    const activeRoomsCount = (db.prepare(`
      SELECT COUNT(*) as count FROM events WHERE tenant_id = ? AND status != 'CLOSED'
    `).get(tenantId) as any)?.count || 0;

    const membersCount = (db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE tenant_id = ?
    `).get(tenantId) as any)?.count || 0;

    const tier = (tenantRow.plan_tier || 'FREE') as PlanTier;
    const limits = PLAN_CONFIG[tier];

    res.json({
      success: true,
      tenant: {
        id: tenantRow.id,
        name: tenantRow.name,
        slug: tenantRow.slug,
        ownerId: tenantRow.owner_id,
        ownerEmail: tenantRow.owner_email,
        planTier: tier,
        limits,
        activeRoomsCount,
        membersCount,
        createdAt: tenantRow.created_at,
        stripeCustomerId: tenantRow.stripe_customer_id,
        stripeSubscriptionId: tenantRow.stripe_subscription_id,
        subscriptionStatus: tenantRow.subscription_status || 'none',
        subscriptionCurrentPeriodEnd: tenantRow.subscription_current_period_end || 0,
        eventPassesBalance: tenantRow.event_passes_balance || 0,
      },
    });
  });

  /**
   * Upgrades or updates plan limits for the current organization
   */
  app.post('/api/tenants/plan/upgrade', requireTenantAdmin, (req, res) => {
    const { targetTier } = req.body || {};
    if (!targetTier || !['FREE', 'CLUB', 'EVENT_PRO'].includes(targetTier)) {
      return res.status(400).json({ error: 'Invalid plan tier specified. Allowed: FREE, CLUB, EVENT_PRO' });
    }

    const tenantId = req.gate!.tenant!.id;
    const tier = targetTier as PlanTier;
    const limits = PLAN_CONFIG[tier];

    try {
      db.prepare(`
        UPDATE tenants SET
          plan_tier = ?,
          max_active_rooms = ?,
          max_boats_per_room = ?,
          max_admin_seats = ?,
          lora_priority = ?,
          custom_branding = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        tier,
        limits.maxActiveRooms,
        limits.maxBoatsPerRoom,
        limits.maxAdminSeats,
        limits.loraPriority ? 1 : 0,
        limits.customBranding ? 1 : 0,
        Date.now(),
        tenantId
      );

      insertAuditLog({
        tenantId,
        userId: req.gate!.user!.id,
        userEmail: req.gate!.user!.email,
        userRole: req.gate!.user!.role,
        action: 'SUBSCRIPTION_PLAN_UPGRADED',
        details: { newPlanTier: tier, limits },
      });

      res.json({
        success: true,
        message: `Organization subscription plan successfully updated to ${tier}!`,
        planTier: tier,
        limits,
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to update plan: ' + e.message });
    }
  });

  app.get('/api/tenants/members', requireTenantAdmin, (req, res) => {
    const tenantId = req.gate!.tenant!.id;
    const members = db.prepare(`
      SELECT id, tenant_id, email, username, full_name, sailing_club, sail_number, role, participant_type, status, created_at
      FROM users
      WHERE tenant_id = ?
      ORDER BY created_at DESC
    `).all(tenantId);
    // Filter in code too: the JSON fallback store ignores WHERE when listing
    const ownMembers = (members as any[]).filter((m) => m.tenant_id === tenantId);

    res.json({ success: true, members: ownMembers });
  });

  // ==========================================
  // CLUB USER MANAGEMENT (club admins: own club; Super Admin: everyone)
  // ==========================================

  // The management screen calls skippers SKIPPER; accounts store them as PARTICIPANT
  const MANAGED_ROLES: Record<string, string> = { ADMIN: 'ADMIN', RACE_OFFICER: 'RACE_OFFICER', SKIPPER: 'PARTICIPANT', PARTICIPANT: 'PARTICIPANT', SPECTATOR: 'SPECTATOR' };

  const isGateSuperAdmin = (req: express.Request) => !!(req.gate?.isSuperAdmin || req.gate?.isUniversalAdmin || req.gate?.user?.isSuperAdmin);

  const toManagedUser = (u: any) => ({
    id: u.id,
    tenantId: u.tenant_id,
    email: u.email,
    username: u.username,
    fullName: u.full_name || u.username || '',
    sailingClub: u.sailing_club || '',
    sailNumber: u.sail_number || '',
    handicapRating: u.handicap_rating || '',
    role: u.role === 'PARTICIPANT' ? 'SKIPPER' : u.role,
    participantType: u.participant_type,
    // Signed up as "Race Officer / Jury"; a club admin can promote them
    requestedRole: u.role === 'PARTICIPANT' && u.participant_type === 'RACE_OFFICER' ? 'RACE_OFFICER' : undefined,
    status: u.status || 'ACTIVE',
    isSuperAdmin: !!u.is_super_admin,
    createdAt: u.created_at,
  });

  // A user this admin may manage: same club (or any, for the Super Admin), never the Super Admin, never yourself
  function loadManagedUser(req: express.Request, res: express.Response): any | null {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
    const inScope = target && (isGateSuperAdmin(req) || target.tenant_id === req.gate!.tenant!.id);
    if (!inScope) {
      res.status(404).json({ success: false, error: 'User not found in your club.' });
      return null;
    }
    if (target.id === req.gate!.user!.id) {
      res.status(400).json({ success: false, error: 'You cannot change your own account here. Use your profile instead.' });
      return null;
    }
    if (target.is_super_admin && !isGateSuperAdmin(req)) {
      res.status(403).json({ success: false, error: 'The Super Admin account cannot be changed by a club admin.' });
      return null;
    }
    return target;
  }

  app.get('/api/admin/users', requireTenantAdmin, (req, res) => {
    const tenantId = req.gate!.tenant!.id;
    const all = db.prepare('SELECT * FROM users WHERE tenant_id = ?').all(tenantId) as any[];
    // Filter in code: the JSON fallback store ignores WHERE when listing
    const users = (isGateSuperAdmin(req) ? db.prepare('SELECT * FROM users').all() as any[] : all.filter((u) => u.tenant_id === tenantId))
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .map(toManagedUser);
    res.json({ success: true, users });
  });

  app.post('/api/admin/users', requireTenantAdmin, (req, res) => {
    const { email, username, password, fullName, sailingClub, sailNumber, handicapRating, role } = req.body || {};
    if (!email || !username || !password || !fullName) {
      return res.status(400).json({ success: false, error: 'Email, username, password and full name are required.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, error: 'The password must be at least 8 characters.' });
    }
    const storedRole = MANAGED_ROLES[String(role || 'SKIPPER').toUpperCase()];
    if (!storedRole) {
      return res.status(400).json({ success: false, error: 'Unknown role.' });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUsername = String(username).trim().toLowerCase();
    if (db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(cleanEmail, cleanUsername)) {
      return res.status(400).json({ success: false, error: 'An account with this email or username already exists.' });
    }
    const tenantId = req.gate!.tenant!.id;
    const userId = 'user-' + crypto.randomBytes(6).toString('hex');
    const now = Date.now();
    db.prepare(`
      INSERT INTO users (
        id, tenant_id, email, username, password_hash, full_name,
        sailing_club, sail_number, handicap_rating, role, participant_type,
        status, token, stats_json, race_history_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      tenantId,
      cleanEmail,
      cleanUsername,
      hashPassword(String(password)),
      String(fullName).trim(),
      String(sailingClub || req.gate!.tenant!.name || '').trim(),
      String(sailNumber || '').trim(),
      String(handicapRating || 'Standard').trim(),
      storedRole,
      storedRole === 'RACE_OFFICER' ? 'RACE_OFFICER' : 'SKIPPER',
      'ACTIVE',
      null,
      JSON.stringify({ racesOrganized: 0, racesParticipated: 0, podiumFinishes: 0, totalNauticalMiles: 0, vmgEfficiency: 0, winRate: 0 }),
      JSON.stringify([]),
      now
    );
    insertAuditLog({ tenantId, userId: req.gate!.user!.id, userEmail: req.gate!.user!.email, action: 'CLUB_USER_CREATED', details: { userId, role: storedRole } });
    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    res.json({ success: true, user: toManagedUser(created) });
  });

  app.put('/api/admin/users/:id/role', requireTenantAdmin, (req, res) => {
    const target = loadManagedUser(req, res);
    if (!target) return;
    const storedRole = MANAGED_ROLES[String(req.body?.role || '').toUpperCase()];
    if (!storedRole) {
      return res.status(400).json({ success: false, error: 'Unknown role.' });
    }
    db.prepare('UPDATE users SET role = ?, participant_type = ? WHERE id = ?').run(
      storedRole,
      storedRole === 'RACE_OFFICER' ? 'RACE_OFFICER' : target.participant_type === 'RACE_OFFICER' && storedRole === 'PARTICIPANT' ? 'SKIPPER' : target.participant_type,
      target.id
    );
    insertAuditLog({ tenantId: target.tenant_id, userId: req.gate!.user!.id, userEmail: req.gate!.user!.email, action: 'CLUB_USER_ROLE_CHANGED', details: { userId: target.id, from: target.role, to: storedRole } });
    res.json({ success: true, user: toManagedUser(db.prepare('SELECT * FROM users WHERE id = ?').get(target.id)) });
  });

  app.put('/api/admin/users/:id/status', requireTenantAdmin, (req, res) => {
    const target = loadManagedUser(req, res);
    if (!target) return;
    const status = String(req.body?.status || '').toUpperCase();
    if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
      return res.status(400).json({ success: false, error: 'Status must be ACTIVE or SUSPENDED.' });
    }
    // Suspending also signs the user out
    if (status === 'SUSPENDED') {
      db.prepare('UPDATE users SET status = ?, token = NULL WHERE id = ?').run(status, target.id);
      endAllSessionsForUser(target.id);
    } else {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, target.id);
    }
    insertAuditLog({ tenantId: target.tenant_id, userId: req.gate!.user!.id, userEmail: req.gate!.user!.email, action: 'CLUB_USER_STATUS_CHANGED', details: { userId: target.id, status } });
    res.json({ success: true, user: toManagedUser(db.prepare('SELECT * FROM users WHERE id = ?').get(target.id)) });
  });

  app.post('/api/admin/users/:id/reset-password', requireTenantAdmin, (req, res) => {
    const target = loadManagedUser(req, res);
    if (!target) return;
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'The new password must be at least 8 characters.' });
    }
    // Signs the user out everywhere; they sign in again with the new password
    db.prepare('UPDATE users SET password_hash = ?, token = NULL WHERE id = ?').run(hashPassword(newPassword), target.id);
    endAllSessionsForUser(target.id);
    insertAuditLog({ tenantId: target.tenant_id, userId: req.gate!.user!.id, userEmail: req.gate!.user!.email, action: 'CLUB_USER_PASSWORD_RESET', details: { userId: target.id } });
    res.json({ success: true, message: 'Password reset. The user has been signed out.' });
  });

  app.delete('/api/admin/users/:id', requireTenantAdmin, (req, res) => {
    const target = loadManagedUser(req, res);
    if (!target) return;
    db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
    endAllSessionsForUser(target.id);
    insertAuditLog({ tenantId: target.tenant_id, userId: req.gate!.user!.id, userEmail: req.gate!.user!.email, action: 'CLUB_USER_DELETED', details: { userId: target.id, email: target.email } });
    res.json({ success: true, message: 'User deleted.' });
  });

  // ==========================================
  // AUDIT TRAIL LOG API
  // ==========================================

  app.get('/api/audit', requireTenantAdmin, (req, res) => {
    const tenantId = req.gate!.tenant!.id;
    const logs = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE tenant_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 100
    `).all(tenantId) as any[];

    const formatted = logs
      .filter((l) => l.tenant_id === tenantId)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 100)
      .map((l) => ({
      id: l.id,
      tenantId: l.tenant_id,
      eventId: l.event_id,
      roomCode: l.room_code,
      userId: l.user_id,
      userEmail: l.user_email,
      userRole: l.user_role,
      action: l.action,
      platform: l.platform,
      details: l.details_json ? JSON.parse(l.details_json) : {},
      timestamp: l.timestamp,
    }));

    res.json({ success: true, logs: formatted });
  });

  // ==========================================
  // MULTI-TENANT ROOMS & EVENTS API
  // ==========================================

  app.get('/api/rooms', (req, res) => {
    const user = req.gate?.user;
    const filter = req.query.filter as string;

    let query = `
      SELECT e.*, t.name as tenant_name, u.full_name as owner_name 
      FROM events e
      LEFT JOIN tenants t ON e.tenant_id = t.id
      LEFT JOIN users u ON e.owner_id = u.id
    `;
    const params: any[] = [];

    if (filter === 'mine' && user) {
      query += ` WHERE e.owner_id = ? OR e.tenant_id = ?`;
      params.push(user.id, user.tenantId);
    } else {
      // Spectator view or public directory: list public events or events of tenant
      if (user?.tenantId && !user.role?.includes('SPECTATOR')) {
        query += ` WHERE e.is_public = 1 OR e.tenant_id = ?`;
        params.push(user.tenantId);
      } else {
        query += ` WHERE e.is_public = 1`;
      }
    }

    query += ` ORDER BY e.last_active DESC`;

    const visible = (r: any) => {
      if (filter === 'mine' && user) return r.owner_id === user.id || r.tenant_id === user.tenantId;
      if (user?.tenantId && !user.role?.includes('SPECTATOR')) return !!r.is_public || r.tenant_id === user.tenantId;
      return !!r.is_public;
    };
    // Filter in code too: the JSON fallback store ignores WHERE when listing
    const rows = (db.prepare(query).all(...params) as any[])
      .filter(visible)
      .sort((a, b) => (b.last_active || 0) - (a.last_active || 0));

    const list = rows.map((r) => {
      let boatCount = 0;
      let markCount = 0;
      let raceStatus = r.status || 'PRE_START';
      try {
        if (r.boats_json) boatCount = JSON.parse(r.boats_json).length;
        if (r.marks_json) markCount = JSON.parse(r.marks_json).length;
      } catch (e) {}

      return {
        code: r.code,
        title: r.title,
        locationName: r.location_name,
        tenantId: r.tenant_id,
        tenantName: r.tenant_name || 'Regatta Club',
        isPublic: !!r.is_public,
        ownerId: r.owner_id,
        ownerName: r.owner_name,
        isOwner: !!(user && r.owner_id === user.id),
        boatCount,
        markCount,
        raceStatus,
        activeClients: getRoomClientCount(r.code),
        createdAt: r.created_at,
        lastActive: r.last_active,
        hasPassword: !!r.admin_pin,
        hasParticipantPin: !!r.participant_pin,
      };
    });

    res.json({ success: true, rooms: list });
  });

  /**
   * Public room list for the landing page. Filters in code because the JSON fallback store
   * ignores WHERE clauses when listing rows.
   */
  app.get('/api/rooms/summary', (req, res) => {
    const rows = (db.prepare('SELECT * FROM events WHERE is_public = 1').all() as any[]).filter((r) => !!r.is_public);
    const rooms = rows
      .map((r) => {
        const live = activeRooms.get(r.code);
        let boatCount = live ? live.boats.length : 0;
        if (!live) {
          try {
            boatCount = r.boats_json ? JSON.parse(r.boats_json).length : 0;
          } catch (e) {}
        }
        return {
          code: r.code,
          title: r.title,
          locationName: r.location_name,
          boatCount,
          raceStatus: live?.raceState?.status || r.status || 'PRE_START',
          lastActive: live?.lastActive || r.last_active || 0,
        };
      })
      .sort((a, b) => b.lastActive - a.lastActive);
    res.json({ success: true, rooms });
  });

  /**
   * Admin rights for room management: owner, own-club admin, Super Admin, or the current admin PIN
   */
  function roomManagementRole(req: express.Request, room: ActiveRoomState, pin: string): RoomRole {
    return resolveRoomRole(roomRoleUserFromGate(req), room, checkedPin(clientAddress(req.headers, req.socket.remoteAddress), room, pin));
  }

  app.put('/api/rooms/:code/pin', (req, res) => {
    const room = getOrLoadRoom(req.params.code.trim().toUpperCase(), false);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found.' });
    }
    const currentPin = typeof req.body?.currentPin === 'string' ? req.body.currentPin : '';
    if (roomManagementRole(req, room, currentPin) !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Only the room owner, a club admin, or someone with the current Race Officer PIN can change it.' });
    }
    const newPin = typeof req.body?.newPin === 'string' ? req.body.newPin.trim() : '';
    if (!/^[A-Za-z0-9]{4,12}$/.test(newPin)) {
      return res.status(400).json({ success: false, error: 'The new PIN must be 4 to 12 letters or digits.' });
    }
    if (newPin === room.participantPin) {
      return res.status(400).json({ success: false, error: 'The Race Officer PIN must be different from the skipper PIN.' });
    }
    room.adminPin = newPin;
    persistRoom(room);
    insertAuditLog({
      tenantId: room.tenantId,
      roomCode: room.code,
      userId: req.gate?.user?.id,
      userEmail: req.gate?.user?.email,
      action: 'ROOM_ADMIN_PIN_CHANGED',
      details: {},
    });
    res.json({ success: true, roomCode: room.code });
  });

  app.delete('/api/rooms/:code', (req, res) => {
    const room = getOrLoadRoom(req.params.code.trim().toUpperCase(), false);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found.' });
    }
    if (room.code === 'LOBBY') {
      return res.status(400).json({ success: false, error: 'The LOBBY room is shared by everyone and cannot be deleted.' });
    }
    const pin = (req.headers['x-admin-pin'] as string) || (typeof req.body?.pin === 'string' ? req.body.pin : '');
    if (roomManagementRole(req, room, pin) !== 'ADMIN') {
      return res.status(403).json({ success: false, error: 'Only the room owner, a club admin, or someone with the Race Officer PIN can delete this room.' });
    }
    try {
      db.prepare('DELETE FROM events WHERE code = ?').run(room.code);
    } catch (e: any) {
      return res.status(500).json({ success: false, error: 'Failed to delete room: ' + (e.message || 'database error') });
    }
    activeRooms.delete(room.code);
    mqttBridge.removeRoom(room.code);
    // Disconnect devices still in the room; they reconnect and land in LOBBY
    wss.clients.forEach((client) => {
      if ((client as any).roomCode === room.code) {
        try {
          client.close(4000, 'Room deleted');
        } catch (e) {}
      }
    });
    insertAuditLog({
      tenantId: room.tenantId,
      roomCode: room.code,
      userId: req.gate?.user?.id,
      userEmail: req.gate?.user?.email,
      action: 'ROOM_DELETED',
      details: { title: room.title },
    });
    res.json({ success: true, roomCode: room.code });
  });

  /**
   * Create Event with Plan Quota Check
   */
  app.post('/api/rooms', requireAuth(['ADMIN']), enforcePlanQuota('CREATE_EVENT'), (req, res) => {
    const user = req.gate!.user!;
    const tenant = req.gate!.tenant!;

    const { code, title, locationName, adminPin, participantPin, isPublic, initialMarks, initialBoats, initialRaceState } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Event code is required' });
    }
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanCode.length < 3) {
      return res.status(400).json({ error: 'Event code must be at least 3 characters' });
    }

    // Check if code exists
    const existing = db.prepare('SELECT id, tenant_id, admin_pin, participant_pin FROM events WHERE code = ?').get(cleanCode) as any;
    if (existing) {
      if (existing.tenant_id !== tenant.id) {
        return res.status(400).json({ error: `Event code #${cleanCode} is already in use by another organization.` });
      }
    }

    const eventId = existing?.id || 'event-' + crypto.randomBytes(6).toString('hex');
    const now = Date.now();
    const raceState = initialRaceState || { ...DEFAULT_RACE_STATE, name: title || `${cleanCode} Regatta`, locationName: locationName || 'Regatta Waters' };

    try {
      if (existing) {
        db.prepare(`
          UPDATE events SET
            title = ?, location_name = ?, admin_pin = ?, participant_pin = ?,
            is_public = ?, race_state_json = ?, last_active = ?
          WHERE id = ?
        `).run(
          title || `${cleanCode} Regatta`,
          locationName || 'Coastal Waters',
          adminPin || existing.admin_pin || generateAdminPin(),
          participantPin || existing.participant_pin || generateParticipantPin(),
          isPublic ?? 1,
          JSON.stringify(raceState),
          now,
          eventId
        );
      } else {
        db.prepare(`
          INSERT INTO events (
            id, tenant_id, code, title, location_name, admin_pin, participant_pin,
            is_public, owner_id, status, race_state_json, marks_json, boats_json,
            vhf_bulletins_json, series_races_json, created_at, last_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          eventId,
          tenantIdFromReq(req),
          cleanCode,
          title || `${cleanCode} Regatta`,
          locationName || 'Coastal Waters',
          adminPin || generateAdminPin(),
          participantPin || generateParticipantPin(),
          isPublic ?? 1,
          user.id,
          'PRE_START',
          JSON.stringify(raceState),
          JSON.stringify(initialMarks || []),
          JSON.stringify(initialBoats || []),
          JSON.stringify([]),
          JSON.stringify([]),
          now,
          now
        );
      }

      insertAuditLog({
        tenantId: tenant.id,
        eventId,
        roomCode: cleanCode,
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: existing ? 'EVENT_UPDATED' : 'EVENT_CREATED',
        details: { title, locationName, adminPin: '***', isPublic },
      });

      // Synchronize in-memory cache
      activeRooms.delete(cleanCode);
      const loaded = getOrLoadRoom(cleanCode);

      res.json({
        success: true,
        room: {
          code: loaded.code,
          title: loaded.title,
          locationName: loaded.locationName,
          tenantId: loaded.tenantId,
          tenantName: loaded.tenantName,
          isPublic: loaded.isPublic,
          ownerId: loaded.ownerId,
          isOwner: true,
          boatCount: loaded.boats.length,
          markCount: loaded.marks.length,
          raceStatus: loaded.raceState?.status || 'PRE_START',
          activeClients: getRoomClientCount(loaded.code),
          createdAt: loaded.createdAt,
          lastActive: loaded.lastActive,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to create event: ' + e.message });
    }
  });

  function tenantIdFromReq(req: express.Request): string {
    return req.gate?.tenant?.id || req.gate?.user?.tenantId || 'tenant-rlyc-default';
  }

  // Validate if Regatta Room Code exists and is active (used by spectator and join inputs)
  app.get('/api/rooms/:code/validate', (req, res) => {
    const rawCode = req.params.code || '';
    const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!code) {
      return res.status(400).json({ valid: false, exists: false, error: 'Please enter a regatta room code.' });
    }

    const room = getOrLoadRoom(code, false);
    if (!room) {
      return res.status(404).json({
        valid: false,
        exists: false,
        error: `Regatta room code "${code}" does not exist. Please check the code and try again.`,
      });
    }

    res.json({
      valid: true,
      exists: true,
      room: {
        code: room.code,
        title: room.title,
        locationName: room.locationName,
        tenantName: room.tenantName,
        isPublic: room.isPublic,
        boatCount: room.boats.length,
        raceStatus: room.raceState?.status || 'PRE_START',
      },
    });
  });

  // Get Room Details (Spectators can view public rooms without login!)
  app.get('/api/rooms/:code', (req, res) => {
    const code = req.params.code.trim().toUpperCase();
    const room = getOrLoadRoom(code, false);
    if (!room) {
      return res.status(404).json({ error: 'Event not found. Invalid regatta room code.' });
    }

    const user = req.gate?.user;
    const isOwner = !!(user && room.ownerId === user.id);
    const accountRole = resolveRoomRole(roomRoleUserFromGate(req), room);
    const isAdmin = accountRole === 'ADMIN';
    const canEdit = canEditRoom(accountRole);

    res.json({
      success: true,
      connectedClients: getRoomClientCount(room.code),
      room: {
        code: room.code,
        title: room.title,
        locationName: room.locationName,
        tenantId: room.tenantId,
        tenantName: room.tenantName,
        isPublic: room.isPublic,
        ownerId: room.ownerId,
        ownerName: room.ownerName,
        isOwner,
        isAdmin,
        canEdit,
        raceState: room.raceState,
        marks: room.marks,
        boats: room.boats,
        trackers: Array.from(room.trackers.values()),
        vhfBulletins: room.vhfBulletins,
        seriesRaces: room.seriesRaces || [],
        createdAt: room.createdAt,
        lastActive: room.lastActive,
      },
    });
  });

  /**
   * Verify Admin PIN vs Participant PIN
   */
  app.post('/api/rooms/:code/verify-pin', (req, res) => {
    const code = req.params.code.trim().toUpperCase();
    const room = getOrLoadRoom(code, false);
    if (!room) {
      return res.status(404).json({ error: 'Event not found', valid: false });
    }

    const user = req.gate?.user;
    if (user && room.ownerId === user.id) {
      return res.json({ success: true, valid: true, code: room.code, isOwner: true, isAdmin: true, isParticipant: true, canEdit: true });
    }

    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    const client = clientAddress(req.headers, req.socket.remoteAddress);
    if (pin && isPinLocked(client, room.code)) {
      return res.status(429).json({ success: false, valid: false, error: 'Too many wrong PINs for this room. Try again in 15 minutes.' });
    }
    const role = resolveRoomRole(roomRoleUserFromGate(req), room, checkedPin(client, room, pin));
    const isAdmin = role === 'ADMIN';
    const isParticipant = role !== 'SPECTATOR';

    res.json({
      success: true,
      valid: isAdmin || isParticipant,
      code: room.code,
      isAdmin,
      isParticipant,
      canEdit: canEditRoom(role),
      isOwner: false,
    });
  });

  /**
   * Room PINs for people who may edit the room: Race Officers print boat QR cards with the
   * participant PIN; only room admins also get the admin PIN back.
   */
  app.get('/api/rooms/:code/pins', (req, res) => {
    const room = getOrLoadRoom(req.params.code.trim().toUpperCase(), false);
    if (!room) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const role = requestRoomRole(req, room);
    if (!canEditRoom(role)) {
      return res.status(403).json({ error: 'Only Race Officers and room admins can see room PINs.' });
    }
    res.json({
      success: true,
      roomCode: room.code,
      participantPin: room.participantPin || '',
      ...(role === 'ADMIN' ? { adminPin: room.adminPin } : {}),
    });
  });

  /**
   * Store-and-Forward Batch Telemetry Ingestion (Android & Web)
   */
  app.post('/api/session/gps/batch', (req, res) => {
    const room = resolveRoom(req);
    if (requestRoomRole(req, room) === 'SPECTATOR') {
      return res.status(403).json({ error: 'Send the room\'s skipper PIN (x-admin-pin header) or sign in to send positions.' });
    }
    const payload = req.body;
    const platform = extractPlatform(req);

    if (payload && payload.deviceId && Array.isArray(payload.points) && payload.points.length > 0) {
      // As on the WebSocket: the boat comes from the room's binding, never from the request.
      // A relayed LoRa tracker must be a Meshtastic node bound to a boat in this room.
      if (payload.relayedBy) {
        if (nodeNumFromId(payload.deviceId) === null) {
          return res.status(403).json({ error: 'This tracker is not bound to a boat in this room.', reason: 'NOT_RELAYABLE' });
        }
        payload.deviceId = canonicalNodeId(payload.deviceId);
      }
      payload.boundBoatId = boundBoatIdFor(room, payload.deviceId);
      if (payload.relayedBy && !payload.boundBoatId) {
        return res.status(403).json({ error: 'This tracker is not bound to a boat in this room.', reason: 'NOT_RELAYABLE' });
      }

      const existing = room.trackers.get(payload.deviceId) || {};
      const existingTrail = existing.trail || [];
      const newCoords = payload.points.map((p: any) => ({ lat: p.lat, lng: p.lng }));
      const mergedTrail = [...existingTrail, ...newCoords].slice(-2000);
      const lastPoint = payload.points[payload.points.length - 1];

      const updatedTracker = {
        ...existing,
        ...payload,
        lat: lastPoint.lat,
        lng: lastPoint.lng,
        speedKt: lastPoint.speedKt ?? existing.speedKt ?? 0,
        headingDeg: lastPoint.headingDeg ?? existing.headingDeg ?? 0,
        trail: mergedTrail,
        lastSeen: lastPoint.timestamp || Date.now(),
        isOnline: true,
      };
      room.trackers.set(payload.deviceId, updatedTracker);

      const targetBoatId = payload.boundBoatId;
      if (targetBoatId && Array.isArray(room.boats)) {
        room.boats = room.boats.map((b: any) => {
          // Only the bound boat: another boat still naming this tracker (a stale nodeId) stays put
          if (b.id === targetBoatId) {
            const oldBoatTrail = b.trail || [];
            return {
              ...b,
              lat: lastPoint.lat,
              lng: lastPoint.lng,
              sog: lastPoint.speedKt ?? b.sog,
              cog: lastPoint.headingDeg ?? b.cog,
              heading: lastPoint.headingDeg ?? b.heading,
              trail: [...oldBoatTrail, ...newCoords].slice(-2000),
            };
          }
          return b;
        });
        broadcastAllInRoom(room.code, 'BOATS_UPDATED', room.boats);
        persistRoom(room);
      }

      broadcastAllInRoom(room.code, 'TRACKER_BATCH_BACKFILL', {
        deviceId: payload.deviceId,
        deviceName: payload.deviceName,
        boundBoatId: targetBoatId,
        points: payload.points,
        tracker: updatedTracker,
      });

      console.log(`[Store-and-Forward (${platform})] Ingested ${payload.points.length} fixes for ${payload.deviceId} in room ${room.code}`);
      res.json({ success: true, count: payload.points.length, roomCode: room.code });
    } else {
      res.status(400).json({ error: 'Invalid batch points payload' });
    }
  });

  // REST API Routes for marks, boats, racestate
  app.get('/api/session/state', (req, res) => {
    const room = resolveRoom(req);
    res.json({
      sessionId: `regatta-room-${room.code}`,
      roomCode: room.code,
      title: room.title,
      locationName: room.locationName,
      tenantId: room.tenantId,
      tenantName: room.tenantName,
      connectedClients: getRoomClientCount(room.code),
      raceState: room.raceState,
      marks: room.marks,
      boats: room.boats,
      raceClasses: room.raceClasses,
      trackers: Array.from(room.trackers.values()),
      vhfBulletins: room.vhfBulletins,
      seriesRaces: room.seriesRaces || [],
      serverTime: Date.now(),
    });
  });

  app.get('/api/session/marks', (req, res) => {
    const room = resolveRoom(req);
    res.json({ marks: room.marks, roomCode: room.code });
  });

  app.get('/api/session/boats', (req, res) => {
    const room = resolveRoom(req);
    res.json({ boats: room.boats, roomCode: room.code });
  });

  app.post('/api/session/marks', (req, res) => {
    const room = resolveRoom(req);
    if (!canEditRoom(requestRoomRole(req, room))) {
      return res.status(403).json({ error: 'Unauthorized: Admin PIN or Organization Admin role required.' });
    }

    const payload = req.body?.marks || req.body;
    if (Array.isArray(payload)) {
      room.marks = payload;
      broadcastAllInRoom(room.code, 'MARKS_UPDATED', payload);
      persistRoom(room);
      res.json({ success: true, count: room.marks.length, roomCode: room.code });
    } else {
      res.status(400).json({ error: 'Payload must be an array of marks' });
    }
  });

  app.post('/api/session/boats', (req, res) => {
    const room = resolveRoom(req);
    if (!canEditRoom(requestRoomRole(req, room))) {
      return res.status(403).json({ error: 'Unauthorized: Admin PIN or Organization Admin role required.' });
    }

    const payload = req.body?.boats || req.body;
    if (Array.isArray(payload)) {
      room.boats = payload;
      broadcastAllInRoom(room.code, 'BOATS_UPDATED', payload);
      persistRoom(room);
      res.json({ success: true, count: room.boats.length, roomCode: room.code });
    } else {
      res.status(400).json({ error: 'Payload must be an array of boats' });
    }
  });

  app.post('/api/session/racestate', (req, res) => {
    const room = resolveRoom(req);
    if (!canEditRoom(requestRoomRole(req, room))) {
      return res.status(403).json({ error: 'Unauthorized: Admin PIN or Organization Admin role required.' });
    }

    const payload = req.body;
    if (payload && typeof payload === 'object') {
      room.raceState = { ...room.raceState, ...payload, updatedAt: Date.now() };
      broadcastAllInRoom(room.code, 'RACE_STATE_UPDATED', room.raceState);
      persistRoom(room);
      res.json({ success: true, raceState: room.raceState, roomCode: room.code });
    } else {
      res.status(400).json({ error: 'Invalid race state payload' });
    }
  });

  // Meshtastic MQTT settings for a room. Everyone in the room can see the status and which
  // channels are bridged; only editors see/change broker and channel settings. Passwords and
  // channel keys are write-only.
  app.get('/api/session/mqtt', (req, res) => {
    const room = resolveRoom(req);
    const canEdit = canEditRoom(requestRoomRole(req, room));
    const pub = toPublicConfig(room.mqttConfig);
    res.json({
      roomCode: room.code,
      canEdit,
      config: canEdit ? pub : { enabled: pub.enabled, rootTopic: pub.rootTopic, channels: pub.channels.map((c) => ({ name: c.name, keyKind: c.keyKind })) },
      status: mqttBridge.getStatus(room.code),
    });
  });

  app.put('/api/session/mqtt', (req, res) => {
    const room = resolveRoom(req);
    if (!canEditRoom(requestRoomRole(req, room))) {
      return res.status(403).json({ error: 'Only the race office can change MQTT settings for this event.' });
    }
    let next: RoomMqttConfig;
    try {
      next = mergeRoomMqttConfig(room.mqttConfig, req.body?.config ?? req.body, {
        allowAnyBroker: process.env.MQTT_ALLOW_ANY_BROKER === '1',
      });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Invalid MQTT settings' });
    }
    room.mqttConfig = next;
    persistRoomMqttConfig(room);
    mqttBridge.setRoomConfig(room.code, next);
    refreshRoomActivity(room.code);
    res.json({ roomCode: room.code, canEdit: true, config: toPublicConfig(next), status: mqttBridge.getStatus(room.code) });
  });

  app.post('/api/session/classes', (req, res) => {
    const room = resolveRoom(req);
    if (!canEditRoom(requestRoomRole(req, room))) {
      return res.status(403).json({ error: 'Unauthorized: Admin PIN or Organization Admin role required.' });
    }

    const classes = sanitizeRaceClasses(req.body?.raceClasses || req.body);
    if (classes) {
      room.raceClasses = classes;
      broadcastAllInRoom(room.code, 'CLASSES_UPDATED', classes);
      persistRoom(room);
      res.json({ success: true, count: classes.length, roomCode: room.code });
    } else {
      res.status(400).json({ error: `Payload must be 1-${MAX_RACE_CLASSES} race classes, each with an id and a name` });
    }
  });

  app.post('/api/session/series', (req, res) => {
    const room = resolveRoom(req);
    if (!canEditRoom(requestRoomRole(req, room))) {
      return res.status(403).json({ error: 'Unauthorized: Admin PIN or Organization Admin role required.' });
    }

    const payload = req.body?.seriesRaces || req.body;
    if (Array.isArray(payload)) {
      room.seriesRaces = payload;
      broadcastAllInRoom(room.code, 'SERIES_RACES_UPDATED', payload);
      persistRoom(room);
      res.json({ success: true, count: room.seriesRaces.length, roomCode: room.code });
    } else {
      res.status(400).json({ error: 'Payload must be an array of series races' });
    }
  });

  // ==========================================
  // PUBLIC PRICING PACKAGES API
  // ==========================================
  app.get('/api/packages', (req, res) => {
    try {
      const pkgs = getAllPackages(false);
      res.json({ success: true, packages: pkgs });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch packages: ' + e.message });
    }
  });

  // ==========================================
  // SUPER ADMIN MASTER MANAGEMENT SUITE
  // ==========================================

  // 1. Overview & System Telemetry
  app.get('/api/super-admin/overview', requireSuperAdmin(), (req, res) => {
    try {
      const dbStats = getDatabaseStats();
      const clients = Array.from(wss.clients);
      const activeSocketsCount = clients.filter(c => c.readyState === WebSocket.OPEN).length;

      const activeRoomsSummary = Array.from(activeRooms.values()).map(r => ({
        code: r.code,
        title: r.title,
        tenantId: r.tenantId,
        tenantName: r.tenantName,
        boatCount: r.boats.length,
        markCount: r.marks.length,
        raceStatus: r.raceState?.status || 'PRE_START',
        activeClients: clients.filter(c => (c as any).roomCode === r.code && c.readyState === WebSocket.OPEN).length,
        lastActive: r.lastActive,
      }));

      res.json({
        success: true,
        stats: {
          clubsCount: dbStats.clubsCount,
          usersCount: dbStats.usersCount,
          eventsCount: dbStats.eventsCount,
          packagesCount: dbStats.packagesCount,
          auditLogsCount: dbStats.auditLogsCount,
          activeSocketsCount,
          activeRoomsCount: activeRooms.size,
          database: dbStats,
        },
        activeRooms: activeRoomsSummary,
        serverTime: Date.now(),
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch super admin overview: ' + e.message });
    }
  });

  // 2. Package & Pricing Management
  app.get('/api/super-admin/packages', requireSuperAdmin(), (req, res) => {
    try {
      const packages = getAllPackages(true);
      res.json({ success: true, packages });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch packages: ' + e.message });
    }
  });

  app.post('/api/super-admin/packages', requireSuperAdmin(), (req, res) => {
    try {
      const created = createPackage(req.body);
      insertAuditLog({
        tenantId: req.gate?.tenant?.id || 'system',
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_PACKAGE_CREATED',
        details: { packageId: created.id, tierKey: created.tierKey, price: created.priceAmount },
      });
      broadcastGlobal('PACKAGES_UPDATED', { action: 'CREATED', package: created });
      res.json({ success: true, package: created });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to create package: ' + e.message });
    }
  });

  app.put('/api/super-admin/packages/:id', requireSuperAdmin(), (req, res) => {
    try {
      const updated = updatePackage(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Package not found' });
      }
      insertAuditLog({
        tenantId: req.gate?.tenant?.id || 'system',
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_PACKAGE_UPDATED',
        details: { packageId: updated.id, tierKey: updated.tierKey, price: updated.priceAmount },
      });
      broadcastGlobal('PACKAGES_UPDATED', { action: 'UPDATED', package: updated });
      res.json({ success: true, package: updated });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to update package: ' + e.message });
    }
  });

  app.delete('/api/super-admin/packages/:id', requireSuperAdmin(), (req, res) => {
    try {
      deletePackage(req.params.id);
      insertAuditLog({
        tenantId: req.gate?.tenant?.id || 'system',
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_PACKAGE_DELETED',
        details: { packageId: req.params.id },
      });
      broadcastGlobal('PACKAGES_UPDATED', { action: 'DELETED', packageId: req.params.id });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to delete package: ' + e.message });
    }
  });

  // 3. Global User Management
  app.get('/api/super-admin/users', requireSuperAdmin(), (req, res) => {
    try {
      const q = ((req.query.q as string) || '').trim().toLowerCase();
      const role = (req.query.role as string) || '';

      let sql = `
        SELECT u.id, u.tenant_id, u.email, u.username, u.full_name, u.sailing_club,
               u.sail_number, u.handicap_rating, u.role, u.participant_type, u.status,
               u.is_super_admin, u.created_at, t.name as tenant_name, t.plan_tier
        FROM users u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (q) {
        sql += ` AND (LOWER(u.email) LIKE ? OR LOWER(u.username) LIKE ? OR LOWER(u.full_name) LIKE ? OR LOWER(u.sailing_club) LIKE ?)`;
        const wild = `%${q}%`;
        params.push(wild, wild, wild, wild);
      }

      if (role) {
        sql += ` AND u.role = ?`;
        params.push(role.toUpperCase());
      }

      sql += ` ORDER BY u.created_at DESC`;
      const rows = (db.prepare(sql).all(...params) as any[])
        .filter((r) => !role || r.role === role.toUpperCase())
        .filter((r) => !q || [r.email, r.username, r.full_name, r.sailing_club].some((v) => (v || '').toLowerCase().includes(q)))
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

      const users = rows.map(r => ({
        id: r.id,
        tenantId: r.tenant_id,
        tenantName: r.tenant_name || 'Independent',
        planTier: r.plan_tier || 'FREE',
        email: r.email,
        username: r.username,
        fullName: r.full_name,
        sailingClub: r.sailing_club,
        sailNumber: r.sail_number,
        handicapRating: r.handicap_rating,
        role: r.role,
        participantType: r.participant_type,
        status: r.status,
        isSuperAdmin: !!r.is_super_admin,
        createdAt: r.created_at,
      }));

      res.json({ success: true, count: users.length, users });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch users: ' + e.message });
    }
  });

  app.put('/api/super-admin/users/:id', requireSuperAdmin(), (req, res) => {
    try {
      const userId = req.params.id;
      const {
        fullName,
        email,
        role,
        participantType,
        status,
        tenantId,
        sailingClub,
        sailNumber,
        handicapRating,
        isSuperAdmin,
        newPassword,
      } = req.body || {};

      const fields: string[] = [];
      const values: any[] = [];

      if (fullName !== undefined) { fields.push('full_name = ?'); values.push(fullName.trim()); }
      if (email !== undefined) { fields.push('email = ?'); values.push(email.trim().toLowerCase()); }
      if (role !== undefined) { fields.push('role = ?'); values.push(role); }
      if (participantType !== undefined) { fields.push('participant_type = ?'); values.push(participantType); }
      if (status !== undefined) { fields.push('status = ?'); values.push(status); }
      if (tenantId !== undefined) { fields.push('tenant_id = ?'); values.push(tenantId); }
      if (sailingClub !== undefined) { fields.push('sailing_club = ?'); values.push(sailingClub.trim()); }
      if (sailNumber !== undefined) { fields.push('sail_number = ?'); values.push(sailNumber.trim()); }
      if (handicapRating !== undefined) { fields.push('handicap_rating = ?'); values.push(handicapRating.trim()); }
      if (isSuperAdmin !== undefined) { fields.push('is_super_admin = ?'); values.push(isSuperAdmin ? 1 : 0); }
      if (newPassword && newPassword.trim()) {
        fields.push('password_hash = ?');
        values.push(hashPassword(newPassword.trim()));
      }

      if (fields.length > 0) {
        values.push(userId);
        db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }

      // A new password or a non-active status signs the user out everywhere
      // (keeping this device signed in when admins change their own password).
      if ((newPassword && newPassword.trim()) || (status !== undefined && status !== 'ACTIVE')) {
        endAllSessionsForUser(userId, req.gate?.user?.id === userId ? extractRequestToken(req) : undefined);
      }

      const updatedRow = db.prepare(`
        SELECT u.*, t.name as tenant_name, t.plan_tier 
        FROM users u 
        LEFT JOIN tenants t ON u.tenant_id = t.id 
        WHERE u.id = ?
      `).get(userId) as any;

      insertAuditLog({
        tenantId: updatedRow?.tenant_id || 'system',
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_USER_UPDATED',
        details: { targetUserId: userId, targetEmail: updatedRow?.email, changes: req.body },
      });

      res.json({
        success: true,
        user: {
          id: updatedRow.id,
          tenantId: updatedRow.tenant_id,
          tenantName: updatedRow.tenant_name,
          email: updatedRow.email,
          username: updatedRow.username,
          fullName: updatedRow.full_name,
          role: updatedRow.role,
          status: updatedRow.status,
          isSuperAdmin: !!updatedRow.is_super_admin,
          sailingClub: updatedRow.sailing_club,
          sailNumber: updatedRow.sail_number,
          handicapRating: updatedRow.handicap_rating,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to update user: ' + e.message });
    }
  });

  app.delete('/api/super-admin/users/:id', requireSuperAdmin(), (req, res) => {
    try {
      const userId = req.params.id;
      if (req.gate?.user?.id === userId) {
        return res.status(400).json({ error: 'You cannot delete your currently authenticated Super Admin account.' });
      }

      const existing = db.prepare('SELECT email, tenant_id FROM users WHERE id = ?').get(userId) as any;
      if (!existing) {
        return res.status(404).json({ error: 'User not found' });
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      endAllSessionsForUser(userId);

      insertAuditLog({
        tenantId: existing.tenant_id || 'system',
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_USER_DELETED',
        details: { deletedUserId: userId, deletedEmail: existing.email },
      });

      res.json({ success: true, deletedUserId: userId });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to delete user: ' + e.message });
    }
  });

  // 4. Global Club / Organization Management
  app.get('/api/super-admin/clubs', requireSuperAdmin(), (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT t.*, u.email as owner_email, u.full_name as owner_name,
               (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as members_count,
               (SELECT COUNT(*) FROM events WHERE tenant_id = t.id) as events_count
        FROM tenants t
        LEFT JOIN users u ON t.owner_id = u.id
        ORDER BY t.created_at DESC
      `).all() as any[];

      const clubs = rows.map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        ownerId: r.owner_id,
        ownerEmail: r.owner_email,
        ownerName: r.owner_name,
        planTier: r.plan_tier,
        maxActiveRooms: r.max_active_rooms,
        maxBoatsPerRoom: r.max_boats_per_room,
        maxAdminSeats: r.max_admin_seats,
        loraPriority: !!r.lora_priority,
        customBranding: !!r.custom_branding,
        membersCount: r.members_count || 0,
        eventsCount: r.events_count || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      res.json({ success: true, count: clubs.length, clubs });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch clubs: ' + e.message });
    }
  });

  app.put('/api/super-admin/clubs/:id', requireSuperAdmin(), (req, res) => {
    try {
      const clubId = req.params.id;
      const { name, planTier, maxActiveRooms, maxBoatsPerRoom, maxAdminSeats, loraPriority, customBranding } = req.body || {};

      const fields: string[] = [];
      const values: any[] = [];

      if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
      if (planTier !== undefined) { fields.push('plan_tier = ?'); values.push(planTier.toUpperCase()); }
      if (maxActiveRooms !== undefined) { fields.push('max_active_rooms = ?'); values.push(Number(maxActiveRooms)); }
      if (maxBoatsPerRoom !== undefined) { fields.push('max_boats_per_room = ?'); values.push(Number(maxBoatsPerRoom)); }
      if (maxAdminSeats !== undefined) { fields.push('max_admin_seats = ?'); values.push(Number(maxAdminSeats)); }
      if (loraPriority !== undefined) { fields.push('lora_priority = ?'); values.push(loraPriority ? 1 : 0); }
      if (customBranding !== undefined) { fields.push('custom_branding = ?'); values.push(customBranding ? 1 : 0); }

      fields.push('updated_at = ?');
      values.push(Date.now());
      values.push(clubId);

      db.prepare(`UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`).run(...values);

      const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(clubId) as any;

      insertAuditLog({
        tenantId: clubId,
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_CLUB_UPDATED',
        details: { clubId, changes: req.body },
      });

      res.json({ success: true, club: updated });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to update club: ' + e.message });
    }
  });

  app.delete('/api/super-admin/clubs/:id', requireSuperAdmin(), (req, res) => {
    try {
      const clubId = req.params.id;
      const existing = db.prepare('SELECT name FROM tenants WHERE id = ?').get(clubId) as any;
      if (!existing) {
        return res.status(404).json({ error: 'Club not found' });
      }

      // Delete associated events and active rooms
      const events = (db.prepare('SELECT code, tenant_id FROM events WHERE tenant_id = ?').all(clubId) as any[]).filter((ev) => ev.tenant_id === clubId);
      events.forEach((ev) => {
        activeRooms.delete(ev.code);
        mqttBridge.removeRoom(ev.code);
      });

      db.prepare('DELETE FROM tenants WHERE id = ?').run(clubId);

      insertAuditLog({
        tenantId: clubId,
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_CLUB_DELETED',
        details: { deletedClubId: clubId, clubName: existing.name },
      });

      res.json({ success: true, deletedClubId: clubId });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to delete club: ' + e.message });
    }
  });

  // 5. Global Event / Regatta Management
  app.get('/api/super-admin/events', requireSuperAdmin(), (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT e.*, t.name as tenant_name, t.plan_tier, u.email as owner_email, u.full_name as owner_name
        FROM events e
        LEFT JOIN tenants t ON e.tenant_id = t.id
        LEFT JOIN users u ON e.owner_id = u.id
        ORDER BY e.created_at DESC
      `).all() as any[];

      const clients = Array.from(wss.clients);

      const events = rows.map(r => {
        let boatCount = 0;
        let markCount = 0;
        try { boatCount = JSON.parse(r.boats_json || '[]').length; } catch {}
        try { markCount = JSON.parse(r.marks_json || '[]').length; } catch {}

        const activeClients = clients.filter(c => (c as any).roomCode === r.code && c.readyState === WebSocket.OPEN).length;

        return {
          id: r.id,
          code: r.code,
          title: r.title,
          locationName: r.location_name,
          tenantId: r.tenant_id,
          tenantName: r.tenant_name || 'Independent Club',
          ownerId: r.owner_id,
          ownerEmail: r.owner_email,
          ownerName: r.owner_name,
          isPublic: !!r.is_public,
          adminPin: r.admin_pin,
          participantPin: r.participant_pin,
          status: r.status,
          boatCount,
          markCount,
          activeClients,
          createdAt: r.created_at,
          lastActive: r.last_active,
        };
      });

      res.json({ success: true, count: events.length, events });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch global events: ' + e.message });
    }
  });

  app.delete('/api/super-admin/events/:id', requireSuperAdmin(), (req, res) => {
    try {
      const eventId = req.params.id;
      const row = db.prepare('SELECT code, tenant_id, title FROM events WHERE id = ? OR code = ?').get(eventId, eventId) as any;
      if (!row) {
        return res.status(404).json({ error: 'Event not found' });
      }

      db.prepare('DELETE FROM events WHERE id = ? OR code = ?').run(row.code, row.code);
      activeRooms.delete(row.code);
      mqttBridge.removeRoom(row.code);

      insertAuditLog({
        tenantId: row.tenant_id,
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_EVENT_DELETED',
        details: { deletedEventCode: row.code, eventTitle: row.title },
      });

      res.json({ success: true, deletedEventCode: row.code });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to delete event: ' + e.message });
    }
  });

  // Super Admin: Update Global Event Details (title, code, adminPin, participantPin, locationName, status, isPublic)
  app.put('/api/super-admin/events/:id', requireSuperAdmin(), (req, res) => {
    try {
      const eventId = req.params.id;
      const existing = db.prepare('SELECT * FROM events WHERE id = ? OR code = ?').get(eventId, eventId) as any;
      if (!existing) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const {
        title,
        code,
        adminPin,
        participantPin,
        locationName,
        status,
        isPublic,
      } = req.body || {};

      const newTitle = title !== undefined ? String(title).trim() : existing.title;
      const newCode = code !== undefined ? String(code).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') : existing.code;
      // A blank PIN field keeps the current PIN rather than clearing it
      const newAdminPin = adminPin !== undefined && String(adminPin).trim() ? String(adminPin).trim() : existing.admin_pin;
      const newParticipantPin = participantPin !== undefined && String(participantPin).trim() ? String(participantPin).trim() : existing.participant_pin;
      const newLocation = locationName !== undefined ? String(locationName).trim() : existing.location_name;
      const newStatus = status !== undefined ? String(status).trim() : existing.status;
      const newIsPublic = isPublic !== undefined ? (isPublic ? 1 : 0) : existing.is_public;

      if (!newTitle) return res.status(400).json({ error: 'Event title cannot be empty' });
      if (!newCode) return res.status(400).json({ error: 'Event code cannot be empty' });

      // If code changed, check uniqueness
      if (newCode !== existing.code) {
        const dup = db.prepare('SELECT id FROM events WHERE code = ? AND id != ?').get(newCode, existing.id);
        if (dup) {
          return res.status(409).json({ error: `Event code ${newCode} is already taken by another event` });
        }
      }

      db.prepare(`
        UPDATE events 
        SET title = ?, code = ?, admin_pin = ?, participant_pin = ?, location_name = ?, status = ?, is_public = ?, last_active = ?
        WHERE id = ?
      `).run(newTitle, newCode, newAdminPin, newParticipantPin, newLocation, newStatus, newIsPublic, Date.now(), existing.id);

      // If code changed, update activeRooms map in memory
      if (newCode !== existing.code && activeRooms.has(existing.code)) {
        const memRoom = activeRooms.get(existing.code);
        if (memRoom) {
          memRoom.code = newCode;
          memRoom.title = newTitle;
          memRoom.locationName = newLocation;
          memRoom.adminPin = newAdminPin;
          memRoom.participantPin = newParticipantPin;
          if (memRoom.raceState) {
            memRoom.raceState.name = newTitle;
            memRoom.raceState.locationName = newLocation;
          }
          activeRooms.set(newCode, memRoom);
          activeRooms.delete(existing.code);
          // The bridge keys rooms by code: move it to the new one
          mqttBridge.removeRoom(existing.code);
          mqttBridge.setRoomConfig(newCode, memRoom.mqttConfig);
          refreshRoomActivity(newCode);
        }
      } else if (activeRooms.has(newCode)) {
        const memRoom = activeRooms.get(newCode);
        if (memRoom) {
          memRoom.title = newTitle;
          memRoom.locationName = newLocation;
          // Keep the live room in step, or its next save would write the old PINs back
          memRoom.adminPin = newAdminPin;
          memRoom.participantPin = newParticipantPin;
          if (memRoom.raceState) {
            memRoom.raceState.name = newTitle;
            memRoom.raceState.locationName = newLocation;
          }
        }
      }

      syncStoreJson();

      insertAuditLog({
        tenantId: existing.tenant_id,
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_EVENT_UPDATED',
        details: {
          eventId: existing.id,
          oldCode: existing.code,
          newCode,
          title: newTitle,
          adminPinUpdated: newAdminPin !== existing.admin_pin,
          participantPinUpdated: newParticipantPin !== existing.participant_pin,
        },
      });

      broadcastGlobal('EVENT_UPDATED', {
        code: newCode,
        oldCode: existing.code,
        title: newTitle,
        locationName: newLocation,
        status: newStatus,
        isPublic: !!newIsPublic,
      });

      const updatedRow = db.prepare('SELECT * FROM events WHERE id = ?').get(existing.id) as any;
      res.json({
        success: true,
        event: {
          id: updatedRow.id,
          tenantId: updatedRow.tenant_id,
          code: updatedRow.code,
          title: updatedRow.title,
          locationName: updatedRow.location_name,
          adminPin: updatedRow.admin_pin,
          participantPin: updatedRow.participant_pin,
          isPublic: !!updatedRow.is_public,
          status: updatedRow.status,
          createdAt: updatedRow.created_at,
          lastActive: updatedRow.last_active,
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to update event: ' + e.message });
    }
  });

  // 6. Active Socket Telemetry Monitor
  app.get('/api/super-admin/sockets', requireSuperAdmin(), (req, res) => {
    try {
      const now = Date.now();
      const list: any[] = [];

      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          const c = client as any;
          list.push({
            id: c.id || 'sock-' + Math.random().toString(36).substring(2, 8),
            roomCode: c.roomCode || 'UNKNOWN',
            userId: c.userId || null,
            userEmail: c.userEmail || null,
            userName: c.userName || 'Anonymous',
            userRole: c.userRole || 'SPECTATOR',
            tenantId: c.tenantId || null,
            tenantName: c.tenantName || null,
            isAdmin: !!c.isAdmin,
            connectedAt: c.connectedAt || now,
            uptimeSeconds: Math.floor((now - (c.connectedAt || now)) / 1000),
            remoteAddress: c.remoteAddress || '127.0.0.1',
            platform: c.platform || 'WEB',
          });
        }
      });

      res.json({ success: true, count: list.length, sockets: list });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to query active sockets: ' + e.message });
    }
  });

  // 7. Global System Audit Logs
  app.get('/api/super-admin/audit-logs', requireSuperAdmin(), (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 300);
      const rows = db.prepare(`
        SELECT a.*, t.name as tenant_name 
        FROM audit_logs a
        LEFT JOIN tenants t ON a.tenant_id = t.id
        ORDER BY a.timestamp DESC 
        LIMIT ?
      `).all(limit) as any[];

      const logs = rows.map(r => {
        let details = {};
        try { details = JSON.parse(r.details_json || '{}'); } catch {}
        return {
          id: r.id,
          tenantId: r.tenant_id,
          tenantName: r.tenant_name || 'System',
          eventId: r.event_id,
          roomCode: r.room_code,
          userId: r.user_id,
          userEmail: r.user_email,
          userRole: r.user_role,
          action: r.action,
          platform: r.platform,
          details,
          timestamp: r.timestamp,
        };
      });

      res.json({ success: true, count: logs.length, logs });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to fetch audit logs: ' + e.message });
    }
  });

  // 8. Database Backup & JSON Export
  app.get('/api/super-admin/backup/export', requireSuperAdmin(), (req, res) => {
    try {
      const format = (req.query.format as string || 'db').toLowerCase();
      const stats = getDatabaseStats();

      if (format === 'json') {
        const tenants = db.prepare('SELECT * FROM tenants').all();
        const users = db.prepare('SELECT id, tenant_id, email, username, full_name, sailing_club, sail_number, handicap_rating, role, participant_type, status, is_super_admin, created_at FROM users').all();
        const events = db.prepare('SELECT * FROM events').all();
        const packages = db.prepare('SELECT * FROM packages').all();
        const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 500').all();

        res.setHeader('Content-Disposition', `attachment; filename=tmtrac-database-export-${Date.now()}.json`);
        res.setHeader('Content-Type', 'application/json');
        return res.json({
          exportedAt: Date.now(),
          systemStats: stats,
          tenants,
          users,
          events,
          packages,
          auditLogs,
        });
      }

      // Download actual SQLite .db file
      if (fs.existsSync(stats.dbPath)) {
        res.download(stats.dbPath, `tmtrac-backup-${new Date().toISOString().slice(0, 10)}.db`);
      } else {
        res.status(404).json({ error: 'Database file not found at ' + stats.dbPath });
      }
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to export backup: ' + e.message });
    }
  });

  // Import / Restore Database from JSON
  app.post('/api/super-admin/backup/import', requireSuperAdmin(), (req, res) => {
    try {
      const data = req.body;
      const result = importDatabaseJson(data);
      insertAuditLog({
        tenantId: req.gate?.tenant?.id || 'system',
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_DATABASE_RESTORED',
        details: { importedCount: result.importedPackages },
      });
      broadcastGlobal('PACKAGES_UPDATED', { action: 'RESTORED' });
      res.json({ success: true, message: 'Database state successfully imported & synced', result });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to import database: ' + e.message });
    }
  });

  // 9. Database Connection & System Health Diagnostics
  app.get('/api/super-admin/database/status', requireSuperAdmin(), (req, res) => {
    const startHr = process.hrtime();
    try {
      // 1. Live connection ping query
      const pingRow = db.prepare('SELECT 1 as alive').get() as any;
      const diffHr = process.hrtime(startHr);
      const pingMs = Number(((diffHr[0] * 1e9 + diffHr[1]) / 1e6).toFixed(2));
      const isAlive = !!pingRow && (
        pingRow.alive === 1 ||
        pingRow.alive === '1' ||
        pingRow.alive === true ||
        pingRow.ALIVE === 1 ||
        pingRow.ALIVE === '1' ||
        pingRow.ALIVE === true ||
        Object.values(pingRow)[0] == 1 ||
        Object.keys(pingRow).length > 0
      );

      // 2. Database statistics
      const stats = getDatabaseStats();

      // 3. SQLite Pragmas
      let journalMode = 'unknown';
      let synchronous = 'unknown';
      let foreignKeys = false;
      let integrityCheck = 'unknown';
      let driver = dbDiagnosticsState.driverName;

      try {
        journalMode = String((db.pragma('journal_mode', { simple: true }) as any) || 'WAL');
        synchronous = String((db.pragma('synchronous', { simple: true }) as any) || 'NORMAL');
        foreignKeys = Boolean(db.pragma('foreign_keys', { simple: true }));
        integrityCheck = String((db.pragma('integrity_check', { simple: true }) as any) || 'ok');
      } catch (err: any) {
        driver = 'fallback-store';
        journalMode = 'MEMORY/JSON';
      }

      // 4. Detailed table counts with safe extraction
      const getCount = (tbl: string): number => {
        try {
          const r = db.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get() as any;
          if (!r) return 0;
          if (typeof r.c === 'number') return r.c;
          if (typeof r.C === 'number') return r.C;
          const v = Object.values(r)[0];
          return Number(v) || 0;
        } catch {
          return 0;
        }
      };

      const counts = {
        tenants: getCount('tenants'),
        users: getCount('users'),
        events: getCount('events'),
        event_trackers: getCount('event_trackers'),
        packages: getCount('packages'),
        audit_logs: getCount('audit_logs'),
      };

      res.json({
        success: true,
        connected: isAlive,
        pingMs,
        driver,
        isNative: dbDiagnosticsState.isNative,
        dbPath: dbDiagnosticsState.effectivePath,
        configuredPath: dbDiagnosticsState.configuredPath,
        fileSizeBytes: stats.fileSizeBytes,
        fileSizeMb: stats.fileSizeMb,
        journalMode,
        synchronous,
        foreignKeys,
        integrityCheck,
        lastModified: stats.lastModified,
        initError: dbDiagnosticsState.initError,
        counts,
      });
    } catch (e: any) {
      res.status(500).json({
        success: false,
        connected: false,
        error: e.message,
      });
    }
  });

  // Comprehensive 8-Point Database & System Diagnostics
  app.get('/api/super-admin/database/diagnostics', requireSuperAdmin(), (req, res) => {
    try {
      const diagnostics = getComprehensiveDiagnostics();
      res.json({
        success: true,
        diagnostics: diagnostics.checks,
        checks: diagnostics.checks,
        overallStatus: diagnostics.overallStatus,
        environment: diagnostics.environment,
        storage: diagnostics.storage,
        counts: diagnostics.counts,
      });
    } catch (e: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to run database diagnostics: ' + e.message,
      });
    }
  });

  // Automated Database Self-Repair & Table Integrity Restoration
  app.post('/api/super-admin/database/repair', requireSuperAdmin(), (req, res) => {
    try {
      const result = repairDatabase();
      insertAuditLog({
        tenantId: req.gate?.tenant?.id || 'system',
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_DATABASE_REPAIRED',
        details: { result },
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: 'Database repair failed: ' + e.message });
    }
  });

  // Database Optimize / VACUUM
  app.post('/api/super-admin/database/optimize', requireSuperAdmin(), (req, res) => {
    try {
      const startHr = process.hrtime();
      try {
        db.exec('VACUUM; ANALYZE;');
      } catch (e) {}
      const diffHr = process.hrtime(startHr);
      const durationMs = Number(((diffHr[0] * 1e9 + diffHr[1]) / 1e6).toFixed(1));
      const stats = getDatabaseStats();

      insertAuditLog({
        tenantId: req.gate?.tenant?.id || 'system',
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_DATABASE_OPTIMIZED',
        details: { durationMs, newFileSizeMb: stats.fileSizeMb },
      });

      res.json({
        success: true,
        message: `Database vacuumed and re-indexed in ${durationMs}ms`,
        durationMs,
        stats,
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to optimize database: ' + e.message });
    }
  });

  // 10. Super Admin: Recycle Phusion Passenger Node.js Worker Process
  app.post('/api/super-admin/system/restart', requireSuperAdmin(), (req, res) => {
    try {
      const appDir = process.env.APP_DIR || process.cwd();
      const tmpDir = path.join(appDir, 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true, mode: 0o755 });
      }
      const restartFile = path.join(tmpDir, 'restart.txt');
      const nowIso = new Date().toISOString();
      const stamp = `Passenger restart requested by super-admin at ${nowIso}\n`;
      fs.writeFileSync(restartFile, stamp, 'utf-8');

      // Also touch mtime on restartFile
      try {
        const now = new Date();
        fs.utimesSync(restartFile, now, now);
      } catch (e) {}

      insertAuditLog({
        tenantId: req.gate?.tenant?.id || 'system',
        userId: req.gate?.user?.id,
        userEmail: req.gate?.user?.email,
        userRole: 'SUPER_ADMIN',
        action: 'SUPERADMIN_SERVER_RESTART_REQUESTED',
        details: { restartFile, timestamp: Date.now() },
      });

      console.log(`[TMTRAC] Passenger reload requested via API. Updated ${restartFile}`);

      res.json({
        success: true,
        message: 'Restart trigger written to tmp/restart.txt. Passenger worker is recycling to load latest server bundle.',
        restartFile,
        timestamp: nowIso,
      });

      // Allow response to flush over network, then exit gracefully so Passenger spawns fresh worker
      setTimeout(() => {
        console.log('[TMTRAC] Exiting worker process so Passenger immediately boots fresh process...');
        process.exit(0);
      }, 500);
    } catch (e: any) {
      console.error('[TMTRAC] Failed to trigger restart:', e);
      res.status(500).json({ error: 'Failed to trigger server restart: ' + e.message });
    }
  });

  // Deployment package downloads are for the AI Studio dev preview only; on the live site they
  // would hand anyone the server bundle, so production never registers them
  if (isDevMode) {
    app.get(['/download/cpanel-fullstack', '/tmtrac-cpanel-deployment.zip'], (req, res) => {
      const filePath = path.join(process.cwd(), 'tmtrac-cpanel-deployment.zip');
      res.download(filePath, 'tmtrac-cpanel-deployment.zip');
    });

    app.get(['/download/cpanel-update', '/tmtrac-update-only.zip'], (req, res) => {
      const filePath = path.join(process.cwd(), 'tmtrac-update-only.zip');
      res.download(filePath, 'tmtrac-update-only.zip');
    });

    app.get(['/download/public-html', '/tmtrac-public_html.zip'], (req, res) => {
      const filePath = path.join(process.cwd(), 'tmtrac-public_html.zip');
      res.download(filePath, 'tmtrac-public_html.zip');
    });
  }

  // Android Universal Links / Digital Asset Links
  app.get('/.well-known/assetlinks.json', (req, res) => {
    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'my.tmtrac.app',
          sha256_cert_fingerprints: [
            '14:6D:E9:75:5F:52:AB:EB:85:40:5E:24:9C:25:2A:44:A2:81:4A:8C:87:6C:54:1B:32:04:88:5A:F3:37:A1:01',
          ],
        },
      },
    ]);
  });

  // Vite middleware in dev vs static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // SPA fallback in development mode
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api') || url.startsWith('/ws') || url.startsWith('/download') || url.startsWith('/.well-known')) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        if (fs.existsSync(indexPath)) {
          let template = fs.readFileSync(indexPath, 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } else {
          next();
        }
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // dist/ also holds the server bundle, its source map and the deploy package.json: never serve them
    app.use((req, res, next) => {
      let p = req.path;
      try {
        p = decodeURIComponent(p);
      } catch {
        res.status(400).end();
        return;
      }
      if (/(^|\/)(server\.cjs|production-package\.json)$/i.test(p) || /\.map$/i.test(p)) {
        res.status(404).end();
        return;
      }
      next();
    });
    app.use(express.static(distPath, { dotfiles: 'deny' }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Determine port and host for listening
  const isDev = process.env.NODE_ENV !== 'production';

  // Support Phusion Passenger socket in production, custom PORT, or default port 3000
  const bindHelper = (global as any).__bindToPassenger;
  if (!isDev && typeof bindHelper === 'function') {
    bindHelper(server, 'TMTRAC Server');
  } else if (!isDev && typeof (global as any).PhusionPassenger !== 'undefined') {
    server.listen('passenger', () => {
      console.log('TMTRAC Multi-Tenant Server running on Phusion Passenger socket');
    });
  } else {
    let cliPort: number | null = null;
    const portArgIndex = process.argv.findIndex((a) => a === '--port' || a === '-p');
    if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
      const p = Number(process.argv[portArgIndex + 1]);
      if (!isNaN(p) && p > 0) cliPort = p;
    }
    // In dev mode, strictly bind to port 3000 per AI Studio container iframe requirements
    const listenPort = cliPort || (isDev ? 3000 : (Number(process.env.PORT) || 3000));

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[TMTRAC Server] Port ${listenPort} temporarily busy. Retrying in 500ms...`);
        setTimeout(() => {
          server.close();
          server.listen(listenPort, '0.0.0.0');
        }, 500);
      } else {
        console.error('[TMTRAC Server] Server listener error:', err);
      }
    });

    server.listen(listenPort, '0.0.0.0', () => {
      console.log(`TMTRAC Multi-Tenant Server running on http://0.0.0.0:${listenPort} (Mode: ${isDev ? 'DEVELOPMENT (Port 3000)' : 'PRODUCTION'})`);
    });
  }
}

// Global process shields to keep dev server resilient against unhandled network/db disconnects
process.on('uncaughtException', (err) => {
  console.error('[TMTRAC Server] Handled Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[TMTRAC Server] Handled Unhandled Rejection:', reason);
});

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
