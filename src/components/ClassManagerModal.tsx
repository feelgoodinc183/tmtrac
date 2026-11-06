import React, { useState, useEffect, useId } from 'react';
import { Boat, HandicapSystem, RaceClassDefinition, CourseProfile } from '../types/regatta';
import { X, Layers, Plus, Trash2, Edit2, Check, AlertTriangle, ShieldCheck, Tag, MapPin, Navigation } from 'lucide-react';
import { getSavedCourseProfiles } from '../services/courseProfileService';
import { DialogFrame } from './ui/Dialog';

interface ClassManagerModalProps {
  isOpen: boolean;
  classes: RaceClassDefinition[];
  boats: Boat[];
  onClose: () => void;
  onAddClass: (newClass: Omit<RaceClassDefinition, 'id'>) => void;
  onUpdateClass: (classId: string, updated: Partial<RaceClassDefinition>) => void;
  onDeleteClass: (classId: string, reassignToClassName?: string) => void;
  onOpenCourseProfiles?: () => void;
}

const CLASS_COLOR_PRESETS = [
  '#00D4FF', // Cyan
  '#00FF9D', // Emerald / Mint
  '#FBBC04', // Amber / Gold
  '#FF5252', // Red / Coral
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#F97316', // Orange
  '#38BDF8', // Sky Blue
];

const PRESET_TEMPLATES = [
  { name: 'Class 4 (Sportsboats)', desc: 'Platu 25, SB20, J/70, Melges 24', ratingSystem: 'IRC' as HandicapSystem, defaultRating: 1.000, color: '#38BDF8' },
  { name: 'Premier Cruising', desc: 'Performance cruiser monohulls > 45ft', ratingSystem: 'IRC' as HandicapSystem, defaultRating: 1.000, color: '#A855F7' },
  { name: 'Multihull Racing', desc: 'Corsair trimarans, Gunboat, Nacra, Catamarans', ratingSystem: 'PY' as HandicapSystem, defaultRating: 1.000, color: '#F97316' },
  { name: 'One-Design ILCA 7', desc: 'Olympic standard Laser / ILCA singlehanded', ratingSystem: 'PY' as HandicapSystem, defaultRating: 1.000, color: '#00D4FF' },
  { name: 'Club Classic PY', desc: 'Portsmouth Yardstick handicap fleet', ratingSystem: 'PY' as HandicapSystem, defaultRating: 1.000, color: '#EC4899' },
];

export const ClassManagerModal: React.FC<ClassManagerModalProps> = ({
  isOpen,
  classes,
  boats,
  onClose,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onOpenCourseProfiles,
}) => {
  const titleId = useId();
  const [isAdding, setIsAdding] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);

  // Form State (for both Add and Edit)
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRatingSystem, setFormRatingSystem] = useState<HandicapSystem>('IRC');
  const [formDefaultRating, setFormDefaultRating] = useState('1.000');
  const [formColor, setFormColor] = useState('#00D4FF');
  const [formCourseProfileId, setFormCourseProfileId] = useState<string>('');

  // Reassignment target for deletion
  const [reassignClass, setReassignClass] = useState<string>('');
  const [courseProfiles, setCourseProfiles] = useState<CourseProfile[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCourseProfiles(getSavedCourseProfiles());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingClassId(null);
    setFormName(`Class ${classes.length + 1}`);
    setFormDesc('');
    setFormRatingSystem('IRC');
    setFormDefaultRating('1.000');
    setFormColor(CLASS_COLOR_PRESETS[classes.length % CLASS_COLOR_PRESETS.length]);
    setFormCourseProfileId(courseProfiles[0]?.id || '');
    setIsAdding(true);
  };

  const handleStartEdit = (cls: RaceClassDefinition) => {
    setIsAdding(false);
    setEditingClassId(cls.id);
    setFormName(cls.name);
    setFormDesc(cls.description || '');
    setFormRatingSystem(cls.ratingSystem || 'IRC');
    setFormDefaultRating(cls.defaultRating?.toString() || '1.000');
    setFormColor(cls.color || '#00D4FF');
    setFormCourseProfileId(cls.courseProfileId || '');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const ratingVal = parseFloat(formDefaultRating);
    const validRating = !isNaN(ratingVal) && ratingVal > 0 ? ratingVal : 1.0;
    const selectedProfile = courseProfiles.find((p) => p.id === formCourseProfileId);

    if (isAdding) {
      onAddClass({
        name: formName.trim(),
        description: formDesc.trim(),
        ratingSystem: formRatingSystem,
        defaultRating: validRating,
        color: formColor,
        courseProfileId: selectedProfile?.id || undefined,
        courseProfileName: selectedProfile?.name || undefined,
      });
      setIsAdding(false);
    } else if (editingClassId) {
      onUpdateClass(editingClassId, {
        name: formName.trim(),
        description: formDesc.trim(),
        ratingSystem: formRatingSystem,
        defaultRating: validRating,
        color: formColor,
        courseProfileId: selectedProfile?.id || undefined,
        courseProfileName: selectedProfile?.name || undefined,
      });
      setEditingClassId(null);
    }
  };

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    const defaultProfile = courseProfiles[0];
    onAddClass({
      name: preset.name,
      description: preset.desc,
      ratingSystem: preset.ratingSystem,
      defaultRating: preset.defaultRating,
      color: preset.color,
      courseProfileId: defaultProfile?.id,
      courseProfileName: defaultProfile?.name,
    });
  };

  const handleConfirmDelete = (classId: string) => {
    onDeleteClass(classId, reassignClass || undefined);
    setDeletingClassId(null);
    setReassignClass('');
  };

  const getBoatsInClass = (className: string) => {
    return boats.filter((b) => b.class === className);
  };

  return (
    <DialogFrame
      onClose={onClose}
      labelledBy={titleId}
      overlayClassName="fixed inset-0 z-50 bg-canvas/85 backdrop-blur-md flex items-center justify-center p-4 landscape:p-1.5"
      className="bg-surface border border-line w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col text-ink max-h-[90vh] landscape:max-h-[98dvh] landscape:h-[98dvh] animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Modal Header */}
      <div className="p-4 landscape:py-2.5 bg-canvas border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 id={titleId} className="text-sm font-bold text-ink flex items-center gap-2">
              Regatta Race Classes Management
              <span className="text-xs bg-raised text-accent px-2 py-0.5 rounded-full border border-accent/20">
                {classes.length} Classes Defined
              </span>
            </h2>
            <span className="text-xs text-ink-muted">
              Create, customize, rename, or reassign fleet handicap classes
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

      {/* Modal Body */}
      <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
        {/* Header Action Bar */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-ink-muted flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-accent" />
            Active Race Classes
          </h3>

          {!isAdding && !editingClassId && (
            <button
              onClick={handleStartAdd}
              className="px-3 py-1.5 bg-accent hover:brightness-110 text-on-accent rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Class</span>
            </button>
          )}
        </div>

        {/* ADD / EDIT INLINE FORM */}
        {(isAdding || editingClassId) && (
          <form
            onSubmit={handleSaveForm}
            className="p-4 bg-canvas border border-accent/40 rounded-2xl space-y-3 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="text-xs font-bold text-accent flex items-center gap-1.5">
                {isAdding ? <Plus className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                {isAdding ? 'Create New Race Class' : 'Edit Race Class'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingClassId(null);
                }}
                className="text-xs text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-muted block mb-1">
                  Class Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Class 4, IRC Premier, ILCA 7"
                  className="w-full bg-surface border border-line focus:border-accent rounded-xl px-3 py-2 text-xs font-bold text-ink outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-ink-muted block mb-1">
                  Handicap System
                </label>
                <select
                  value={formRatingSystem}
                  onChange={(e) => setFormRatingSystem(e.target.value as HandicapSystem)}
                  className="w-full bg-surface border border-line focus:border-accent rounded-xl px-3 py-2 text-xs text-ink outline-none"
                >
                  <option value="IRC">IRC (Time-on-Time TCC)</option>
                  <option value="ORC">ORC (Club / International)</option>
                  <option value="PY">Portsmouth Yardstick (PY)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-muted block mb-1">
                  Description / Fleet Category
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. Sportsboats & Keelboats < 30ft"
                  className="w-full bg-surface border border-line focus:border-accent rounded-xl px-3 py-2 text-xs text-ink outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-ink-muted block mb-1">
                  Default Handicap Rating
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.5"
                  max="2.0"
                  value={formDefaultRating}
                  onChange={(e) => setFormDefaultRating(e.target.value)}
                  placeholder="1.000"
                  className="w-full bg-surface border border-line focus:border-accent rounded-xl px-3 py-2 text-xs font-bold text-success-ink outline-none"
                />
              </div>
            </div>

            {/* Target Course Linking Selector */}
            <div>
              <label className="text-xs text-ink-muted block mb-1">
                Assigned Target Course Profile
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={formCourseProfileId}
                  onChange={(e) => setFormCourseProfileId(e.target.value)}
                  className="flex-1 bg-surface border border-line focus:border-accent rounded-xl px-3 py-2 text-xs text-accent outline-none"
                >
                  <option value="">-- No specific course (Follow default live marks) --</option>
                  {courseProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.marks?.length || 0} marks • {p.totalDistanceNm != null && !isNaN(Number(p.totalDistanceNm)) ? Number(p.totalDistanceNm).toFixed(1) : '?'} NM)
                    </option>
                  ))}
                </select>
                {onOpenCourseProfiles && (
                  <button
                    type="button"
                    onClick={onOpenCourseProfiles}
                    className="px-2.5 py-2 rounded-xl bg-raised hover:bg-raised text-accent text-xs font-bold flex items-center gap-1 shrink-0"
                    title="Manage Saved Course Profiles"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Profiles</span>
                  </button>
                )}
              </div>
            </div>

            {/* Color Preset Palette */}
            <div>
              <label className="text-xs text-ink-muted block mb-1.5">
                Class Badge Color
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {CLASS_COLOR_PRESETS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={`w-6 h-6 rounded-lg transition-transform ${
                      formColor.toLowerCase() === c.toLowerCase()
                        ? 'scale-110 ring-2 ring-line ring-offset-2 ring-offset-line'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-6 h-6 rounded-lg bg-transparent cursor-pointer border border-line p-0"
                  title="Custom color picker"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingClassId(null);
                }}
                className="px-3 py-1.5 bg-raised hover:bg-raised text-ink text-xs rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-accent hover:brightness-110 text-on-accent text-xs rounded-xl font-bold flex items-center gap-1 transition-all shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isAdding ? 'Create Class' : 'Save Class'}</span>
              </button>
            </div>
          </form>
        )}

        {/* CLASSES LIST */}
        <div className="space-y-2.5">
          {classes.map((cls) => {
            const boatsInClass = getBoatsInClass(cls.name);
            const isDeletingThis = deletingClassId === cls.id;

            return (
              <div
                key={cls.id}
                className="p-3.5 bg-canvas border border-line hover:border-line rounded-2xl transition-all flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: cls.color || '#00D4FF' }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-bold text-ink truncate">
                          {cls.name}
                        </strong>
                        <span className="text-xs bg-raised text-accent px-2 py-0.2 rounded font-bold border border-line">
                          {cls.ratingSystem || 'IRC'}
                        </span>
                      </div>
                      {cls.description && (
                        <p className="text-xs text-ink-muted truncate mt-0.5">
                          {cls.description}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-ink-muted flex items-center gap-1">
                          <Navigation className="w-2.5 h-2.5 text-warning-ink" />
                          Course:
                        </span>
                        <span className={`text-xs  font-bold px-1.5 py-0.2 rounded ${cls.courseProfileName ? 'bg-warning-ink/10 text-warning-ink border border-warning-ink/30' : 'text-ink-muted'}`}>
                          {cls.courseProfileName || 'Default Live Course'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs bg-raised text-ink px-2 py-1 rounded-lg border border-line font-bold">
                      {boatsInClass.length} {boatsInClass.length === 1 ? 'Vessel' : 'Vessels'}
                    </span>

                    <button
                      onClick={() => handleStartEdit(cls)}
                      className="p-1.5 rounded-lg bg-raised hover:bg-raised text-ink hover:text-accent transition-all"
                      title="Edit Class details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        if (isDeletingThis) {
                          setDeletingClassId(null);
                        } else {
                          setDeletingClassId(cls.id);
                          // default reassign to first other class
                          const other = classes.find((c) => c.id !== cls.id);
                          setReassignClass(other?.name || '');
                        }
                      }}
                      className="p-1.5 rounded-lg bg-danger/10 hover:bg-danger/25 text-danger-ink hover:text-danger-ink border border-danger-ink/30 transition-all"
                      title="Delete Class"
                      disabled={classes.length <= 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Registered boats in this class pills */}
                {boatsInClass.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-line/60">
                    <span className="text-xs text-ink-muted">Assigned:</span>
                    {boatsInClass.map((b) => (
                      <span
                        key={b.id}
                        className="text-xs bg-surface text-ink px-1.5 py-0.5 rounded border border-line flex items-center gap-1"
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.color }} />
                        {b.name} ({b.sailNumber})
                      </span>
                    ))}
                  </div>
                )}

                {/* Delete Confirmation Box with Reassignment */}
                {isDeletingThis && (
                  <div className="p-3 bg-surface/40 border border-danger-ink/50 rounded-xl space-y-2.5 text-danger-ink mt-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-danger-ink">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Delete Race Class: {cls.name}?</span>
                    </div>

                    {boatsInClass.length > 0 && (
                      <div>
                        <p className="text-xs text-ink mb-1.5">
                          There are <strong>{boatsInClass.length} boats</strong> currently assigned to this class. Select where to move them:
                        </p>
                        <select
                          value={reassignClass}
                          onChange={(e) => setReassignClass(e.target.value)}
                          className="w-full bg-canvas border border-danger-ink/40 rounded-xl px-2.5 py-1.5 text-xs text-ink outline-none"
                        >
                          {classes
                            .filter((c) => c.id !== cls.id)
                            .map((c) => (
                              <option key={c.id} value={c.name}>
                                Reassign to: {c.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(cls.id)}
                        className="px-3 py-1.5 bg-danger hover:brightness-110 text-on-danger font-bold text-xs rounded-xl transition-all"
                      >
                        Confirm & Delete Class
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingClassId(null)}
                        className="px-3 py-1.5 bg-raised hover:bg-raised text-ink text-xs rounded-xl transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Preset Templates Section */}
        <div className="p-4 bg-canvas border border-line rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-muted font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-success-ink" />
              Add Common Sailing Class Templates
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESET_TEMPLATES.map((preset) => {
              const alreadyExists = classes.some(
                (c) => c.name.toLowerCase() === preset.name.toLowerCase()
              );

              return (
                <button
                  key={preset.name}
                  disabled={alreadyExists}
                  onClick={() => handleApplyPreset(preset)}
                  className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    alreadyExists
                      ? 'bg-surface border-line opacity-40 cursor-not-allowed'
                      : 'bg-surface border-line hover:border-accent/50 hover:bg-surface group'
                  }`}
                >
                  <div>
                    <strong className="block text-xs font-bold text-ink group-hover:text-accent">
                      + {preset.name}
                    </strong>
                    <span className="text-xs text-ink-muted block">
                      {preset.desc}
                    </span>
                  </div>
                  <span className="text-xs bg-raised text-accent px-1.5 py-0.5 rounded shrink-0">
                    {preset.ratingSystem}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Footer */}
      <div className="p-4 bg-canvas border-t border-line flex items-center justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-raised hover:bg-raised text-ink rounded-xl text-xs font-bold transition-all"
        >
          Done
        </button>
      </div>
    </DialogFrame>
  );
};
