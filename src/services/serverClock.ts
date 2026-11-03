// Shared race clock. Phones and laptops drift by seconds or more, so start sequences are timed
// against the server's clock: each device estimates its offset from PING/PONG round trips and
// uses serverNow() instead of Date.now() for anything every device must agree on (start gun,
// countdown, finish times).

const MAX_SAMPLES = 8;

interface ClockSample {
  offsetMs: number;
  rttMs: number;
}

let samples: ClockSample[] = [];
let offsetMs = 0;
let hasRoundTrip = false;

function recompute() {
  // The sample with the shortest round trip has the least network delay in its estimate
  const best = samples.reduce<ClockSample | null>((a, b) => (!a || b.rttMs < a.rttMs ? b : a), null);
  if (best) offsetMs = best.offsetMs;
}

/** Server time in ms, as best this device can tell. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Current estimate of (server clock - device clock), in ms. */
export function getClockOffsetMs(): number {
  return offsetMs;
}

/** Feed one PING/PONG round trip: device time when sent, server time in the reply, device time when received. */
export function recordRoundTrip(sentAt: number, serverTime: number, receivedAt: number) {
  const rttMs = receivedAt - sentAt;
  if (!(rttMs >= 0) || rttMs > 10000 || !Number.isFinite(serverTime)) return;
  samples = [...samples, { offsetMs: serverTime - (sentAt + receivedAt) / 2, rttMs }].slice(-MAX_SAMPLES);
  hasRoundTrip = true;
  recompute();
}

/** Rough first estimate from a one-way server timestamp, used only until a round trip is measured. */
export function recordServerTimestamp(serverTime: number) {
  if (hasRoundTrip || !Number.isFinite(serverTime)) return;
  offsetMs = serverTime - Date.now();
}
