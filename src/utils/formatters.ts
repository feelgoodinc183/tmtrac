export function formatLastHeard(timestamp?: number): string {
  if (!timestamp || timestamp <= 0) return 'Never';
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    const remainMin = diffMin % 60;
    return remainMin > 0 ? `${diffHr}h ${remainMin}m ago` : `${diffHr}h ago`;
  }
  
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export function safeFixed(val: any, decimals: number = 1, fallback: string = '0.0'): string {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num) || !isFinite(num)) return fallback;
  return num.toFixed(decimals);
}

export function safeNum(val: any, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const num = typeof val === 'number' ? val : Number(val);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

export function formatTime(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Meshtastic reports battery_level 101 when the device runs on external power (USB or solar),
 * so anything above 100 is shown as that rather than as a percentage.
 */
export function formatBattery(level?: number | null): string {
  if (level === null || level === undefined || isNaN(level)) return '—';
  if (level > 100) return 'External power';
  return `${Math.round(Math.max(0, level))}%`;
}

export type TrackerFreshness = 'live' | 'stale' | 'offline';

/** live: heard in the last 2 minutes; stale: within 10 minutes; offline: longer, or never */
export function trackerFreshness(lastPingTime?: number): TrackerFreshness {
  if (!lastPingTime || lastPingTime <= 0) return 'offline';
  const age = Date.now() - lastPingTime;
  if (age <= 2 * 60_000) return 'live';
  if (age <= 10 * 60_000) return 'stale';
  return 'offline';
}
