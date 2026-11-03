import React, { useEffect, useState } from 'react';
import { Radio, Database } from 'lucide-react';
import { MeshtasticNode, RaceState } from '../types/regatta';
import { getClassRaceState } from '../services/classRaceState';
import { serverNow } from '../services/serverClock';
import { formatTime } from '../utils/formatters';

interface FooterProps {
  raceState: RaceState;
  classNames: string[];
  nodes: MeshtasticNode[];
  onOpenMqttInspector: () => void;
  onOpenOfflineCache: () => void;
}

// A node counts as heard if it reported within this window.
const NODE_HEARD_WINDOW_MS = 2 * 60 * 1000;

// Phones, tablets and the browser's own GPS are not mesh radios.
const isMeshRadio = (n: MeshtasticNode) =>
  !n.isDeviceGps && n.connectionType !== 'DEVICE_GPS' && n.connectionType !== 'PHONE' && n.connectionType !== 'TABLET' && n.connectionType !== 'PC';

function describeClass(raceState: RaceState, className: string): { text: string; live: boolean } {
  const state = getClassRaceState(raceState, className);
  if (state.status === 'COUNTDOWN') {
    return { text: `Start in ${formatTime(state.countdownSeconds)}`, live: true };
  }
  if (state.status === 'RACING') {
    const startedAt = state.startTime ?? state.targetStartTime;
    if (startedAt) {
      return { text: `Racing ${formatTime(Math.max(0, (serverNow() - startedAt) / 1000))}`, live: true };
    }
    return { text: 'Racing', live: true };
  }
  if (state.status === 'FINISHED') return { text: 'Finished', live: false };
  return { text: 'Not started', live: false };
}

export const Footer: React.FC<FooterProps> = ({
  raceState,
  classNames,
  nodes,
  onOpenMqttInspector,
  onOpenOfflineCache,
}) => {
  const classes = classNames.length > 0 ? classNames : [raceState.activeClass];
  const rows = classes.map((name) => ({ name, ...describeClass(raceState, name) }));
  const anyLive = rows.some((r) => r.live);

  // Re-render once a second only while a countdown or race clock is running.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!anyLive) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [anyLive]);

  const meshNodes = nodes.filter(isMeshRadio);
  const now = Date.now();
  const heard = meshNodes.filter((n) => n.lastPingTime && now - n.lastPingTime < NODE_HEARD_WINDOW_MS).length;
  const meshDot = meshNodes.length === 0 ? 'bg-lb-64748b' : heard > 0 ? 'bg-lb-00ff9d' : 'bg-lb-fbbc04';
  const meshLabel = meshNodes.length === 0 ? 'Mesh: no nodes' : `Mesh: ${heard}/${meshNodes.length} heard`;

  return (
    <footer className="h-12 bg-lb-020408 border-t border-ll-1e293b flex items-center justify-between gap-4 px-4 sm:px-6 shrink-0 text-lt-94a3b8 text-xs font-mono select-none z-20">
      {/* Per-class race clock, from the shared race state */}
      <div className="flex gap-4 sm:gap-6 text-xs text-lt-94a3b8 overflow-x-auto no-scrollbar min-w-0">
        {rows.map((r) => (
          <span key={r.name} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={r.name === raceState.activeClass ? 'text-lt-e0e6ed font-bold' : ''}>{r.name}:</span>
            <strong className={r.live ? 'text-lt-00d4ff' : 'text-lt-94a3b8 font-normal'}>{r.text}</strong>
          </span>
        ))}
      </div>

      {/* Connection status, derived from nodes heard and the MQTT bridge */}
      <div className="flex items-center gap-4 sm:gap-6 shrink-0 text-xs">
        <button
          onClick={onOpenMqttInspector}
          className="flex items-center gap-2 hover:text-lt-e0e6ed transition-colors cursor-pointer"
          title="Open MQTT packet inspector"
        >
          <span className={`w-2 h-2 rounded-full ${meshDot}`} />
          <Radio className="w-3 h-3" />
          <span className="whitespace-nowrap">
            {meshLabel} · MQTT {raceState.mqttConnected ? 'online' : 'offline'}
          </span>
        </button>

        <button
          onClick={onOpenOfflineCache}
          className="hidden sm:flex items-center gap-2 hover:text-lt-e0e6ed transition-colors cursor-pointer"
          title="Open offline cache manager"
        >
          <Database className="w-3 h-3" />
          <span>Offline cache</span>
        </button>
      </div>
    </footer>
  );
};
