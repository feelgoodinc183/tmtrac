import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CloudOff, RefreshCw, WifiOff, X } from 'lucide-react';
import { ServerConnectionStatus } from '../services/serverConnection';

/** Short drops (a page reload, a network hand-over) don't raise the banner */
export const BANNER_DELAY_MS = 4000;
const RECONNECTED_MS = 3000;

interface ServerConnectionBannerProps {
  status: ServerConnectionStatus;
  /** Race Officer or admin: the banner says what happens to their changes */
  canEdit: boolean;
  /** This device's own positions waiting to be sent */
  queuedPoints: number;
  onDismissLostEdits: () => void;
}

/** What the header dot and the banner call each state */
export function connectionLabel(status: ServerConnectionStatus, now = Date.now()): { text: string; tone: 'ok' | 'muted' | 'warning' | 'danger' } {
  switch (status.state) {
    case 'connected':
      return { text: 'Connected to the server', tone: 'ok' };
    case 'offline':
      return { text: 'No internet connection', tone: 'danger' };
    case 'connecting':
      return now - status.since < BANNER_DELAY_MS
        ? { text: 'Connecting to the server', tone: 'muted' }
        : { text: 'Can’t reach the server', tone: 'warning' };
    default:
      return { text: 'Reconnecting to the server', tone: 'warning' };
  }
}

/**
 * Says when this device can't reach the server, and what that means for the person: positions
 * wait on the device, and a Race Officer's changes may not be saved. Also reports changes that
 * were lost while disconnected, until dismissed.
 */
export const ServerConnectionBanner: React.FC<ServerConnectionBannerProps> = ({ status, canEdit, queuedPoints, onDismissLostEdits }) => {
  const [now, setNow] = useState(() => Date.now());
  const [showReconnected, setShowReconnected] = useState(false);
  const wasShowingRef = useRef(false);

  const down = status.state !== 'connected';
  const longEnough = down && now - status.since >= BANNER_DELAY_MS;

  // Re-check once the delay has passed, so the banner appears without waiting for another change
  useEffect(() => {
    if (!down) return;
    setNow(Date.now());
    const wait = Math.max(0, status.since + BANNER_DELAY_MS - Date.now());
    const t = setTimeout(() => setNow(Date.now()), wait + 50);
    return () => clearTimeout(t);
  }, [down, status.since]);

  // "Connected again" only after the banner was up, and only until the next drop
  useEffect(() => {
    if (longEnough) {
      wasShowingRef.current = true;
      setShowReconnected(false);
    } else if (down) {
      setShowReconnected(false);
    } else if (wasShowingRef.current) {
      wasShowingRef.current = false;
      setShowReconnected(true);
    }
  }, [longEnough, down]);

  // Its own timer, so a change of connection state can't cancel the hiding
  useEffect(() => {
    if (!showReconnected) return;
    const t = setTimeout(() => setShowReconnected(false), RECONNECTED_MS);
    return () => clearTimeout(t);
  }, [showReconnected]);

  const lost = status.lostEdits;
  if (!longEnough && !showReconnected && lost === 0) return null;

  let icon: React.ReactNode;
  let title: string;
  const lines: string[] = [];
  let tone: 'ok' | 'warning' | 'danger';

  if (longEnough) {
    const offline = status.state === 'offline';
    tone = offline ? 'danger' : 'warning';
    icon = offline ? <WifiOff className="w-5 h-5" /> : <RefreshCw className="w-5 h-5 motion-safe:animate-spin" />;
    title = offline ? 'No internet connection' : status.state === 'connecting' ? 'Can’t reach the server' : 'Reconnecting to the server…';
    if (canEdit) {
      if (status.httpSaving === true) lines.push('Live updates are paused, but your changes are still being saved.');
      else if (status.httpSaving === false) lines.push('Your changes are not being saved. Wait for the connection before changing the race.');
      else lines.push('Changes you make now may not be saved. Wait for the connection before changing the race.');
    } else {
      lines.push('Positions and the race clock on this screen may be out of date.');
    }
    if (queuedPoints > 0) lines.push(`${queuedPoints} of this device’s positions are kept here and sent when the connection is back.`);
  } else if (lost > 0) {
    tone = 'danger';
    icon = <CloudOff className="w-5 h-5" />;
    // No count: one tap can send several updates (switching class sends the race state and more)
    title = 'Some changes were not saved';
    lines.push('They were made while this device couldn’t reach the server. Check the race and make them again.');
  } else {
    tone = 'ok';
    icon = <CheckCircle2 className="w-5 h-5" />;
    title = 'Connected again';
  }

  const toneClass = {
    ok: 'border-success-ink/50 text-success-ink',
    warning: 'border-warning-ink/60 text-warning-ink',
    danger: 'border-danger-ink/60 text-danger-ink',
  }[tone];

  return (
    <div
      id="server-connection-banner"
      role={tone === 'danger' && !longEnough ? 'alert' : 'status'}
      // Only the "not saved" notice has a button; otherwise taps go through to the race controls below
      className={`fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-[65] w-[min(92vw,520px)] p-3 rounded-xl bg-surface/95 border shadow-2xl flex items-start gap-3 text-sm ${
        !longEnough && lost > 0 ? '' : 'pointer-events-none'
      } ${toneClass}`}
    >
      <span className="shrink-0 mt-0.5" aria-hidden="true">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        {lines.map((l) => (
          <p key={l} className="text-xs text-ink-muted mt-0.5">{l}</p>
        ))}
      </div>
      {!longEnough && lost > 0 && (
        <button
          type="button"
          onClick={() => {
            setShowReconnected(false);
            onDismissLostEdits();
          }}
          className="tap-target shrink-0 p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-raised"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
