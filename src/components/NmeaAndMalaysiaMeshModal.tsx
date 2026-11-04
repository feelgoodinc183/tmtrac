import React, { useState } from 'react';
import {
  HardwareConnection,
  MeshtasticNode,
  RegattaLocation,
} from '../types/regatta';
import { REGATTA_LOCATIONS } from '../services/initialData';
import { MqttSettingsPanel } from './MqttSettingsPanel';
import { formatLastHeard } from '../utils/formatters';
import {
  X,
  Globe,
  CheckCircle2,
  MapPin,
  Plus,
  Trash2,
  Building2,
  Check,
} from 'lucide-react';

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



  const mqttNodes = nodes.filter((n) => n.connectionType === 'MQTT');

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
    }
  };

  const handleDone = () => {
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
              {/* Internet (MQTT) settings: the same panel as in the hardware window */}
              <div className="p-4 bg-raised rounded-2xl border border-line">
                <MqttSettingsPanel />
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

              {/* Nodes heard over MQTT */}
              <div>
                <label className="text-xs text-ink-muted block mb-2">
                  Nodes heard over the internet ({mqttNodes.length})
                </label>
                {mqttNodes.length === 0 ? (
                  <p className="text-xs text-ink-muted">None yet.</p>
                ) : (
                  <div className="space-y-2">
                    {mqttNodes.map((node) => (
                      <div key={node.id} className="p-3 bg-raised rounded-xl border border-line flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <Globe className="w-4 h-4 text-ink-muted shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-ink">{node.longName}</span>
                            <span className="ml-2 text-xs text-ink-muted">{node.id}</span>
                            <p className="text-xs text-ink-muted">
                              {node.lat !== undefined
                                ? node.positionErrorMeters
                                  ? `Approximate position (±${node.positionErrorMeters >= 1000 ? `${(node.positionErrorMeters / 1000).toFixed(1)} km` : `${node.positionErrorMeters} m`})`
                                  : 'Exact position'
                                : 'No position yet'}
                              {' · '}Heard {formatLastHeard(node.lastPingTime).toLowerCase()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-raised border-t border-line flex items-center justify-between">
          <span className="text-xs text-success-ink flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Regatta list is saved on this device
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
