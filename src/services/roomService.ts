import { RegattaRoom, RegattaRoomSummary, RaceState, CourseMark, Boat } from '../types/regatta';
import { authService } from './authService';

const ACTIVE_ROOM_KEY = 'regatta_active_room_code';
const ROOM_PINS_KEY_PREFIX = 'regatta_admin_pin_';

export type RoomChangeCallback = (roomCode: string, isOrganizer: boolean, roomInfo?: RegattaRoomSummary) => void;

class RoomService {
  private activeRoomCode: string = 'LOBBY';
  private isOrganizerRole: boolean = false;
  private isParticipantRole: boolean = false;
  // Set when the user deliberately joins as a spectator, so the app doesn't switch them into
  // the race console just because their account could edit the room.
  private spectatorByChoice: boolean = false;
  // PIN that unlocked the active room; the real-time socket needs it to get the same role as the UI
  private activeRoomPin: string = '';
  private currentRoomSummary: RegattaRoomSummary | null = null;
  private listeners: RoomChangeCallback[] = [];

  constructor() {
    this.initFromUrlOrStorage();
  }

  private initFromUrlOrStorage() {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    const urlPin = params.get('pin');
    const urlMode = params.get('mode');

    const hashMatch = window.location.hash.match(/^#([A-Za-z0-9_-]{3,16})$/);
    const hashRoom = hashMatch ? hashMatch[1] : null;

    const savedRoom = localStorage.getItem(ACTIVE_ROOM_KEY);
    const targetRoom = (urlRoom || hashRoom || savedRoom || 'LOBBY').toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    this.activeRoomCode = targetRoom;
    localStorage.setItem(ACTIVE_ROOM_KEY, targetRoom);

    // If explicit mode=spectator, start as spectator
    if (urlMode === 'spectator') {
      this.spectatorByChoice = true;
      this.isOrganizerRole = false;
      this.isParticipantRole = false;
      return;
    }

    // Check saved PIN or URL PIN
    const savedPin = urlPin || localStorage.getItem(ROOM_PINS_KEY_PREFIX + targetRoom);
    if (savedPin) {
      this.verifyPin(savedPin, targetRoom).then((res) => {
        this.isOrganizerRole = res.canEdit;
        this.isParticipantRole = res.isParticipant;
        this.notifyListeners();
      });
    } else {
      // Check if current user is owner or admin
      this.verifyPin('', targetRoom).then((res) => {
        if (res.canEdit) {
          this.isOrganizerRole = true;
          this.notifyListeners();
        }
      });
    }
  }

  public getActiveRoomCode(): string {
    return this.activeRoomCode;
  }

  public getActiveRoomPin(): string {
    return this.activeRoomPin;
  }

  // Remember an admin PIN on this device so the room unlocks without retyping it
  public rememberAdminPin(roomCode: string, pin: string) {
    try {
      localStorage.setItem(ROOM_PINS_KEY_PREFIX + roomCode, pin);
    } catch (e) {}
  }

  // PINs for the active room, for people who may edit it (used to print boat check-in QR cards)
  public async fetchRoomPins(roomCode = this.activeRoomCode): Promise<{ adminPin?: string; participantPin?: string } | null> {
    try {
      const headers = authService.getAuthHeaders();
      const pin = roomCode === this.activeRoomCode ? this.activeRoomPin : localStorage.getItem(ROOM_PINS_KEY_PREFIX + roomCode) || '';
      if (pin) headers['x-admin-pin'] = pin;
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/pins`, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      return { adminPin: data.adminPin, participantPin: data.participantPin };
    } catch (e) {
      return null;
    }
  }

  public getIsOrganizer(): boolean {
    return this.isOrganizerRole;
  }

  public isSpectatorByChoice(): boolean {
    return this.spectatorByChoice;
  }

  public isOrganizer(): boolean {
    return this.isOrganizerRole;
  }

  public isParticipant(): boolean {
    return this.isParticipantRole;
  }

  public isSpectator(): boolean {
    return !this.isOrganizerRole && !this.isParticipantRole;
  }

  public getCurrentSummary(): RegattaRoomSummary | null {
    return this.currentRoomSummary;
  }

  public onRoomChange(callback: RoomChangeCallback): () => void {
    this.listeners.push(callback);
    callback(this.activeRoomCode, this.isOrganizerRole, this.currentRoomSummary || undefined);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => cb(this.activeRoomCode, this.isOrganizerRole, this.currentRoomSummary || undefined));
  }

  public async fetchPublicRooms(): Promise<RegattaRoomSummary[]> {
    try {
      const res = await fetch('/api/rooms', {
        headers: authService.getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.rooms || [];
      }
    } catch (e) {
      console.warn('Failed to fetch rooms from server:', e);
    }
    return [];
  }

  public async fetchMyRooms(): Promise<RegattaRoomSummary[]> {
    try {
      const res = await fetch('/api/rooms?filter=mine', {
        headers: authService.getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return data.rooms || [];
      }
    } catch (e) {
      console.warn('Failed to fetch my rooms:', e);
    }
    return [];
  }

  public async fetchRoomState(roomCode: string): Promise<RegattaRoom | null> {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`, {
        headers: authService.getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          this.currentRoomSummary = {
            code: data.room.code,
            title: data.room.title,
            locationName: data.room.locationName,
            tenantId: data.room.tenantId,
            tenantName: data.room.tenantName,
            isPublic: data.room.isPublic,
            ownerId: data.room.ownerId,
            ownerName: data.room.ownerName,
            isOwner: !!data.room.isOwner,
            boatCount: data.room.boats?.length || 0,
            markCount: data.room.marks?.length || 0,
            raceStatus: data.room.raceState?.status || 'PRE_START',
            activeClients: data.connectedClients || 1,
            createdAt: data.room.createdAt,
            lastActive: data.room.lastActive,
            hasPassword: true,
          };
          if (data.room.isOwner || data.room.canEdit || data.room.isAdmin) {
            this.isOrganizerRole = true;
          }
          this.notifyListeners();
          return data.room;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch room state:', e);
    }
    return null;
  }

  public async verifyPin(pin: string, roomCode = this.activeRoomCode): Promise<{ valid: boolean; isAdmin: boolean; isParticipant: boolean; canEdit: boolean }> {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/verify-pin`, {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.valid) {
          if (roomCode === this.activeRoomCode) {
            this.isOrganizerRole = !!(data.canEdit ?? data.isAdmin);
            this.isParticipantRole = !!data.isParticipant;
            if (pin) this.activeRoomPin = pin;
            if (pin && data.isAdmin) localStorage.setItem(ROOM_PINS_KEY_PREFIX + roomCode, pin);
            this.notifyListeners();
          }
          return { valid: true, isAdmin: !!data.isAdmin, isParticipant: !!data.isParticipant, canEdit: !!(data.canEdit ?? data.isAdmin) };
        }
      }
    } catch (e) {
      console.warn('PIN verification network error:', e);
    }
    return { valid: false, isAdmin: false, isParticipant: false, canEdit: false };
  }

  public async validateRoomCode(roomCode: string): Promise<{ valid: boolean; error?: string; room?: any }> {
    const cleanCode = (roomCode || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      return { valid: false, error: 'Please enter a regatta room code.' };
    }
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(cleanCode)}/validate`);
      if (res.ok) {
        const data = await res.json();
        if (data.valid && data.exists) {
          return { valid: true, room: data.room };
        }
        return { valid: false, error: data.error || `Regatta room code "${cleanCode}" does not exist.` };
      }
      const errData = await res.json().catch(() => ({}));
      return { valid: false, error: errData.error || `Invalid regatta room code "${cleanCode}". Event not found.` };
    } catch (e) {
      return { valid: false, error: 'Failed to connect to server to validate room code.' };
    }
  }

  public async switchRoom(roomCode: string, pin?: string, asSpectator = false): Promise<boolean> {
    const cleanCode = roomCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) return false;

    // First verify that the room actually exists
    const roomState = await this.fetchRoomState(cleanCode);
    if (!roomState) {
      return false;
    }

    this.activeRoomCode = cleanCode;
    this.activeRoomPin = '';
    this.spectatorByChoice = asSpectator;
    localStorage.setItem(ACTIVE_ROOM_KEY, cleanCode);

    // Update URL query without page reload
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('room', cleanCode);
      if (asSpectator) {
        url.searchParams.set('mode', 'spectator');
      } else {
        url.searchParams.delete('mode');
      }
      window.history.replaceState({}, '', url.toString());
    }

    if (asSpectator) {
      this.isOrganizerRole = false;
      this.isParticipantRole = false;
    } else if (pin) {
      const res = await this.verifyPin(pin, cleanCode);
      this.isOrganizerRole = res.canEdit;
      this.isParticipantRole = res.isParticipant;
    } else {
      // Check if we have saved pin or ownership
      const savedPin = localStorage.getItem(ROOM_PINS_KEY_PREFIX + cleanCode);
      const res = await this.verifyPin(savedPin || '', cleanCode);
      this.isOrganizerRole = res.canEdit;
      this.isParticipantRole = res.isParticipant;
    }

    this.notifyListeners();
    return true;
  }

  public async createRoom(params: {
    code: string;
    title: string;
    locationName: string;
    adminPin: string;
    isPublic: boolean;
    initialMarks?: CourseMark[];
    initialBoats?: Boat[];
    initialRaceState?: Partial<RaceState>;
  }): Promise<{ success: boolean; error?: string; room?: RegattaRoom; requireAuth?: boolean }> {
    try {
      const cleanCode = params.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if (!cleanCode || cleanCode.length < 3) {
        return { success: false, error: 'Room code must be at least 3 characters.' };
      }
      if (!params.adminPin || params.adminPin.length < 4) {
        return { success: false, error: 'Admin PIN must be at least 4 digits.' };
      }

      if (!authService.isAuthenticated()) {
        return {
          success: false,
          error: 'Registration required: Please sign in or create an account to create and host regatta rooms.',
          requireAuth: true,
        };
      }

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({
          ...params,
          code: cleanCode,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem(ROOM_PINS_KEY_PREFIX + cleanCode, params.adminPin);
        await this.switchRoom(cleanCode, params.adminPin, false);
        return { success: true, room: data.room };
      } else {
        return { success: false, error: data.error || 'Failed to create room', requireAuth: data.requireAuth };
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error while creating room' };
    }
  }

  public async updateRoomPin(
    code: string,
    newPin: string,
    currentPin?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/pin`, {
        method: 'PUT',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem(ROOM_PINS_KEY_PREFIX + code, newPin);
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to update room PIN.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error updating PIN.' };
    }
  }

  public async deleteRoom(
    code: string,
    pin?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const headers = authService.getAuthHeaders();
      if (pin) {
        headers['x-admin-pin'] = pin;
      }
      const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.removeItem(ROOM_PINS_KEY_PREFIX + code);
        // If the current room was deleted, fall back to LOBBY
        if (this.activeRoomCode === code) {
          await this.switchRoom('LOBBY', undefined, true);
        }
        return { success: true };
      }
      return { success: false, error: data.error || 'Failed to delete room.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error deleting room.' };
    }
  }

  public lockAdmin() {
    this.isOrganizerRole = false;
    this.activeRoomPin = '';
    this.notifyListeners();
  }

  public getShareableLink(mode: 'spectator' | 'rc' = 'spectator'): string {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    if (mode === 'spectator') {
      return `${base}?room=${encodeURIComponent(this.activeRoomCode)}&mode=spectator`;
    }
    return `${base}?room=${encodeURIComponent(this.activeRoomCode)}`;
  }
}

export const roomService = new RoomService();
