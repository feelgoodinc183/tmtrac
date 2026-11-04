import React, { useState, useEffect } from 'react';
import {
  HardwareConnection,
  MeshtasticNode,
  NmeaData,
  RegattaLocation,
  LoraCommandFlag,
  LoraBroadcastMessage,
  AdaptiveThrottleConfig,
} from '../types/regatta';
import { REGATTA_LOCATIONS } from '../services/initialData';
import { saveMqttConfig, meshtasticService } from '../services/meshtasticBleMqttService';
import {
  X,
  Compass,
  Globe,
  Terminal,
  CheckCircle2,
  MapPin,
  Server,
  Plus,
  Trash2,
  Building2,
  Check,
  Flag,
  BatteryCharging,
  Send,
  Volume2,
  ShieldCheck,
  Gauge,
  Smartphone,
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
  const [activeTab, setActiveTab] = useState<'MALAYSIA_LORA' | 'LORA_COMMAND_FLAGS' | 'ADAPTIVE_THROTTLE' | 'NMEA_INSTRUMENTS'>('MALAYSIA_LORA');

  // LORA COMMAND FLAGS & BROADCAST STATE
  const [selectedFlag, setSelectedFlag] = useState<LoraCommandFlag>('AP_POSTPONE');
  const [targetFleetClass, setTargetFleetClass] = useState<string>('ALL');
  const [customFlagNote, setCustomFlagNote] = useState('');
  const [broadcastMessages, setBroadcastMessages] = useState<LoraBroadcastMessage[]>([
    {
      id: 'cmd-init-1',
      flag: 'AP_POSTPONE',
      title: 'Flag AP (Postponement)',
      soundSignal: '2 Sound Signals',
      meaning: 'Races not started are postponed. Alert signal will be made 1 min after removal.',
      sentAt: Date.now() - 1800000,
      targetClass: 'ALL',
      acknowledgedNodeIds: ['!7A2C', '!MY-TECHO-BLE', '!NODE-03'],
      status: 'SENT',
    },
  ]);

  // ADAPTIVE THROTTLE CONFIGURATION STATE
  const [throttleConfig, setThrottleConfig] = useState<AdaptiveThrottleConfig>({
    mode: 'DYNAMIC_PROXIMITY',
    nearMarkRateHz: 2.0,
    openWaterRateHz: 0.2,
    proximityThresholdMeters: 150,
    dutyCycleLimitPercent: 1.0,
    currentDutyCycle: 0.38,
    batteryThresholdWarning: 20,
  });

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

  // NMEA Simulator state
  const [nmeaData, setNmeaData] = useState<NmeaData>({
    twsKt: 16.4,
    twdDeg: 225,
    awsKt: 19.8,
    awaDeg: 35,
    depthMeters: 14.8,
    waterTempC: 28.5,
    headingDeg: 260,
    rawSentence: '$MWWV,225,T,16.4,N,A*2C',
  });

  const [nmeaLogs, setNmeaLogs] = useState<string[]>([
    '[NMEA 0183] Ingesting $MWWV (Wind Speed & Angle)...',
    '[NMEA 2000] PGN 130306 Wind Data Received: TWS 16.4kt TWD 225°',
    '[NMEA Bridge] Broadcasting localized True Wind over LoRa mesh...',
  ]);

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

  // Handle NMEA Instrument slider changes
  const handleUpdateNmea = (key: keyof NmeaData, val: number) => {
    setNmeaData((prev) => {
      const updated = { ...prev, [key]: val };
      const sentence = `$MWWV,${updated.twdDeg},T,${updated.twsKt},N,A*2C`;
      return { ...updated, rawSentence: sentence };
    });

    setNmeaLogs((prev) => [
      `[NMEA Sent] $MWWV,${key === 'twdDeg' ? val : nmeaData.twdDeg},T,${key === 'twsKt' ? val : nmeaData.twsKt},N,A*2C`,
      ...prev.slice(0, 15),
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
                Malaysia LoRa MQTT Stream & NMEA Instruments
                <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/30">
                  MY_919 / MY_433 & NMEA
                </span>
              </h2>
              <p className="text-xs text-ink-muted">
                Customizable Public Malaysian Meshtastic Stream & Instrument Bridging
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

        {/* Tab Selection */}
        <div className="flex border-b border-line bg-raised/60 p-2 gap-1.5 shrink-0 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('MALAYSIA_LORA')}
            className={`py-2 px-3.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'MALAYSIA_LORA'
                ? 'bg-accent text-on-accent shadow-sm'
                : 'bg-raised text-ink-muted hover:text-ink border border-line'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            LoRa &amp; MQTT
            {hardwareConn.malaysiaPublicMeshActive && (
              <span className="w-2 h-2 rounded-full bg-success-ink" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('LORA_COMMAND_FLAGS')}
            className={`py-2 px-3.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'LORA_COMMAND_FLAGS'
                ? 'bg-warning-ink text-canvas shadow-sm'
                : 'bg-raised text-ink-muted hover:text-ink border border-line'
            }`}
          >
            <Flag className="w-3.5 h-3.5 text-warning-ink" />
            RC Command Flags ({broadcastMessages.length})
          </button>

          <button
            onClick={() => setActiveTab('ADAPTIVE_THROTTLE')}
            className={`py-2 px-3.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'ADAPTIVE_THROTTLE'
                ? 'bg-accent text-on-accent font-black shadow-sm'
                : 'bg-raised text-ink-muted hover:text-ink border border-line'
            }`}
          >
            <BatteryCharging className="w-3.5 h-3.5 text-success-ink" />
            Adaptive Throttle (MCMC 1%)
          </button>

          <button
            onClick={() => setActiveTab('NMEA_INSTRUMENTS')}
            className={`py-2 px-3.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'NMEA_INSTRUMENTS'
                ? 'bg-accent text-on-accent shadow-sm'
                : 'bg-raised text-ink-muted hover:text-ink border border-line'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            NMEA 2000 / 0183
            {hardwareConn.nmeaBridgeActive && (
              <span className="w-2 h-2 rounded-full bg-success-ink" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5 custom-scrollbar">
          {/* TAB 1: MALAYSIA PUBLIC LORA NODES */}
          {activeTab === 'MALAYSIA_LORA' && (
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
                              <strong className="text-success-ink">{node.rssi} dBm</strong>
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
          )}

          {/* TAB 2: LORA COMMAND FLAGS & BIDIRECTIONAL RC PROTOCOL */}
          {activeTab === 'LORA_COMMAND_FLAGS' && (
            <div className="space-y-4">
              {/* Broadcast Command Banner */}
              <div className="p-4 bg-raised rounded-2xl border border-line space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-warning-ink" />
                    <span className="text-xs font-bold text-ink">
                      Bidirectional RC Flag Command Broadcaster
                    </span>
                  </div>
                  <span className="text-xs text-success-ink bg-success-ink/10 px-2 py-0.5 rounded-full border border-success-ink/30">
                    LORA DIRECT &bull; 919.0 MHz
                  </span>
                </div>

                {/* Flag Preset Grid */}
                <div>
                  <label className="text-xs text-ink-muted block mb-2">
                    Select World Sailing Flag Signal
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'AP_POSTPONE', label: 'AP Postpone', glyph: 'AP', sounds: '2 Sounds', color: 'border-danger-ink/60 bg-danger/10' },
                      { id: 'GENERAL_RECALL', label: 'General Recall', glyph: '1st', sounds: '2 Sounds', color: 'border-warning-ink/60 bg-warning-ink/10' },
                      { id: 'INDIVIDUAL_RECALL', label: 'Flag X (OCS)', glyph: 'X', sounds: '1 Sound', color: 'border-accent/60 bg-accent/10' },
                      { id: 'BLACK_FLAG', label: 'Black Flag', glyph: 'Blk', sounds: '1 Sound', color: 'border-line/60 bg-raised/10' },
                      { id: 'P_FLAG', label: 'Flag P (Prep)', glyph: 'P', sounds: '1 Sound', color: 'border-accent/60 bg-accent/10' },
                      { id: 'S_SHORTEN', label: 'Flag S (Shorten)', glyph: 'S', sounds: '2 Sounds', color: 'border-warning-ink/60 bg-warning-ink/10' },
                      { id: 'N_ABANDON', label: 'Flag N (Abandon)', glyph: 'N', sounds: '3 Sounds', color: 'border-danger-ink/60 bg-danger/10' },
                      { id: 'SAFETY_RETURN', label: 'Safety Recall', glyph: 'SR', sounds: 'Horn Blast', color: 'border-warning-ink/60 bg-warning-ink/10' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFlag(f.id as LoraCommandFlag)}
                        className={`p-2.5 rounded-2xl border text-left transition-all ${
                          selectedFlag === f.id
                            ? `${f.color} ring-2 ring-line/40 shadow-md`
                            : 'border-line bg-raised hover:bg-raised'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold font-mono min-w-8 text-center">{f.glyph}</span>
                          <span className="text-xs text-ink-muted">{f.sounds}</span>
                        </div>
                        <div className="text-xs font-bold text-ink truncate">{f.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Fleet Class & Custom Announcement */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-ink-muted block mb-1">
                      Target Fleet Division
                    </label>
                    <select
                      value={targetFleetClass}
                      onChange={(e) => setTargetFleetClass(e.target.value)}
                      className="w-full bg-raised border border-line rounded-xl p-2 text-xs text-accent focus:border-accent outline-none"
                    >
                      <option value="ALL">All Divisions (Fleetwide)</option>
                      <option value="Class 1">Class 1 (IRC Racing)</option>
                      <option value="Class 2">Class 2 (Cruising)</option>
                      <option value="Class 3">Class 3 (Sportsboat)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs text-ink-muted block mb-1">
                      Optional Instruction Note
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Finish line set at Mark 2 Wing Mark"
                      value={customFlagNote}
                      onChange={(e) => setCustomFlagNote(e.target.value)}
                      className="w-full bg-raised border border-line rounded-xl p-2 text-xs text-ink focus:border-accent outline-none"
                    />
                  </div>
                </div>

                {/* Transmit Command Button */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <Volume2 className="w-4 h-4 text-warning-ink" />
                    <span>Triggers automatic RC acoustic horn sound sequence</span>
                  </div>

                  <button
                    onClick={() => {
                      const flagObj = {
                        AP_POSTPONE: { title: 'Flag AP (Postponement)', sound: '2 Sound Signals', meaning: 'Races not started are postponed. Alert signal will be made 1 min after removal.' },
                        GENERAL_RECALL: { title: '1st Substitute (General Recall)', sound: '2 Sound Signals', meaning: 'All boats recall. New start sequence.' },
                        INDIVIDUAL_RECALL: { title: 'Flag X (Individual Recall)', sound: '1 Sound Signal', meaning: 'Boats OCS return and restart cleanly.' },
                        BLACK_FLAG: { title: 'Black Flag (RRS 30.4)', sound: '1 Sound Signal', meaning: 'Rule 30.4 in effect. Disqualification without hearing for line transgressors.' },
                        P_FLAG: { title: 'Flag P (Preparatory)', sound: '1 Sound Signal', meaning: 'Standard 4-minute preparatory signal.' },
                        S_SHORTEN: { title: 'Flag S (Shorten Course)', sound: '2 Sound Signals', meaning: 'Finish between mark & RC vessel.' },
                        N_ABANDON: { title: 'Flag N (Abandonment)', sound: '3 Sound Signals', meaning: 'All races started or postponed are abandoned.' },
                        SAFETY_RETURN: { title: 'Safety Recall (Harbour Return)', sound: 'Continuous Horn', meaning: 'Severe weather alert. All vessels return to harbour.' },
                      }[selectedFlag];

                      const newMsg: LoraBroadcastMessage = {
                        id: `cmd-${Date.now()}`,
                        flag: selectedFlag,
                        title: flagObj.title,
                        soundSignal: flagObj.sound,
                        meaning: customFlagNote || flagObj.meaning,
                        sentAt: Date.now(),
                        targetClass: targetFleetClass,
                        acknowledgedNodeIds: ['!7A2C', '!MY-TECHO-BLE', '!NODE-03', '!PHONE-GPS-44'],
                        status: 'SENT',
                      };

                      setBroadcastMessages((prev) => [newMsg, ...prev]);
                      setCustomFlagNote('');
                    }}
                    className="px-5 py-2.5 rounded-2xl bg-warning-ink hover:brightness-110 text-canvas font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Transmit Flag Over LoRa</span>
                  </button>
                </div>
              </div>

              {/* Simulated Sailor Mast Unit Display Preview */}
              <div className="p-4 bg-raised rounded-2xl border border-line space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-accent" />
                    Simulated Competitor Mast / OLED Telemetry Receiver
                  </span>
                  <span className="text-xs text-success-ink flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    2-Way ACK Active
                  </span>
                </div>

                <div className="bg-surface border-2 border-line rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-warning-ink/20 border-2 border-warning-ink flex items-center justify-center text-3xl shrink-0">
                      {{
                        AP_POSTPONE: '',
                        GENERAL_RECALL: '',
                        INDIVIDUAL_RECALL: '',
                        BLACK_FLAG: '',
                        P_FLAG: '',
                        S_SHORTEN: '',
                        N_ABANDON: '',
                        SAFETY_RETURN: '',
                      }[selectedFlag]}
                    </div>
                    <div>
                      <div className="text-sm font-black text-ink">{selectedFlag.replace('_', ' ')}</div>
                      <div className="text-xs text-warning-ink">
                        {{
                          AP_POSTPONE: '2 SOUNDS • RACES POSTPONED',
                          GENERAL_RECALL: '2 SOUNDS • START RECALLED',
                          INDIVIDUAL_RECALL: '1 SOUND • OCS RETURN',
                          BLACK_FLAG: '1 SOUND • RULE 30.4 ACTIVE',
                          P_FLAG: '1 SOUND • 4 MIN PREP',
                          S_SHORTEN: '2 SOUNDS • SHORTENED COURSE',
                          N_ABANDON: '3 SOUNDS • RACES ABANDONED',
                          SAFETY_RETURN: 'CONTINUOUS HORN • RETURN TO PORT',
                        }[selectedFlag]}
                      </div>
                      <div className="text-xs text-ink-muted mt-1">
                        Node Target: {targetFleetClass} &bull; Channel: 919 MHz Mesh
                      </div>
                    </div>
                  </div>

                  <div className="text-right sm:border-l border-line sm:pl-4">
                    <div className="text-xs text-success-ink font-bold">Telemetry Mast Unit</div>
                    <div className="text-xs text-ink">ACK Sent: 18ms</div>
                    <div className="text-xs text-ink-muted">SNR: +5.2 dB &bull; RSSI: -72 dBm</div>
                  </div>
                </div>
              </div>

              {/* Transmitted Messages & Acknowledgment Feed */}
              <div className="space-y-2">
                <span className="text-xs text-ink-muted block">
                  Broadcast Command Log ({broadcastMessages.length})
                </span>
                {broadcastMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3 bg-raised rounded-2xl border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{msg.title}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-warning-ink/20 text-warning-ink border border-warning-ink/30">
                          {msg.targetClass}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {new Date(msg.sentAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">{msg.meaning}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-success-ink bg-success-ink/10 px-2.5 py-1 rounded-xl border border-success-ink/20 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 text-success-ink" />
                        {msg.acknowledgedNodeIds.length} Nodes ACK&apos;d
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ADAPTIVE THROTTLE & MCMC COMPLIANCE */}
          {activeTab === 'ADAPTIVE_THROTTLE' && (
            <div className="space-y-4">
              {/* Top Overview & Compliance Card */}
              <div className="p-4 bg-raised rounded-2xl border border-line space-y-3">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <div className="flex items-center gap-2">
                    <BatteryCharging className="w-4 h-4 text-success-ink" />
                    <span className="text-xs font-bold text-ink">
                      Adaptive Battery &amp; Bandwidth Throttling Engine
                    </span>
                  </div>
                  <span className="text-xs text-accent bg-accent/10 px-2.5 py-0.5 rounded-full border border-accent/30 font-bold">
                    MCMC MALAYSIA COMPLIANT
                  </span>
                </div>

                <p className="text-xs text-ink-muted leading-relaxed">
                  Dynamic Smart Proximity automatically ramps node GPS burst frequency near rounding marks and the starting line to capture critical tactical overlaps, while dropping to an ultra-low power heartbeat on long open-water reaches.
                </p>

                {/* Preset Profiles */}
                <div>
                  <label className="text-xs text-ink-muted block mb-2">
                    Operational Mode Presets
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    {[
                      {
                        mode: 'DYNAMIC_PROXIMITY',
                        title: 'Dynamic Proximity (Smart)',
                        desc: '2.0 Hz near marks, 0.2 Hz on reach',
                        battery: '~28.5 hrs',
                        duty: '0.38%',
                        rec: true,
                      },
                      {
                        mode: 'RACE_BURST',
                        title: 'High Precision Regatta',
                        desc: 'Fixed 2.0 Hz constant telemetry',
                        battery: '~9.2 hrs',
                        duty: '0.85%',
                        rec: false,
                      },
                      {
                        mode: 'BALANCED',
                        title: 'Balanced Standard',
                        desc: 'Fixed 0.5 Hz (every 2 seconds)',
                        battery: '~18.4 hrs',
                        duty: '0.45%',
                        rec: false,
                      },
                      {
                        mode: 'BATTERY_SAVER',
                        title: 'Ultra Battery Saver',
                        desc: 'Fixed 0.1 Hz (every 10 seconds)',
                        battery: '~48.0 hrs',
                        duty: '0.12%',
                        rec: false,
                      },
                    ].map((p) => (
                      <button
                        key={p.mode}
                        onClick={() =>
                          setThrottleConfig((prev) => ({
                            ...prev,
                            mode: p.mode as any,
                            nearMarkRateHz: p.mode === 'DYNAMIC_PROXIMITY' ? 2.0 : p.mode === 'RACE_BURST' ? 2.0 : 0.5,
                            openWaterRateHz: p.mode === 'DYNAMIC_PROXIMITY' ? 0.2 : p.mode === 'BATTERY_SAVER' ? 0.1 : 0.5,
                            currentDutyCycle: parseFloat(p.duty),
                          }))
                        }
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          throttleConfig.mode === p.mode
                            ? 'border-accent bg-accent/10 ring-2 ring-accent/30'
                            : 'border-line bg-raised hover:bg-raised'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-ink">{p.title}</span>
                          {p.rec && (
                            <span className="text-xs px-1.5 py-0.2 rounded-full bg-success-ink/20 text-success-ink font-bold">
                              REC
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-muted mb-2">{p.desc}</p>
                        <div className="flex items-center justify-between text-xs text-ink">
                          <span>Bat: {p.battery}</span>
                          <span className="text-accent">{p.duty} Tx</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic Rates Sliders */}
              <div className="p-4 bg-raised rounded-2xl border border-line space-y-4">
                <span className="text-xs font-bold text-ink block">
                  Fine-Tune Dynamic Proximity Parameters
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Near Mark Burst Rate */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-muted">Near-Mark Burst:</span>
                      <span className="text-success-ink font-bold">{throttleConfig.nearMarkRateHz.toFixed(1)} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.5"
                      value={throttleConfig.nearMarkRateHz}
                      onChange={(e) =>
                        setThrottleConfig((prev) => ({
                          ...prev,
                          nearMarkRateHz: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-success-ink"
                    />
                    <span className="text-xs text-ink-muted">
                      1 packet every {(1 / throttleConfig.nearMarkRateHz).toFixed(1)}s
                    </span>
                  </div>

                  {/* Open Water Conservation Rate */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-muted">Open Water Rate:</span>
                      <span className="text-accent font-bold">{throttleConfig.openWaterRateHz.toFixed(1)} Hz</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={throttleConfig.openWaterRateHz}
                      onChange={(e) =>
                        setThrottleConfig((prev) => ({
                          ...prev,
                          openWaterRateHz: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-accent"
                    />
                    <span className="text-xs text-ink-muted">
                      1 packet every {(1 / throttleConfig.openWaterRateHz).toFixed(0)}s
                    </span>
                  </div>

                  {/* Proximity Radius */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-muted">Proximity Boundary:</span>
                      <span className="text-warning-ink font-bold">{throttleConfig.proximityThresholdMeters}m</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      step="25"
                      value={throttleConfig.proximityThresholdMeters}
                      onChange={(e) =>
                        setThrottleConfig((prev) => ({
                          ...prev,
                          proximityThresholdMeters: parseInt(e.target.value),
                        }))
                      }
                      className="w-full accent-warning-ink"
                    />
                    <span className="text-xs text-ink-muted">Radius around marks &amp; start line</span>
                  </div>
                </div>
              </div>

              {/* MCMC Airtime Duty Cycle Gauge & Battery Projections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Gauge 1: MCMC Duty Cycle */}
                <div className="p-4 bg-raised rounded-2xl border border-line space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink font-bold flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-accent" />
                      Airtime Duty Cycle (MCMC Standard)
                    </span>
                    <span className="text-success-ink font-bold">
                      {throttleConfig.currentDutyCycle.toFixed(2)}% / 1.00%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-surface rounded-full h-3 overflow-hidden p-0.5 border border-line">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        throttleConfig.currentDutyCycle > 0.9 ? 'bg-danger' : 'bg-success-ink'
                      }`}
                      style={{ width: `${Math.min(100, (throttleConfig.currentDutyCycle / 1.0) * 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-ink-muted">
                    <span>Compliant with Class Assignment 919-923 MHz</span>
                    <span className="text-success-ink font-bold">SAFETY MARGIN: OK</span>
                  </div>
                </div>

                {/* Gauge 2: Estimated Battery Run-times */}
                <div className="p-4 bg-raised rounded-2xl border border-line space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink font-bold flex items-center gap-1.5">
                      <BatteryCharging className="w-4 h-4 text-success-ink" />
                      Projected Hardware Battery Autonomy
                    </span>
                    <span className="text-success-ink font-bold">OPTIMIZED</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-raised p-2 rounded-xl border border-line">
                      <span className="text-xs text-ink-muted block">18650 Cell (3000mAh)</span>
                      <span className="text-base font-black text-ink">~28.5 Hours</span>
                    </div>
                    <div className="bg-raised p-2 rounded-xl border border-line">
                      <span className="text-xs text-ink-muted block">LiPo (1000mAh T-Echo)</span>
                      <span className="text-base font-black text-ink">~11.8 Hours</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NMEA INSTRUMENTS BRIDGING */}
          {activeTab === 'NMEA_INSTRUMENTS' && (
            <div className="space-y-4">
              <div className="p-4 bg-raised rounded-2xl border border-line space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <h4 className="text-xs font-bold text-ink flex items-center gap-2">
                    Onboard NMEA 2000 / 0183 Marine Instrument Ingestion
                  </h4>
                  <button
                    onClick={() =>
                      onUpdateHardwareConn({
                        nmeaBridgeActive: !hardwareConn.nmeaBridgeActive,
                      })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      hardwareConn.nmeaBridgeActive
                        ? 'bg-accent text-on-accent shadow-sm'
                        : 'bg-raised text-ink-muted border border-line'
                    }`}
                  >
                    {hardwareConn.nmeaBridgeActive ? 'NMEA BRIDGE ACTIVE' : 'ACTIVATE NMEA BRIDGE'}
                  </button>
                </div>

                {/* Instrument Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* True Wind Speed */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink-muted">True Wind Speed (TWS):</span>
                      <span className="text-accent font-bold">{nmeaData.twsKt} knots</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="0.5"
                      value={nmeaData.twsKt}
                      onChange={(e) => handleUpdateNmea('twsKt', parseFloat(e.target.value))}
                      className="w-full accent-accent"
                    />
                  </div>

                  {/* True Wind Direction */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink-muted">True Wind Angle (TWD):</span>
                      <span className="text-success-ink font-bold">{nmeaData.twdDeg}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="359"
                      value={nmeaData.twdDeg}
                      onChange={(e) => handleUpdateNmea('twdDeg', parseInt(e.target.value))}
                      className="w-full accent-success-ink"
                    />
                  </div>

                  {/* Depth */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink-muted">Water Depth ($SDDPT):</span>
                      <span className="text-warning-ink font-bold">{nmeaData.depthMeters} meters</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      step="0.5"
                      value={nmeaData.depthMeters}
                      onChange={(e) => handleUpdateNmea('depthMeters', parseFloat(e.target.value))}
                      className="w-full accent-warning-ink"
                    />
                  </div>

                  {/* Compass Heading */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink-muted">Magnetic Heading ($HCHDG):</span>
                      <span className="text-ink-muted font-bold">{nmeaData.headingDeg}°</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="359"
                      value={nmeaData.headingDeg}
                      onChange={(e) => handleUpdateNmea('headingDeg', parseInt(e.target.value))}
                      className="w-full accent-line"
                    />
                  </div>
                </div>

                {/* Raw NMEA Output */}
                <div className="bg-surface border border-line rounded-2xl p-3 text-xs space-y-1">
                  <span className="text-xs text-ink-muted block mb-1">
                    ACTIVE GENERATED NMEA 0183 SENTENCE ($MWWV):
                  </span>
                  <span className="text-accent font-bold">{nmeaData.rawSentence}</span>
                </div>
              </div>

              {/* NMEA Bridge Terminal Log */}
              <div className="bg-surface border border-line rounded-2xl p-3 text-xs space-y-1.5 h-36 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between text-xs text-ink-muted border-b border-line pb-1 mb-2">
                  <span className="flex items-center gap-1.5 text-accent">
                    <Terminal className="w-3.5 h-3.5" />
                    NMEA 2000 CAN-BUS / RS-422 SERIAL LOG
                  </span>
                  <span>4800 / 38400 BAUD</span>
                </div>

                {nmeaLogs.map((log, idx) => (
                  <div key={idx} className="text-ink text-xs truncate">
                    <span className="text-ink-muted select-none">&gt; </span>
                    <span className="text-ink-muted">{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
