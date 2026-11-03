import React, { useState, useEffect } from 'react';
import { Boat, MeshtasticNode, RaceClass, RaceClassDefinition, HandicapSystem, BoatStatus, DeviceGpsState } from '../types/regatta';
import { X, Anchor, Trash2, Save, Plus, Radio, AlertTriangle, Layers, Navigation } from 'lucide-react';
import { formatLastHeard } from '../utils/formatters';

interface BoatEditorModalProps {
  isOpen: boolean;
  boatToEdit: Boat | null; // null means "Create New Boat"
  nodes: MeshtasticNode[];
  deviceGps?: DeviceGpsState;
  onClose: () => void;
  onSaveBoat: (boatData: Partial<Boat>, isEdit: boolean, originalId?: string) => void;
  onDeleteBoat?: (boatId: string) => void;
  raceClasses?: RaceClassDefinition[];
  onOpenClassManager?: () => void;
}

const COLOR_PRESETS = [
  '#00D4FF', // Cyan
  '#00FF9D', // Emerald / Neon Green
  '#FBBC04', // Amber / Gold
  '#FF5252', // Red / Coral
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#38BDF8', // Sky Blue
  '#F97316', // Orange
  '#E2E8F0', // White / Silver
];

export const BoatEditorModal: React.FC<BoatEditorModalProps> = ({
  isOpen,
  boatToEdit,
  nodes,
  onClose,
  onSaveBoat,
  onDeleteBoat,
  raceClasses = [],
  onOpenClassManager,
}) => {
  const isEdit = !!boatToEdit;

  const [name, setName] = useState('');
  const [sailNumber, setSailNumber] = useState('');
  const [boatClass, setBoatClass] = useState<RaceClass>('Class 1');
  const [handicapSystem, setHandicapSystem] = useState<HandicapSystem>('IRC');
  const [handicapRating, setHandicapRating] = useState('1.000');
  const [skipper, setSkipper] = useState('');
  const [nodeId, setNodeId] = useState<string>('');
  const [color, setColor] = useState('#00D4FF');
  const [status, setStatus] = useState<BoatStatus>('PRE_START');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (boatToEdit) {
      setName(boatToEdit.name || '');
      setSailNumber(boatToEdit.sailNumber || '');
      setBoatClass(boatToEdit.class || (raceClasses[0]?.name ?? 'Class 1'));
      setHandicapSystem(boatToEdit.handicapSystem || 'IRC');
      setHandicapRating(boatToEdit.handicapRating?.toString() || '1.000');
      setSkipper(boatToEdit.skipper || '');
      setNodeId(boatToEdit.nodeId || '');
      setColor(boatToEdit.color || '#00D4FF');
      setStatus(boatToEdit.status || 'PRE_START');
    } else {
      // New default
      setName('');
      setSailNumber('');
      setBoatClass(raceClasses[0]?.name ?? 'Class 1');
      setHandicapSystem('IRC');
      setHandicapRating('1.000');
      setSkipper('');
      setNodeId('');
      setColor(COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)]);
      setStatus('PRE_START');
    }
    setShowDeleteConfirm(false);
  }, [boatToEdit, isOpen, raceClasses]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sailNumber.trim()) return;

    const parsedRating = parseFloat(handicapRating);
    const validRating = !isNaN(parsedRating) && parsedRating > 0 ? parsedRating : 1.0;

    onSaveBoat(
      {
        name: name.trim().toUpperCase(),
        sailNumber: sailNumber.trim().toUpperCase(),
        class: boatClass,
        handicapSystem,
        handicapRating: validRating,
        skipper: skipper.trim() || 'Skipper',
        nodeId: nodeId ? nodeId : null,
        color,
        status,
      },
      isEdit,
      boatToEdit?.id
    );
    onClose();
  };

  const handleDelete = () => {
    if (boatToEdit && onDeleteBoat) {
      onDeleteBoat(boatToEdit.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#020408]/85 backdrop-blur-md flex items-center justify-center p-4 landscape:p-1.5">
      <div className="bg-[#0A0F1E] border border-[#1E293B] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#E0E6ED] animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] landscape:max-h-[98dvh] landscape:h-[98dvh]">
        {/* Modal Header */}
        <div className="p-4 landscape:py-2.5 bg-[#060B16] border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-950 font-bold"
              style={{ backgroundColor: color }}
            >
              <Anchor className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-google">
                {isEdit ? `Edit Vessel: ${boatToEdit.name}` : 'Add New Racing Vessel'}
              </h2>
              <span className="text-[10px] text-[#64748B] font-mono">
                {isEdit ? `ID: ${boatToEdit.id}` : 'Register a boat to the regatta fleet'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Row 1: Boat Name & Sail Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1">
                Vessel Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. WIND RUNNER"
                className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1">
                Sail Number *
              </label>
              <input
                type="text"
                required
                value={sailNumber}
                onChange={(e) => setSailNumber(e.target.value)}
                placeholder="e.g. MAS 888"
                className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#00D4FF] outline-none transition-all"
              />
            </div>
          </div>

          {/* Row 2: Skipper & Class */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1">
                Skipper / Helm Name
              </label>
              <input
                type="text"
                value={skipper}
                onChange={(e) => setSkipper(e.target.value)}
                placeholder="e.g. Capt. Azman"
                className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs text-white outline-none transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block">
                  Race Class
                </label>
                {onOpenClassManager && (
                  <button
                    type="button"
                    onClick={onOpenClassManager}
                    className="text-[9px] font-mono text-[#00D4FF] hover:underline flex items-center gap-0.5"
                    title="Add or Edit Race Classes"
                  >
                    <Layers className="w-2.5 h-2.5" />
                    <span>Manage</span>
                  </button>
                )}
              </div>
              <select
                value={boatClass}
                onChange={(e) => {
                  const selectedName = e.target.value;
                  setBoatClass(selectedName);
                  const matched = raceClasses.find((c) => c.name === selectedName);
                  if (matched) {
                    if (matched.ratingSystem) setHandicapSystem(matched.ratingSystem);
                    if (matched.defaultRating && !isEdit) setHandicapRating(matched.defaultRating.toString());
                  }
                }}
                className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs text-white outline-none transition-all"
              >
                {raceClasses.length > 0 ? (
                  raceClasses.map((cls) => (
                    <option key={cls.id} value={cls.name}>
                      {cls.name} {cls.description ? `(${cls.description})` : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Class 1">Class 1 (IRC Racing / Monohull)</option>
                    <option value="Class 2">Class 2 (Club Cruiser / Keelboat)</option>
                    <option value="Class 3">Class 3 (Multihull / Sportsboat)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Row 3: Handicap System & Rating */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1">
                Handicap System
              </label>
              <select
                value={handicapSystem}
                onChange={(e) => setHandicapSystem(e.target.value as HandicapSystem)}
                className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs text-white outline-none transition-all"
              >
                <option value="IRC">IRC (Time-on-Time TCC)</option>
                <option value="ORC">ORC (Club / International)</option>
                <option value="PY">Portsmouth Yardstick (PY)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block">
                  Handicap Rating / TCC
                </label>
                <button
                  type="button"
                  onClick={() => setHandicapRating('1.000')}
                  className="text-[9px] font-mono text-[#00D4FF] hover:underline"
                  title="Reset to 1.000 default"
                >
                  Default (1.000)
                </button>
              </div>
              <input
                type="number"
                step="0.001"
                min="0.500"
                max="2.000"
                value={handicapRating}
                onChange={(e) => setHandicapRating(e.target.value)}
                placeholder="1.000"
                className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#00FF9D] outline-none transition-all"
              />
            </div>
          </div>

          {/* Row 4: Assigned Meshtastic / Mobile GPS Node */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] flex items-center gap-1">
                <Radio className="w-3 h-3 text-[#00D4FF]" />
                Assigned Meshtastic Node / Mobile Phone GPS
              </label>
              <span className="text-[9px] text-[#00D4FF] font-mono font-bold">Auto-Syncs Live Position</span>
            </div>
            <select
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs font-mono text-[#00D4FF] outline-none transition-all"
            >
              <option value="">-- No Hardware Node Assigned (Autonomous Simulation) --</option>
              {nodes.map((n) => {
                const hasPos = typeof n.lat === 'number' && typeof n.lng === 'number' && !isNaN(n.lat) && !isNaN(n.lng) && n.lat !== 0 && n.lng !== 0;
                const posStr = hasPos ? ` • GPS Fix: ${n.lat.toFixed(4)}°, ${n.lng.toFixed(4)}°` : '';
                return (
                  <option key={n.id} value={n.id}>
                    {n.id} - {n.longName} ({n.connectionType || 'LORA'})${posStr} • {formatLastHeard(n.lastPingTime)}
                  </option>
                );
              })}
            </select>
            {nodeId && (
              <p className="mt-1 text-[10px] text-[#00FF9D] font-mono flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                Vessel will immediately lock to this tracker's real-time physical GPS coordinates.
              </p>
            )}
          </div>

          {/* Row 5: Vessel Color on Map */}
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1.5">
              Map Icon & Hull Color
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-xl transition-transform flex items-center justify-center ${
                    color.toLowerCase() === c.toLowerCase()
                      ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0A0F1E]'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded-xl bg-transparent cursor-pointer border border-slate-700 p-0"
                title="Custom color picker"
              />
            </div>
          </div>

          {/* Row 6: Race Status (if editing) */}
          {isEdit && (
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block mb-1">
                Race Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BoatStatus)}
                className="w-full bg-[#060B16] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs font-bold text-white outline-none transition-all"
              >
                <option value="PRE_START">PRE_START (Pre-Start Area / Checked In)</option>
                <option value="RACING">RACING (Active)</option>
                <option value="OCS">OCS (On Course Side / Over Line)</option>
                <option value="CLEARED_OCS">CLEARED OCS</option>
                <option value="FINISHED">FINISHED</option>
                <option value="RET">RET (Retired)</option>
                <option value="DNS">DNS (Did Not Start)</option>
                <option value="DNF">DNF (Did Not Finish)</option>
                <option value="DSQ">DSQ (Disqualified)</option>
              </select>
            </div>
          )}

          {/* Delete confirmation section */}
          {isEdit && showDeleteConfirm && (
            <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-xl space-y-2 text-red-200">
              <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Confirm Vessel Deletion</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Are you sure you want to remove <strong>{boatToEdit.name} ({boatToEdit.sailNumber})</strong> from the regatta fleet?
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition-all"
                >
                  Yes, Delete Vessel
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between gap-2">
            <div>
              {isEdit && !showDeleteConfirm && onDeleteBoat && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold font-google flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Vessel</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#1E293B] hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold font-google transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#00D4FF] hover:bg-cyan-300 text-slate-950 rounded-xl text-xs font-bold font-google flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20"
              >
                {isEdit ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{isEdit ? 'Save Changes' : 'Add Vessel'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
