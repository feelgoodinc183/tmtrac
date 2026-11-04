import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Globe, KeyRound, Plus, Trash2, Wifi } from 'lucide-react';
import { Button } from './ui/Button';
import { meshtasticService, MqttBridgeStatus } from '../services/meshtasticBleMqttService';
import {
  ChannelKeyKind,
  RoomMqttResponse,
  RoomMqttUpdate,
  clearLegacyMqttStorage,
  fetchRoomMqtt,
  updateRoomMqtt,
} from '../services/mqttSettingsService';
import { formatLastHeard } from '../utils/formatters';

const REGIONS = [
  { label: 'Malaysia 919 MHz', root: 'msh/MY_919' },
  { label: 'Malaysia 433 MHz', root: 'msh/MY_433' },
];

interface ChannelRow {
  name: string;
  keyKind: ChannelKeyKind;
  /** New key typed by the user; undefined keeps the stored one */
  psk?: string;
}

const KEY_LABEL: Record<ChannelKeyKind, string> = {
  public: 'Public key: approximate positions only',
  custom: 'Own key: exact positions',
  none: 'No encryption',
};

function keyKindOf(psk: string): ChannelKeyKind {
  try {
    const raw = atob(psk.trim());
    if (raw.length === 0 || (raw.length === 1 && raw.charCodeAt(0) === 0)) return 'none';
    return raw.length === 1 ? 'public' : 'custom';
  } catch {
    return 'custom';
  }
}

function statusText(s: MqttBridgeStatus): { tone: 'ok' | 'warn' | 'muted'; text: string } {
  switch (s.state) {
    case 'connected':
      return {
        tone: 'ok',
        text: s.lastPacketAt
          ? `Receiving: ${s.nodesHeard} node${s.nodesHeard === 1 ? '' : 's'} heard, last packet ${formatLastHeard(s.lastPacketAt).toLowerCase()}`
          : 'Connected to the broker. Waiting for the first packet…',
      };
    case 'connecting':
      return { tone: 'warn', text: 'Connecting to the broker…' };
    case 'waiting':
      return { tone: 'muted', text: 'On. Starts when someone has this event open.' };
    case 'error':
      return { tone: 'warn', text: `Can't reach the broker: ${s.error || 'unknown error'}. Retrying.` };
    default:
      return { tone: 'muted', text: 'Off' };
  }
}

/**
 * The one place to set up Meshtastic MQTT for an event. The TMTRAC server connects to the
 * broker, decrypts with the channel keys and sends node updates to everyone in the room.
 */
export const MqttSettingsPanel: React.FC = () => {
  const [loaded, setLoaded] = useState<RoomMqttResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<MqttBridgeStatus>(() => meshtasticService.getMqttStatus());

  const [enabled, setEnabled] = useState(false);
  const [rootTopic, setRootTopic] = useState('msh/MY_919');
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [useOwnBroker, setUseOwnBroker] = useState(false);
  const [brokerUrl, setBrokerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const applyLoaded = (r: RoomMqttResponse) => {
    setLoaded(r);
    setEnabled(r.config.enabled);
    setRootTopic(r.config.rootTopic);
    setChannels(r.config.channels.map((c) => ({ name: c.name, keyKind: c.keyKind })));
    setUseOwnBroker(!!r.config.brokerUrl);
    setBrokerUrl(r.config.brokerUrl || '');
    setUsername(r.config.username || '');
    setPassword('');
    meshtasticService.handleServerMqttStatus(r.status);
  };

  useEffect(() => {
    clearLegacyMqttStorage();
    fetchRoomMqtt().then(applyLoaded).catch((e) => setLoadError(e?.message || 'Could not load MQTT settings'));
    return meshtasticService.onMqttStatusChange(setStatus);
  }, []);

  const canEdit = !!loaded?.canEdit;
  const st = statusText(status);
  const hasPublicChannel = channels.some((c) => (c.psk !== undefined ? keyKindOf(c.psk) : c.keyKind) === 'public');

  const handleAddChannel = () => {
    const name = newName.trim();
    if (!name || channels.some((c) => c.name === name)) return;
    const psk = newKey.trim() || 'AQ==';
    setChannels((prev) => [...prev, { name, keyKind: keyKindOf(psk), psk }]);
    setNewName('');
    setNewKey('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    const update: RoomMqttUpdate = {
      enabled,
      rootTopic,
      brokerUrl: useOwnBroker ? brokerUrl.trim() : '',
      channels: channels.map((c) => (c.psk !== undefined ? { name: c.name, psk: c.psk } : { name: c.name })),
    };
    if (useOwnBroker) {
      update.username = username;
      if (password) update.password = password;
    }
    try {
      applyLoaded(await updateRoomMqtt(update));
      setSaved(true);
    } catch (e: any) {
      setSaveError(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const toneClass =
    st.tone === 'ok' ? 'text-success-ink border-success-ink/30 bg-success-ink/10'
    : st.tone === 'warn' ? 'text-warning-ink border-warning-ink/40 bg-warning-ink/10'
    : 'text-ink-muted border-line bg-canvas';

  return (
    <div className="space-y-4">
      <div className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${toneClass}`} role="status" aria-live="polite">
        <Wifi className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong className="block">Internet (MQTT): {st.text}</strong>
          {status.topics.length > 0 && <span className="text-ink-muted">Listening on {status.topics.filter((t) => t.includes('/2/e/')).map((t) => t.replace('/#', '')).join(', ')}</span>}
        </div>
      </div>

      {loadError && (
        <p className="text-xs text-danger-ink flex items-center gap-1" role="alert">
          <AlertTriangle className="w-3.5 h-3.5" /> {loadError}
        </p>
      )}

      {loaded && !canEdit && (
        <p className="text-xs text-ink-muted">
          The race office sets this up for the event. {loaded.config.enabled ? `Receiving ${loaded.config.channels.map((c) => c.name).join(', ')} on ${loaded.config.rootTopic}.` : 'MQTT is off for this event.'}
        </p>
      )}

      {loaded && canEdit && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
            Receive trackers over the internet (MQTT) for this event
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-ink-muted mb-1">Region</legend>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <Button key={r.root} variant={rootTopic === r.root ? 'primary' : 'secondary'} onClick={() => setRootTopic(r.root)}>
                  {r.label}
                </Button>
              ))}
            </div>
            <label className="block text-xs text-ink-muted">
              Topic root
              <input
                value={rootTopic}
                onChange={(e) => setRootTopic(e.target.value)}
                placeholder="msh/MY_919"
                className="mt-1 w-full bg-surface border border-line rounded-lg p-2 text-xs text-ink"
              />
            </label>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-ink-muted mb-1">Channels</legend>
            {channels.length === 0 && <p className="text-xs text-ink-muted">No channels. Add at least one.</p>}
            {channels.map((c) => {
              const kind = c.psk !== undefined ? keyKindOf(c.psk) : c.keyKind;
              return (
                <div key={c.name} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-canvas border border-line">
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-ink">{c.name}</span>
                    <span className={`ml-2 text-xs ${kind === 'custom' ? 'text-success-ink' : 'text-warning-ink'}`}>{KEY_LABEL[kind]}</span>
                  </div>
                  <Button
                    icon={<Trash2 />}
                    aria-label={`Remove channel ${c.name}`}
                    onClick={() => setChannels((prev) => prev.filter((x) => x.name !== c.name))}
                  />
                </div>
              );
            })}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-2 items-end">
              <label className="text-xs text-ink-muted">
                Channel name
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. RLYC" className="mt-1 w-full bg-surface border border-line rounded-lg p-2 text-xs text-ink" />
              </label>
              <label className="text-xs text-ink-muted">
                Channel key (base64, from the Meshtastic app)
                <input type="password" autoComplete="off" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Leave empty for the public key (AQ==)" className="mt-1 w-full bg-surface border border-line rounded-lg p-2 text-xs text-ink" />
              </label>
              <Button icon={<Plus />} onClick={handleAddChannel} disabled={!newName.trim()}>Add</Button>
            </div>
            {hasPublicChannel && (
              <p className="text-xs text-warning-ink flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                On the public key, Meshtastic only shares approximate positions (roughly ±0.7 to ±3 km), which is fine for seeing nearby nodes but not for racing.
                For race tracking, put the trackers on a club channel with its own key and add that channel here.
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-bold text-ink-muted mb-1">Broker</legend>
            <label className="flex items-center gap-2 text-xs text-ink">
              <input type="radio" name="mqtt-broker" checked={!useOwnBroker} onChange={() => setUseOwnBroker(false)} />
              <Globe className="w-3.5 h-3.5" /> Public Meshtastic broker (mqtt.meshtastic.org)
            </label>
            <label className="flex items-center gap-2 text-xs text-ink">
              <input type="radio" name="mqtt-broker" checked={useOwnBroker} onChange={() => setUseOwnBroker(true)} />
              <KeyRound className="w-3.5 h-3.5" /> Your own broker
            </label>
            {useOwnBroker && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="text-xs text-ink-muted sm:col-span-3">
                  Address
                  <input value={brokerUrl} onChange={(e) => setBrokerUrl(e.target.value)} placeholder="mqtts://broker.example.com:8883" className="mt-1 w-full bg-surface border border-line rounded-lg p-2 text-xs text-ink" />
                </label>
                <label className="text-xs text-ink-muted">
                  Username
                  <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" className="mt-1 w-full bg-surface border border-line rounded-lg p-2 text-xs text-ink" />
                </label>
                <label className="text-xs text-ink-muted sm:col-span-2">
                  Password
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder={loaded.config.hasPassword ? 'Saved (leave empty to keep)' : ''} className="mt-1 w-full bg-surface border border-line rounded-lg p-2 text-xs text-ink" />
                </label>
              </div>
            )}
          </fieldset>

          <p className="text-xs text-ink-muted">
            These settings are stored on the TMTRAC server for this event. Channel keys and passwords are never shown again or kept in this browser.
          </p>

          {saveError && (
            <p className="text-xs text-danger-ink flex items-center gap-1" role="alert">
              <AlertTriangle className="w-3.5 h-3.5" /> {saveError}
            </p>
          )}
          {saved && !saveError && (
            <p className="text-xs text-success-ink flex items-center gap-1" role="status">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </p>
          )}
          <Button variant="primary" className="w-full" loading={saving} loadingLabel="Saving…" onClick={handleSave} disabled={enabled && channels.length === 0}>
            Save MQTT settings
          </Button>
        </div>
      )}
    </div>
  );
};
