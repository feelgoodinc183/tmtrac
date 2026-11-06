// Whether this device can reach the server, for the header dot and the connection banner.
//
// The live connection is a WebSocket. When it is down, room edits are posted over HTTP instead,
// and own GPS points are queued on the device. A socket can also look open but be dead (a phone
// switching networks): it is treated as down once the server has been silent for too long.

export type ServerConnectionState =
  /** First connection after the page loaded, not open yet */
  | 'connecting'
  | 'connected'
  /** Was connected, or the first try failed: retrying */
  | 'reconnecting'
  /** The browser reports no network at all */
  | 'offline';

export interface ServerConnectionStatus {
  state: ServerConnectionState;
  /** When the current state began (device clock, ms) */
  since: number;
  /** Last message from the server, 0 if none yet */
  lastHeardAt: number;
  /**
   * While the live connection is down: whether the last edit sent over HTTP was saved (true),
   * refused or not delivered (false), or none was sent yet (null)
   */
  httpSaving: boolean | null;
  /** Edits that reached neither the live connection nor HTTP since the person last dismissed this */
  lostEdits: number;
}

/** Pings go out every 15 s; this long without any message means the socket is dead */
export const MAX_SERVER_SILENCE_MS = 40_000;

export function createServerConnectionMonitor(opts: { now?: () => number; online?: boolean } = {}) {
  const now = opts.now ?? Date.now;
  let status: ServerConnectionStatus = {
    state: opts.online === false ? 'offline' : 'connecting',
    since: now(),
    lastHeardAt: 0,
    httpSaving: null,
    lostEdits: 0,
  };
  let browserOnline = opts.online !== false;
  let socketOpen = false;
  let everConnected = false;
  const listeners = new Set<(s: ServerConnectionStatus) => void>();

  const set = (patch: Partial<ServerConnectionStatus>) => {
    const next = { ...status, ...patch };
    if (next.state !== status.state) next.since = now();
    const changed = (Object.keys(next) as (keyof ServerConnectionStatus)[]).some((k) => next[k] !== status[k]);
    status = next;
    if (changed) listeners.forEach((cb) => cb(status));
  };

  const disconnectedState = (): ServerConnectionState =>
    !browserOnline ? 'offline' : everConnected ? 'reconnecting' : 'connecting';

  return {
    get: (): ServerConnectionStatus => status,

    subscribe(cb: (s: ServerConnectionStatus) => void): () => void {
      listeners.add(cb);
      cb(status);
      return () => listeners.delete(cb);
    },

    socketOpened() {
      socketOpen = true;
      everConnected = true;
      browserOnline = true;
      set({ state: 'connected', lastHeardAt: now(), httpSaving: null });
    },

    socketClosed() {
      socketOpen = false;
      set({ state: disconnectedState() });
    },

    /** The first try failed before ever connecting: say so instead of "connecting" forever */
    connectFailed() {
      if (!socketOpen) {
        everConnected = true;
        set({ state: disconnectedState() });
      }
    },

    messageReceived() {
      set({ lastHeardAt: now() });
    },

    /** True when the socket looks open but the server has gone quiet */
    isSilent(maxSilenceMs = MAX_SERVER_SILENCE_MS): boolean {
      return socketOpen && status.lastHeardAt > 0 && now() - status.lastHeardAt > maxSilenceMs;
    },

    browserWentOffline() {
      browserOnline = false;
      if (!socketOpen) set({ state: 'offline' });
    },

    browserWentOnline() {
      browserOnline = true;
      if (!socketOpen) set({ state: disconnectedState() });
    },

    /** An edit sent over HTTP because the live connection was down */
    httpEditResult(saved: boolean) {
      set({ httpSaving: saved, lostEdits: saved ? status.lostEdits : status.lostEdits + 1 });
    },

    clearLostEdits() {
      set({ lostEdits: 0 });
    },
  };
}

export type ServerConnectionMonitor = ReturnType<typeof createServerConnectionMonitor>;
