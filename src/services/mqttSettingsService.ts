// Reads and changes the current room's Meshtastic MQTT settings on the server (src/server/mqttBridge.ts).
// Broker passwords and channel keys are write-only: the server never sends them back.
import { authService } from './authService';
import { roomService } from './roomService';
import type { MqttBridgeStatus } from './meshtasticBleMqttService';

export type ChannelKeyKind = 'public' | 'custom' | 'none';

export interface RoomMqttSettings {
  enabled: boolean;
  /** Empty = the public Meshtastic broker */
  brokerUrl?: string;
  usesPublicBroker?: boolean;
  username?: string;
  hasPassword?: boolean;
  rootTopic: string;
  channels: Array<{ name: string; keyKind: ChannelKeyKind }>;
}

export interface RoomMqttResponse {
  roomCode: string;
  canEdit: boolean;
  config: RoomMqttSettings;
  status: MqttBridgeStatus;
}

/** What an editor sends. Leave `password` or a channel's `psk` out to keep the stored value. */
export interface RoomMqttUpdate {
  enabled?: boolean;
  brokerUrl?: string;
  username?: string;
  password?: string;
  rootTopic?: string;
  channels?: Array<{ name: string; psk?: string }>;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { ...authService.getAuthHeaders(), 'Content-Type': 'application/json' };
  const room = roomService.getActiveRoomCode();
  h['x-regatta-room'] = room;
  const pin = roomService.getActiveRoomPin();
  if (pin) h['x-admin-pin'] = pin;
  return h;
}

async function parse(res: Response): Promise<RoomMqttResponse> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}`);
  return data as RoomMqttResponse;
}

export async function fetchRoomMqtt(): Promise<RoomMqttResponse> {
  const room = roomService.getActiveRoomCode();
  return parse(await fetch(`/api/session/mqtt?room=${encodeURIComponent(room)}`, { headers: headers() }));
}

export async function updateRoomMqtt(update: RoomMqttUpdate): Promise<RoomMqttResponse> {
  const room = roomService.getActiveRoomCode();
  return parse(await fetch(`/api/session/mqtt?room=${encodeURIComponent(room)}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ config: update }),
  }));
}

/** Old browser-side MQTT settings held credentials in localStorage; remove them. */
export function clearLegacyMqttStorage() {
  try {
    ['tmtrac_mqtt_config_v2', 'tmtrac_mqtt_outbound_off_v1', 'tmtrac_my_mesh_config_v2'].forEach((k) => localStorage.removeItem(k));
  } catch {}
}
