import React, { useState, useEffect } from 'react';
import {
  HardwareConnection,
  MeshtasticNode,
  RegattaLocation,
} from '../types/regatta';
import { REGATTA_LOCATIONS } from '../services/initialData';
import { saveMqttConfig, meshtasticService } from '../services/meshtasticBleMqttService';
import {
  X,
  Globe,
  Terminal,
  CheckCircle2,
  MapPin,
  Server,
  Plus,
  Trash2,
  Building2,
  Check,
} from 'lucide-react';

export const STORAGE_KEY_MY_MESH_CONFIG = 'tmtrac_my_mesh_config_v2';

interface SavedMeshConfig {
  mqttBroker: string;
  mqttUsername: string;
  mqttPassword?: string;
  mqttTopic: string;
  frequencyBand: 'MY_919' | 'MY_433' | 'CUSTOM';
  channelPsk: string;
}

function loadPersistedMeshConfig(): SavedMeshConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MY_MESH_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        mqttBroker: parsed.mqttBroker || 'mqtt.meshtastic.org:1883',
        mqttUsername: parsed.mqttUsername ?? 'meshdev',
        mqttPassword: parsed.mqttPassword ?? 'large4cats',
        mqttTopic: parsed.mqttTopic || 'msh/MY_919/2/e/LongFast/#',
        frequencyBand: parsed.frequencyBand || 'MY_919',
        channelPsk: parsed.channelPsk || 'AQ==',
      };
    }
  } catch (e) {
    console.warn('Failed to parse saved mesh config:', e);
  }
  return {
    mqttBroker: 'mqtt.meshtastic.org:1883',
    mqttUsername: 'meshdev',
    mqttPassword: 'large4cats',
    mqttTopic: 'msh/MY_919/2/e/LongFast/#',
    frequencyBand: 'MY_919',
    channelPsk: 'AQ==',
  };
}

interface NmeaAndMalaysiaMeshModalProps {
  hardwareConn: HardwareConnection;
  onUpdateHardwareConn: (conn: Partial<HardwareConnection>) => void;
  selectedLocation: RegattaLocation;
  onSelectLocation: (location: RegattaLocation) => void;
  nodes: MeshtasticNode[];
  onClose: () => void;
}

export const NmeaAndMalaysiaMeshModal: React.FC<NmeaAndMalaysiaMeshModalProps> = ({
  hardwareConn,
  onUpdateHardwareConn,
  selectedLocation,
  onSelectLocation,
  nodes,
  onClose,
}) => {



  // CUSTOMIZABLE MQTT CONFIGURATION STATE (Loaded from persistent localStorage)
  const initialConfig = loadPersistedMeshConfig();
  const [mqttBroker, setMqttBroker] = useState(initialConfig.mqttBroker);
  const [mqttUsername, setMqttUsername] = useState(initialConfig.mqttUsername);
  const [mqttPassword, setMqttPassword] = useState(initialConfig.mqttPassword || 'large4cats');
  const [mqttTopic, setMqttTopic] = useState(initialConfig.mqttTopic);
  const [frequencyBand, setFrequencyBand] = useState<'MY_919' | 'MY_433' | 'CUSTOM'>(initialConfig.frequencyBand);
  const [channelPsk] = useState(initialConfig.channelPsk);

  // Helper to persist all mesh settings
  const persistMeshSettings = (overrides?: Partial<SavedMeshConfig>) => {
    const configToSave: SavedMeshConfig = {
      mqttBroker: overrides?.mqttBroker ?? mqttBroker,
      mqttUsername: overrides?.mqttUsername ?? mqttUsername,
      mqttPassword: overrides?.mqttPassword ?? mqttPassword,
      mqttTopic: overrides?.mqttTopic ?? mqttTopic,
      frequencyBand: overrides?.frequencyBand ?? frequencyBand,
      channelPsk: overrides?.channelPsk ?? channelPsk,
    };
    try {
      localStorage.setItem(STORAGE_KEY_MY_MESH_CONFIG, JSON.stringify(configToSave));
      // Also sync topic and credentials to global service config
      saveMqttConfig({
        topic: configToSave.mqttTopic,
        username: configToSave.mqttUsername,
        password: configToSave.mqttPassword,
      });
    } catch (e) {
      console.warn('Failed to save mesh config:', e);
    }
  };

  // DYNAMIC REGATTAS STATE (Loaded from defaults + localStorage)
  const [regattaList, setRegattaList] = useState<RegattaLocation[]>(() => {
    try {
      const saved = localStorage.getItem('custom_regattas_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...REGATTA_LOCATIONS, ...parsed];
        }
      }
    } catch (err) {
      console.error('Failed to parse custom regattas from localStorage:', err);
    }
    return REGATTA_LOCATIONS;
  });

  // ADD REGATTA FORM STATE
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRegattaName, setNewRegattaName] = useState('');
  const [newOrganizer, setNewOrganizer] = useState('Royal Selangor Yacht Club (RSYC)');
  const [newRegion, setNewRegion] = useState('Port Klang / Selat Klang Waters');
  const [newLat, setNewLat] = useState('3.001');
  const [newLng, setNewLng] = useState('101.378');
  const [newTopic, setNewTopic] = useState('msh/MY_919/2/e/RSYC_Custom/#');



  // Malaysia MQTT public packets log state
  const [myMqttLogs, setMyMqttLogs] = useState<string[]>([
    `[Public MQTT Broker] Host: ${mqttBroker}`,
    `[User Auth] Username: ${mqttUsername}`,
    `[Live Channel] Topic: ${mqttTopic}`,
  ]);

  const handleAddCustomRegatta = () => {
    if (!newRegattaName.trim()) return;
    const latNum = parseFloat(newLat);
    const lngNum = parseFloat(newLng);

    const newLocation: RegattaLocation = {
      id: `CUSTOM_REGATTA_${Date.now()}`,
      name: newRegattaName.trim(),
      organizer: newOrganizer.trim() || 'Royal Selangor Yacht Club (RSYC)',
      region: newRegion.trim() || 'Malaysia Waters',
      country: 'Malaysia',
      centerLat: isNaN(latNum) ? 3.001 : latNum,
      centerLng: isNaN(lngNum) ? 101.378 : lngNum,
      zoom: 1,
      publicMqttTopic: newTopic.trim() || 'msh/MY_919/2/e/LongFast/#',
      isMalaysiaPublicMesh: true,
    };

    const updatedList = [...regattaList, newLocation];
    setRegattaList(updatedList);

    // Save only custom additions to localStorage
    const customOnly = updatedList.filter((loc) => loc.id.startsWith('CUSTOM_REGATTA_'));
    localStorage.setItem('custom_regattas_v1', JSON.stringify(customOnly));

    // Select new location
    onSelectLocation(newLocation);
    setMqttTopic(newLocation.publicMqttTopic);
    setShowAddForm(false);
    setNewRegattaName('');
  };

  const handleDeleteCustomRegatta = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedList = regattaList.filter((loc) => loc.id !== id);
    setRegattaList(updatedList);
    const customOnly = updatedList.filter((loc) => loc.id.startsWith('CUSTOM_REGATTA_'));
    localStorage.setItem('custom_regattas_v1', JSON.stringify(customOnly));

    if (selectedLocation.id === id) {
      onSelectLocation(REGATTA_LOCATIONS[0]);
      setMqttTopic(REGATTA_LOCATIONS[0].publicMqttTopic);
    }
  };

  // Synchronize live MQTT stream status with hardware connection state
  useEffect(() => {
    const isConn = meshtasticService.isConnectedToMqtt();
    if (hardwareConn.malaysiaPublicMeshActive !== isConn) {
      onUpdateHardwareConn({ malaysiaPublicMeshActive: isConn });
    }

    const unsub = meshtasticService.onMqttStatusChange((status) => {
      onUpdateHardwareConn({ malaysiaPublicMeshActive: status.connected });
      if (status.connected) {
        setMyMqttLogs((prev) => [
          `[MQTT Connected] Live stream online via ${status.brokerUrl || mqttBroker}`,
          ...prev.slice(0, 20),
        ]);
      } else if (status.error) {
        setMyMqttLogs((prev) => [
          `[MQTT Notice] ${status.error}`,
          ...prev.slice(0, 20),
        ]);
      }
    });

    return () => {
      unsub();
    };
  }, []);

  const handleSelectBandPreset = (band: 'MY_919' | 'MY_433') => {
    setFrequencyBand(band);
    const newTopic = band === 'MY_919' ? 'msh/MY_919/2/e/LongFast/#' : 'msh/MY_433/2/e/LongFast/#';
    setMqttTopic(newTopic);
    persistMeshSettings({ frequencyBand: band, mqttTopic: newTopic });
    setMyMqttLogs((prev) => [
      `[MQTT Config Updated & Saved] Band set to ${band} (Topic: ${newTopic})`,
      ...prev,
    ]);
  };


  // Connect to Malaysia Public LoRa Stream (Real Hardware / Live MQTT Mode - No Dummy Nodes)
  const handleToggleMalaysiaMesh = async () => {
    const nextState = !hardwareConn.malaysiaPublicMeshActive;
    persistMeshSettings();
    onUpdateHardwareConn({ malaysiaPublicMeshActive: nextState });

    if (nextState) {
      setMyMqttLogs((prev) => [
        `[MQTT Active] Initiating live stream to ${mqttBroker}`,
        `[Subscribed Stream] ${mqttTopic}`,
        `[Status] Connecting to Meshtastic network...`,
        ...prev,
      ]);

      const res = await meshtasticService.connectMqtt({
        brokerUrl: mqttBroker,
        topic: mqttTopic,
        username: mqttUsername,
        password: mqttPassword,
        enabled: true,
        streamOutbound: false,
      });

      if (res.success) {
        setMyMqttLogs((prev) => [
          `[MQTT Connected] Successfully connected and streaming!`,
          ...prev,
        ]);
      } else {
        setMyMqttLogs((prev) => [
          `[MQTT Error] ${res.error || 'Connection failed'}`,
          ...prev,
        ]);
      }
    } else {
      await meshtasticService.connectMqtt({
        brokerUrl: mqttBroker,
        topic: mqttTopic,
        username: mqttUsername,
        password: mqttPassword,
        enabled: false,
        streamOutbound: false,
      });
      setMyMqttLogs((prev) => [
        `[MQTT Stream Paused] Disconnected from ${mqttBroker}`,
        ...prev,
      ]);
    }
  };

  const handleDone = () => {
    persistMeshSettings();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-canvas/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 landscape:p-1.5">
      <div className="bg-raised border border-line w-full max-w-3xl h-[85vh] max-h-[750px] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-[300px] sm:min-h-[520px] rounded-3xl landscape:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-ink">
        {/* Header */}
        <div className="p-4 landscape:py-2.5 bg-raised border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-on-accent shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-ink flex items-center gap-2">
                Malaysia LoRa &amp; MQTT
                <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/30">
                  MY_919 / MY_433
                </span>
              </h2>
              <p className="text-xs text-ink-muted">
                Public Malaysian Meshtastic stream over MQTT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-ink-muted hover:text-ink hover:bg-raised transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5 custom-scrollbar">
            <div className="space-y-4">
              {/* CUSTOMIZABLE MQTT CONFIGURATION FORM */}
              <div className="p-4 bg-raised rounded-2xl border border-line space-y-3">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="text-xs font-bold text-ink flex items-center gap-2">
                    <Server className="w-4 h-4 text-accent" />
                    Customizable MQTT Broker & Stream Topics
                  </span>
                  <span className="text-xs text-success-ink font-bold">
                    OFFICIAL MALAYSIA DEFAULT
                  </span>
                </div>

                {/* Preset Band Buttons */}
                <div>
                  <label className="text-xs text-ink-muted block mb-1">
                    Select Frequency Band Preset
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSelectBandPreset('MY_919')}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs  font-bold transition-all ${
                        frequencyBand === 'MY_919'
                          ? 'bg-accent text-on-accent border-accent'
                          : 'bg-raised text-ink-muted border-line'
                      }`}
                    >
                      MY_919 (919-923 MHz General 500mW)
                    </button>
                    <button
                      onClick={() => handleSelectBandPreset('MY_433')}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs  font-bold transition-all ${
                        frequencyBand === 'MY_433'
                          ? 'bg-accent text-on-accent border-accent'
                          : 'bg-raised text-ink-muted border-line'
                      }`}
                    >
                      MY_433 (433-435 MHz HAM Band)
                    </button>
                  </div>
                </div>

                {/* Broker Preset Quick Buttons */}
                <div>
                  <label className="text-xs text-ink-muted block mb-1">
                    Broker Server Presets
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: 'Official Meshtastic (Server Bridge)', url: 'mqtt.meshtastic.org', user: 'meshdev', pass: 'large4cats' },
                      { name: 'HiveMQ Public (WSS)', url: 'wss://broker.hivemq.com:8884/mqtt', user: '', pass: '' },
                      { name: 'EMQX Public (WSS)', url: 'wss://broker.emqx.io:8084/mqtt', user: '', pass: '' },
                    ].map((b) => (
                      <button
                        key={b.url}
                        type="button"
                        onClick={() => {
                          setMqttBroker(b.url);
                          setMqttUsername(b.user);
                          setMqttPassword(b.pass);
                          persistMeshSettings({
                            mqttBroker: b.url,
                            mqttUsername: b.user,
                            mqttPassword: b.pass,
                          });
                        }}
                        className={`text-xs  px-2 py-1 rounded-lg border transition-all ${
                          mqttBroker === b.url || (b.url === 'mqtt.meshtastic.org' && mqttBroker.includes('mqtt.meshtastic.org'))
                            ? 'bg-accent/20 text-accent border-accent font-bold'
                            : 'bg-raised text-ink-muted border-line hover:border-line'
                        }`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Broker URL, Auth Credentials & Custom Topic Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-ink-muted block mb-1">
                      MQTT Broker Host & Port
                    </label>
                    <input
                      type="text"
                      value={mqttBroker}
                      onChange={(e) => {
                        setMqttBroker(e.target.value);
                        persistMeshSettings({ mqttBroker: e.target.value });
                      }}
                      className="w-full bg-raised border border-line text-ink rounded-xl p-2.5 text-xs focus:border-accent outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-ink-muted block mb-1">
                      MQTT Topic String (Wildcard Supported)
                    </label>
                    <input
                      type="text"
                      value={mqttTopic}
                      onChange={(e) => {
                        setMqttTopic(e.target.value);
                        persistMeshSettings({ mqttTopic: e.target.value });
                      }}
                      className="w-full bg-raised border border-line text-accent font-bold rounded-xl p-2.5 text-xs focus:border-accent outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-ink-muted block mb-1">
                      MQTT Username (Official Public Default)
                    </label>
                    <input
                      type="text"
                      value={mqttUsername}
                      onChange={(e) => {
                        setMqttUsername(e.target.value);
                        persistMeshSettings({ mqttUsername: e.target.value });
                      }}
                      className="w-full bg-raised border border-line text-success-ink font-bold rounded-xl p-2.5 text-xs focus:border-accent outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-ink-muted block mb-1">
                      MQTT Password (Official Public Default)
                    </label>
                    <input
                      type="password"
                      value={mqttPassword}
                      onChange={(e) => {
                        setMqttPassword(e.target.value);
                        persistMeshSettings({ mqttPassword: e.target.value });
                      }}
                      className="w-full bg-raised border border-line text-success-ink font-bold rounded-xl p-2.5 text-xs focus:border-accent outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Regatta & Maritime Event Manager */}
              <div className="p-4 bg-raised rounded-2xl border border-line space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs text-ink-muted block">
                      Select Active Regatta & Maritime Event
                    </label>
                    <p className="text-xs text-accent mt-0.5">
                      Current Event: <strong>{selectedLocation.name}</strong> ({selectedLocation.organizer || 'Official Organiser'})
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent hover:brightness-110 text-on-accent text-xs font-bold transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddForm ? 'Close Form' : 'Add Event'}</span>
                  </button>
                </div>

                {/* Inline Add Custom Regatta Form */}
                {showAddForm && (
                  <div className="p-3.5 bg-raised rounded-xl border border-accent/60 space-y-3 animate-fadeIn">
                    <h5 className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-accent" />
                      Add Custom Regatta / Yacht Club Event
                    </h5>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-xs text-ink-muted block mb-1">
                          Regatta / Event Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Raja Muda Selangor Regatta 2026"
                          value={newRegattaName}
                          onChange={(e) => setNewRegattaName(e.target.value)}
                          className="w-full bg-raised border border-line text-ink rounded-lg p-2 text-xs outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-ink-muted block mb-1">
                          Organizing Body / Yacht Club
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Royal Selangor Yacht Club (RSYC)"
                          value={newOrganizer}
                          onChange={(e) => setNewOrganizer(e.target.value)}
                          className="w-full bg-raised border border-line text-ink rounded-lg p-2 text-xs outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-ink-muted block mb-1">
                          Region / Maritime Waters
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Port Klang / Selat Klang Waters"
                          value={newRegion}
                          onChange={(e) => setNewRegion(e.target.value)}
                          className="w-full bg-raised border border-line text-ink rounded-lg p-2 text-xs outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-ink-muted block mb-1">
                          MQTT Stream Topic
                        </label>
                        <input
                          type="text"
                          placeholder="msh/MY_919/2/e/RSYC_Custom/#"
                          value={newTopic}
                          onChange={(e) => setNewTopic(e.target.value)}
                          className="w-full bg-raised border border-line text-accent rounded-lg p-2 text-xs outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-ink-muted block mb-1">
                          Center Latitude
                        </label>
                        <input
                          type="text"
                          placeholder="3.001"
                          value={newLat}
                          onChange={(e) => setNewLat(e.target.value)}
                          className="w-full bg-raised border border-line text-ink rounded-lg p-2 text-xs outline-none focus:border-accent"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-ink-muted block mb-1">
                          Center Longitude
                        </label>
                        <input
                          type="text"
                          placeholder="101.378"
                          value={newLng}
                          onChange={(e) => setNewLng(e.target.value)}
                          className="w-full bg-raised border border-line text-ink rounded-lg p-2 text-xs outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="px-3 py-1.5 rounded-lg bg-raised hover:bg-raised text-ink text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddCustomRegatta}
                        disabled={!newRegattaName.trim()}
                        className="px-4 py-1.5 rounded-lg bg-success-ink hover:brightness-110 disabled:opacity-50 text-canvas text-xs font-bold"
                      >
                        Save & Activate Regatta
                      </button>
                    </div>
                  </div>
                )}

                {/* Regatta Cards List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
                  {regattaList.map((loc) => {
                    const isSelected = selectedLocation.id === loc.id;
                    const isCustom = loc.id.startsWith('CUSTOM_REGATTA_');

                    return (
                      <div
                        key={loc.id}
                        onClick={() => {
                          onSelectLocation(loc);
                          setMqttTopic(loc.publicMqttTopic);
                          persistMeshSettings({ mqttTopic: loc.publicMqttTopic });
                        }}
                        className={`p-3 rounded-xl border text-left text-xs  transition-all flex flex-col gap-1.5 cursor-pointer relative ${
                          isSelected
                            ? 'bg-accent/20 border-accent text-ink shadow-sm ring-1 ring-accent'
                            : 'bg-raised border-line text-ink-muted hover:text-ink hover:border-line'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-bold text-ink flex items-center gap-1.5 text-xs leading-tight">
                            <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-accent' : 'text-ink-muted'}`} />
                            {loc.name}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            {isCustom && (
                              <button
                                onClick={(e) => handleDeleteCustomRegatta(loc.id, e)}
                                className="p-1 hover:bg-danger/20 text-danger-ink rounded transition-colors"
                                title="Delete Custom Event"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isSelected && (
                              <Check className="w-4 h-4 text-success-ink shrink-0" />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-ink-muted">
                          <span className="text-accent font-semibold">{loc.organizer || 'RSYC Organised'}</span>
                          <span>{loc.region}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Toggle Public Stream */}
              <div className="p-4 bg-raised rounded-2xl border border-line flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-ink flex items-center gap-2">
                    Malaysia Public LoRa MQTT Stream
                    {hardwareConn.malaysiaPublicMeshActive ? (
                      <span className="text-xs bg-success-ink/20 text-success-ink px-2 py-0.5 rounded-full font-bold">
                        STREAMING LIVE
                      </span>
                    ) : (
                      <span className="text-xs text-ink-muted">PAUSED</span>
                    )}
                  </h4>
                  <p className="text-xs text-ink-muted">
                    Topic: <strong className="text-accent">{mqttTopic}</strong>
                  </p>
                </div>

                <button
                  onClick={handleToggleMalaysiaMesh}
                  className={`py-2 px-4 rounded-full text-xs font-bold transition-all ${
                    hardwareConn.malaysiaPublicMeshActive
                      ? 'bg-success-ink text-canvas shadow-md'
                      : 'bg-accent text-on-accent shadow-md'
                  }`}
                >
                  {hardwareConn.malaysiaPublicMeshActive ? 'Connected (Disconnect)' : 'Start Public Stream'}
                </button>
              </div>

              {/* Active Malaysian Mesh Nodes */}
              <div>
                <label className="text-xs text-ink-muted block mb-2">
                  Malaysian Maritime Public Nodes Discovered ({nodes.filter((n) => n.connectionType === 'MALAYSIA_PUBLIC_LORA').length})
                </label>

                <div className="space-y-2">
                  {nodes
                    .filter((n) => n.connectionType === 'MALAYSIA_PUBLIC_LORA')
                    .map((node) => (
                      <div
                        key={node.id}
                        className="p-3 bg-raised rounded-xl border border-line flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-raised text-success-ink border border-line">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-ink">{node.longName}</span>
                              <span className="text-xs text-success-ink bg-success-ink/10 px-1.5 py-0.5 rounded-full">
                                {node.id}
                              </span>
                            </div>
                            <p className="text-xs text-ink-muted">
                              Region: <strong className="text-ink">{node.locationRegion}</strong> • RSSI:{' '}
                              <strong className="text-success-ink">{node.rssi ?? '—'} dBm</strong>
                            </p>
                          </div>
                        </div>

                        <span className="text-xs bg-success-ink/20 text-success-ink px-2.5 py-0.5 rounded-full border border-success-ink/30 font-bold">
                          MALAYSIA MESH
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Live Terminal */}
              <div className="bg-surface border border-line rounded-2xl p-3 text-xs space-y-1.5 h-36 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between text-xs text-ink-muted border-b border-line pb-1 mb-2">
                  <span className="flex items-center gap-1.5 text-success-ink">
                    <Terminal className="w-3.5 h-3.5" />
                    MALAYSIA PUBLIC LORA TELEMETRY STREAM
                  </span>
                  <span>{frequencyBand}</span>
                </div>

                {myMqttLogs.map((log, idx) => (
                  <div key={idx} className="text-ink text-xs truncate">
                    <span className="text-ink-muted select-none">&gt; </span>
                    <span className={log.includes('Connected') ? 'text-success-ink font-bold' : 'text-ink-muted'}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-raised border-t border-line flex items-center justify-between">
          <span className="text-xs text-success-ink flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Auto-saved to device storage
          </span>
          <button
            onClick={handleDone}
            className="px-6 py-2 rounded-full bg-accent text-on-accent font-bold text-xs shadow-md hover:brightness-110 transition-all flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
