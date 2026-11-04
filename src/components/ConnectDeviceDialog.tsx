import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bluetooth, CheckCircle2, Globe, Plus, Radio, Usb } from 'lucide-react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { MqttSettingsPanel } from './MqttSettingsPanel';
import { Boat, MeshtasticNode } from '../types/regatta';
import { BleStatus, meshtasticService } from '../services/meshtasticBleMqttService';
import { formatBattery, formatLastHeard, trackerFreshness } from '../utils/formatters';
import { sameNodeId } from '../utils/nodeId';

type Step = 'method' | 'bluetooth' | 'internet' | 'boat' | 'done';

interface ConnectDeviceDialogProps {
  nodes: MeshtasticNode[];
  boats: Boat[];
  onBindNodeToBoat: (nodeId: string, boatId: string) => void;
  /** Creates a boat and binds the tracker to it */
  onCreateBoatForTracker: (nodeId: string, name: string, sailNumber: string) => void;
  onClose: () => void;
}

const methodButton =
  'w-full flex items-start gap-3 p-4 rounded-control border border-line bg-canvas text-left transition-[filter,border-color] hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-line';

function nodeSummary(n: MeshtasticNode): string {
  const parts = [n.id];
  if (n.lat !== undefined) {
    parts.push(n.positionErrorMeters ? `approximate position (±${n.positionErrorMeters >= 1000 ? `${(n.positionErrorMeters / 1000).toFixed(1)} km` : `${n.positionErrorMeters} m`})` : 'has position');
  } else {
    parts.push('no position yet');
  }
  parts.push(`heard ${formatLastHeard(n.lastPingTime).toLowerCase()}`);
  return parts.join(' · ');
}

/**
 * The one way to add a tracker: how is it connected → connect it → which boat is it on.
 */
export const ConnectDeviceDialog: React.FC<ConnectDeviceDialogProps> = ({
  nodes,
  boats,
  onBindNodeToBoat,
  onCreateBoatForTracker,
  onClose,
}) => {
  const [step, setStep] = useState<Step>('method');
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [ble, setBle] = useState<BleStatus>(() => meshtasticService.getBleStatus());
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [boatChoice, setBoatChoice] = useState<string>('');
  const [newBoatName, setNewBoatName] = useState('');
  const [newSailNumber, setNewSailNumber] = useState('');
  const [doneText, setDoneText] = useState('');

  useEffect(() => meshtasticService.onBleStatusChange(setBle), []);

  const connectedTracker = useMemo(() => {
    const st = meshtasticService.getConnectedNodeState();
    return ble.state === 'connected' && st ? nodes.find((n) => sameNodeId(n.id, st.id)) || st : null;
  }, [ble.state, nodes]);

  const node = nodeId ? nodes.find((n) => sameNodeId(n.id, nodeId)) : undefined;

  // Boats without a tracker (or already on this one), for the "which boat" step
  const freeBoats = useMemo(
    () =>
      boats.filter((b) => {
        if (!b.nodeId || (nodeId && sameNodeId(b.nodeId, nodeId))) return true;
        const bound = nodes.find((n) => sameNodeId(n.id, b.nodeId));
        return !bound; // the tracker it pointed at isn't around any more
      }),
    [boats, nodes, nodeId]
  );

  // Trackers heard over the internet, most recent first
  const internetNodes = useMemo(
    () => nodes.filter((n) => n.connectionType === 'MQTT').sort((a, b) => (b.lastPingTime || 0) - (a.lastPingTime || 0)),
    [nodes]
  );

  const goToBoat = (id: string) => {
    setNodeId(id);
    const already = boats.find((b) => sameNodeId(b.nodeId, id));
    setBoatChoice(already?.id || '');
    setError(null);
    setStep('boat');
  };

  const handleBluetooth = async (reconnect: boolean) => {
    setConnecting(true);
    setError(null);
    try {
      const res = reconnect ? await meshtasticService.reconnectBle() : await meshtasticService.connectTEchoBle();
      if (res.success && res.nodeId) {
        goToBoat(res.nodeId);
      } else {
        setError(res.error || 'Could not connect to the tracker.');
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleBind = (choice: string = boatChoice) => {
    if (!nodeId) return;
    const name = node?.longName || nodeId;
    if (choice === '__new__') {
      if (!newBoatName.trim()) {
        setError('Give the new boat a name.');
        return;
      }
      onCreateBoatForTracker(nodeId, newBoatName.trim(), newSailNumber.trim());
      setDoneText(`${name} is now tracking ${newBoatName.trim()}.`);
    } else if (choice) {
      const boat = boats.find((b) => b.id === choice);
      onBindNodeToBoat(nodeId, choice);
      setDoneText(`${name} is now tracking ${boat?.name || 'the boat'}.`);
    } else {
      setDoneText(`${name} is connected. Bind it to a boat later from its boat card or the Mesh Nodes tab.`);
    }
    setError(null);
    setStep('done');
  };

  const back = (to: Step) => (
    <Button variant="ghost" icon={<ArrowLeft />} onClick={() => { setError(null); setStep(to); }}>
      Back
    </Button>
  );

  const lastDevice = meshtasticService.getLastBleDeviceName();

  let title: string;
  let body: React.ReactNode;
  let footer: React.ReactNode = null;

  switch (step) {
    case 'method':
      title = 'Connect a tracker';
      body = (
        <div className="space-y-2">
          <p className="text-sm text-ink-muted">How is the tracker connected?</p>
          <button type="button" className={methodButton} onClick={() => setStep('bluetooth')} data-autofocus>
            <Bluetooth className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <span>
              <strong className="block text-sm text-ink">Bluetooth</strong>
              <span className="text-xs text-ink-muted">A Meshtastic tracker next to this device (Chrome or Edge).</span>
            </span>
          </button>
          <button type="button" className={methodButton} onClick={() => setStep('internet')}>
            <Globe className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <span>
              <strong className="block text-sm text-ink">Internet (MQTT)</strong>
              <span className="text-xs text-ink-muted">Trackers whose packets reach the internet through a Meshtastic gateway.</span>
            </span>
          </button>
          <button type="button" className={methodButton} disabled>
            <Usb className="w-5 h-5 text-ink-muted shrink-0 mt-0.5" />
            <span>
              <strong className="block text-sm text-ink">USB</strong>
              <span className="text-xs text-ink-muted">Not available yet. Use Bluetooth instead.</span>
            </span>
          </button>
        </div>
      );
      break;

    case 'bluetooth':
      title = 'Connect over Bluetooth';
      body = (
        <div className="space-y-3">
          <ol className="text-sm text-ink-muted list-decimal pl-5 space-y-1">
            <li>Turn the tracker on. Disconnect it from the Meshtastic app on any phone.</li>
            <li>Choose it in the list your browser shows (e.g. <code>Meshtastic_xxxx</code>).</li>
          </ol>
          <p className="text-xs text-ink-muted">
            For speed and heading, the tracker's <strong>Speed</strong> and <strong>Heading</strong> position flags must be on (Meshtastic app → Position).
          </p>
          {(connecting || ble.state === 'connecting' || ble.state === 'configuring') && (
            <p className="text-sm text-ink" role="status">
              {ble.state === 'configuring' ? 'Reading the tracker’s settings…' : 'Connecting…'}
            </p>
          )}
          {connectedTracker && !connecting && (
            <div className="p-3 rounded-control border border-success-ink/30 bg-success-ink/10 text-sm flex items-center justify-between gap-2 flex-wrap">
              <span className="text-success-ink">Connected: <strong>{connectedTracker.longName}</strong> ({connectedTracker.id})</span>
              <Button onClick={() => goToBoat(connectedTracker.id)}>Use this tracker</Button>
            </div>
          )}
        </div>
      );
      footer = (
        <>
          {back('method')}
          {lastDevice && !connectedTracker && (
            <Button loading={connecting} loadingLabel="Connecting…" onClick={() => handleBluetooth(true)}>
              {`Reconnect ${lastDevice}`}
            </Button>
          )}
          <Button variant="primary" icon={<Bluetooth />} loading={connecting} loadingLabel="Connecting…" onClick={() => handleBluetooth(false)}>
            Choose tracker…
          </Button>
        </>
      );
      break;

    case 'internet':
      title = 'Trackers over the internet';
      body = (
        <div className="space-y-4">
          <MqttSettingsPanel />
          <div>
            <h3 className="text-sm font-bold text-ink mb-2">Which tracker?</h3>
            {internetNodes.length === 0 ? (
              <p className="text-xs text-ink-muted">No trackers heard yet. Once MQTT is on and a tracker sends a packet, it appears here.</p>
            ) : (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                {internetNodes.map((n) => (
                  <li key={n.id}>
                    <button type="button" className={methodButton.replace('p-4', 'p-2.5')} onClick={() => goToBoat(n.id)}>
                      <Radio className="w-4 h-4 text-ink-muted shrink-0 mt-0.5" />
                      <span className="min-w-0">
                        <strong className="block text-sm text-ink truncate">{n.longName}</strong>
                        <span className="text-xs text-ink-muted">{nodeSummary(n)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      );
      footer = back('method');
      break;

    case 'boat': {
      title = 'Which boat is this tracker on?';
      const freshness = node ? trackerFreshness(node.lastPingTime) : 'offline';
      body = (
        <div className="space-y-3">
          {node && (
            <p className="text-sm text-ink-muted">
              <strong className="text-ink">{node.longName}</strong> ({node.id}) · battery {formatBattery(node.battery)} ·{' '}
              {freshness === 'live' ? 'reporting now' : `last heard ${formatLastHeard(node.lastPingTime).toLowerCase()}`}
            </p>
          )}
          <fieldset className="space-y-1.5 max-h-64 overflow-y-auto">
            <legend className="sr-only">Boat</legend>
            {freeBoats.map((b) => (
              <label key={b.id} className="flex items-center gap-3 p-2.5 rounded-control border border-line bg-canvas cursor-pointer has-[:checked]:border-accent">
                <input type="radio" name="tracker-boat" value={b.id} checked={boatChoice === b.id} onChange={() => setBoatChoice(b.id)} />
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: b.color }} aria-hidden="true" />
                <span className="text-sm text-ink">
                  <strong>{b.name}</strong>
                  <span className="text-ink-muted">{b.sailNumber ? ` · ${b.sailNumber}` : ''} · {b.class}</span>
                </span>
              </label>
            ))}
            {freeBoats.length === 0 && (
              <p className="text-xs text-ink-muted">{boats.length === 0 ? 'No boats yet.' : 'Every boat already has a tracker.'}</p>
            )}
            <label className="flex items-center gap-3 p-2.5 rounded-control border border-line bg-canvas cursor-pointer has-[:checked]:border-accent">
              <input type="radio" name="tracker-boat" value="__new__" checked={boatChoice === '__new__'} onChange={() => setBoatChoice('__new__')} />
              <Plus className="w-4 h-4 text-accent" />
              <span className="text-sm text-ink font-bold">Create a boat for this tracker</span>
            </label>
          </fieldset>
          {boatChoice === '__new__' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-xs text-ink-muted">
                Boat name
                <input autoFocus value={newBoatName} onChange={(e) => setNewBoatName(e.target.value)} className="mt-1 w-full bg-canvas border border-line rounded-control p-2 text-sm text-ink" />
              </label>
              <label className="text-xs text-ink-muted">
                Sail number
                <input value={newSailNumber} onChange={(e) => setNewSailNumber(e.target.value)} placeholder="e.g. MAS 1234" className="mt-1 w-full bg-canvas border border-line rounded-control p-2 text-sm text-ink" />
              </label>
            </div>
          )}
        </div>
      );
      footer = (
        <>
          <Button variant="ghost" onClick={() => handleBind('')}>Skip for now</Button>
          <Button variant="primary" onClick={() => handleBind()} disabled={!boatChoice}>
            {boatChoice === '__new__' ? 'Create boat and bind' : 'Bind tracker'}
          </Button>
        </>
      );
      break;
    }

    default:
      title = 'Tracker connected';
      body = (
        <p className="text-sm text-ink flex items-start gap-2" role="status">
          <CheckCircle2 className="w-5 h-5 text-success-ink shrink-0" />
          {doneText}
        </p>
      );
      footer = (
        <>
          <Button onClick={() => { setNodeId(null); setBoatChoice(''); setNewBoatName(''); setNewSailNumber(''); setStep('method'); }}>
            Connect another
          </Button>
          <Button variant="primary" onClick={onClose}>Done</Button>
        </>
      );
  }

  return (
    <Dialog open onClose={onClose} title={title} size="lg" error={error} footer={footer}>
      {body}
    </Dialog>
  );
};
