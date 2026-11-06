import React, { useState, useEffect, useId } from 'react';
import { Boat, MeshtasticNode, RaceClass, RaceClassDefinition, HandicapSystem, BoatStatus, DeviceGpsState } from '../types/regatta';
import { X, Anchor, Trash2, Save, Plus, Radio, AlertTriangle, Layers, Navigation } from 'lucide-react';
import { formatLastHeard } from '../utils/formatters';
import { normalizeSail } from '../utils/sailNumber';
import { DialogFrame } from './ui/Dialog';

interface BoatEditorModalProps {
  isOpen: boolean;
  boatToEdit: Boat | null; // null means "Create New Boat"
  nodes: MeshtasticNode[];
  /** The fleet, to stop two boats sharing a sail number */
  boats?: Boat[];
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
  boats = [],
  onClose,
  onSaveBoat,
  onDeleteBoat,
  raceClasses = [],
  onOpenClassManager,
}) => {
  const titleId = useId();
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
  const [sailError, setSailError] = useState<string | null>(null);
  const sailErrorId = useId();

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
    setSailError(null);
  }, [boatToEdit, isOpen, raceClasses]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sailNumber.trim()) return;
    const sail = normalizeSail(sailNumber);
    const clash = boats.find((b) => b.id !== boatToEdit?.id && normalizeSail(b.sailNumber || '') === sail);
    if (clash) {
      setSailError(`${clash.name} already has sail number ${sail}. Use a different number, or edit ${clash.name} instead.`);
      document.getElementById(sailErrorId + '-input')?.focus();
      return;
    }

    const parsedRating = parseFloat(handicapRating);
    const validRating = !isNaN(parsedRating) && parsedRating > 0 ? parsedRating : 1.0;

    onSaveBoat(
      {
        name: name.trim().toUpperCase(),
        sailNumber: sail,
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
    <DialogFrame
      onClose={onClose}
      labelledBy={titleId}
      overlayClassName="fixed inset-0 z-50 bg-canvas/85 backdrop-blur-md flex items-center justify-center p-4 landscape:p-1.5"
      className="bg-surface border border-line w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col text-ink animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] landscape:max-h-[98dvh] landscape:h-[98dvh]"
    >
      {/* Modal Header */}
      <div className="p-4 landscape:py-2.5 bg-canvas border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-canvas font-bold"
            style={{ backgroundColor: color }}
          >
            <Anchor className="w-4 h-4 text-canvas" />
          </div>
          <div>
            <h2 id={titleId} className="text-sm font-bold text-ink">
              {isEdit ? `Edit Vessel: ${boatToEdit.name}` : 'Add boat'}
            </h2>
            <span className="text-xs text-ink-muted">
              {isEdit ? `ID: ${boatToEdit.id}` : 'Register a boat to the regatta fleet'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Modal Body / Form */}
      <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
        {/* Row 1: Boat Name & Sail Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-muted block mb-1">
              Vessel Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. WIND RUNNER"
              className="w-full bg-canvas border border-line focus:border-accent rounded-xl px-3 py-2 text-xs font-semibold text-ink outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor={sailErrorId + '-input'} className="text-xs text-ink-muted block mb-1">
              Sail Number *
            </label>
            <input
              id={sailErrorId + '-input'}
              type="text"
              required
              value={sailNumber}
              onChange={(e) => {
                setSailNumber(e.target.value);
                if (sailError) setSailError(null);
              }}
              placeholder="e.g. MAS 888"
              aria-invalid={sailError ? true : undefined}
              aria-describedby={sailError ? sailErrorId : undefined}
              className={`w-full bg-canvas border focus:border-accent rounded-xl px-3 py-2 text-xs font-bold text-accent outline-none transition-all ${
                sailError ? 'border-danger-ink' : 'border-line'
              }`}
            />
            {sailError && (
              <p id={sailErrorId} role="alert" className="mt-1 text-xs text-danger-ink">
                {sailError}
              </p>
            )}
          </div>
        </div>

        {/* Row 2: Skipper & Class */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-ink-muted block mb-1">
              Skipper / Helm Name
            </label>
            <input
              type="text"
              value={skipper}
              onChange={(e) => setSkipper(e.target.value)}
              placeholder="e.g. Capt. Azman"
              className="w-full bg-canvas border border-line focus:border-accent rounded-xl px-3 py-2 text-xs text-ink outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-ink-muted block">
                Race Class
              </label>
              {onOpenClassManager && (
                <button
                  type="button"
                  onClick={onOpenClassManager}
                  className="text-xs text-accent hover:underline flex items-center gap-0.5"
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
              className="w-full bg-canvas border border-line focus:border-accent rounded-xl px-3 py-2 text-xs text-ink outline-none transition-all"
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
            <label className="text-xs text-ink-muted block mb-1">
              Handicap System
            </label>
            <select
              value={handicapSystem}
              onChange={(e) => {
                const next = e.target.value as HandicapSystem;
                // Keep the same rating in the new form: 1.100 ⇄ Portsmouth Number 1100
                const r = parseFloat(handicapRating);
                if (Number.isFinite(r) && r > 0) {
                  if (next === 'PY' && r < 100) setHandicapRating(String(Math.round(r * 1000)));
                  if (next !== 'PY' && r >= 100) setHandicapRating((r / 1000).toFixed(3));
                }
                setHandicapSystem(next);
              }}
              className="w-full bg-canvas border border-line focus:border-accent rounded-xl px-3 py-2 text-xs text-ink outline-none transition-all"
            >
              <option value="IRC">IRC (Time-on-Time TCC)</option>
              <option value="ORC">ORC (Club / International)</option>
              <option value="PY">Portsmouth Yardstick (PY)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="boat-rating" className="text-xs text-ink-muted block">
                {handicapSystem === 'PY' ? 'Portsmouth Number' : 'Handicap Rating / TCC'}
              </label>
              <button
                type="button"
                onClick={() => setHandicapRating(handicapSystem === 'PY' ? '1000' : '1.000')}
                className="text-xs text-accent hover:underline"
                title={handicapSystem === 'PY' ? 'Reset to 1000' : 'Reset to 1.000 default'}
              >
                {handicapSystem === 'PY' ? 'Default (1000)' : 'Default (1.000)'}
              </button>
            </div>
            {/* PY is a Portsmouth Number (e.g. 1100: corrected = elapsed × 1000 ÷ PN); IRC and ORC a TCC */}
            <input
              id="boat-rating"
              type="number"
              step={handicapSystem === 'PY' ? '1' : '0.001'}
              min={handicapSystem === 'PY' ? '500' : '0.500'}
              max={handicapSystem === 'PY' ? '2000' : '2.000'}
              value={handicapRating}
              onChange={(e) => setHandicapRating(e.target.value)}
              placeholder={handicapSystem === 'PY' ? '1100' : '1.000'}
              className="w-full bg-canvas border border-line focus:border-accent rounded-xl px-3 py-2 text-xs font-bold text-success-ink outline-none transition-all"
            />
          </div>
        </div>

        {/* Row 4: Assigned Meshtastic / Mobile GPS Node */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-ink-muted flex items-center gap-1">
              <Radio className="w-3 h-3 text-accent" />
              Assigned Meshtastic Node / Mobile Phone GPS
            </label>
            <span className="text-xs text-accent font-bold">Auto-Syncs Live Position</span>
          </div>
          <select
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            className="w-full bg-canvas border border-line focus:border-accent rounded-xl px-3 py-2 text-xs text-accent outline-none transition-all"
          >
            <option value="">No tracker yet</option>
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
            <p className="mt-1 text-xs text-success-ink flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              Vessel will immediately lock to this tracker's real-time physical GPS coordinates.
            </p>
          )}
        </div>

        {/* Row 5: Vessel Color on Map */}
        <div>
          <label className="text-xs text-ink-muted block mb-1.5">
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
                    ? 'scale-110 ring-2 ring-line ring-offset-2 ring-offset-line'
                    : 'hover:scale-105 opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-7 h-7 rounded-xl bg-transparent cursor-pointer border border-line p-0"
              title="Custom color picker"
            />
          </div>
        </div>

        {/* Row 6: Race Status (if editing) */}
        {isEdit && (
          <div>
            <label className="text-xs text-ink-muted block mb-1">
              Race Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as BoatStatus)}
              className="w-full bg-canvas border border-line focus:border-accent rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none transition-all"
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
          <div className="p-3 bg-surface/40 border border-danger-ink/50 rounded-xl space-y-2 text-danger-ink">
            <div className="flex items-center gap-2 text-xs font-bold text-danger-ink">
              <AlertTriangle className="w-4 h-4" />
              <span>Confirm Vessel Deletion</span>
            </div>
            <p className="text-xs text-ink">
              Are you sure you want to remove <strong>{boatToEdit.name} ({boatToEdit.sailNumber})</strong> from the regatta fleet?
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-1.5 bg-danger hover:brightness-110 text-on-danger font-bold text-xs rounded-lg transition-all"
              >
                Yes, Delete Vessel
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 bg-raised hover:bg-raised text-ink text-xs rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Form Actions Footer */}
        <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
          <div>
            {isEdit && !showDeleteConfirm && onDeleteBoat && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 bg-danger/10 hover:bg-danger/20 text-danger-ink border border-danger-ink/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
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
              className="px-4 py-2 bg-raised hover:bg-raised text-ink rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-accent hover:brightness-110 text-on-accent rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg"
            >
              {isEdit ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{isEdit ? 'Save Changes' : 'Add boat'}</span>
            </button>
          </div>
        </div>
      </form>
    </DialogFrame>
  );
};
