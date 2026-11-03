import React, { useState, useEffect } from 'react';
import { Boat, HandicapSystem, RaceClassDefinition, CourseProfile } from '../types/regatta';
import { X, Layers, Plus, Trash2, Edit2, Check, AlertTriangle, ShieldCheck, Tag, MapPin, Navigation } from 'lucide-react';
import { getSavedCourseProfiles } from '../services/courseProfileService';

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
    <div className="fixed inset-0 z-50 bg-[#020408]/85 backdrop-blur-md flex items-center justify-center p-4 landscape:p-1.5">
      <div className="bg-[#0A0F1E] border border-[#1E293B] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#E0E6ED] max-h-[90vh] landscape:max-h-[98dvh] landscape:h-[98dvh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 landscape:py-2.5 bg-[#060B16] border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00D4FF]/10 border border-[#00D4FF]/30 flex items-center justify-center text-[#00D4FF]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-google flex items-center gap-2">
                Regatta Race Classes Management
                <span className="text-[10px] bg-[#1E293B] text-cyan-300 font-mono px-2 py-0.5 rounded-full border border-cyan-500/20">
                  {classes.length} Classes Defined
                </span>
              </h2>
              <span className="text-[10px] text-[#64748B] font-mono">
                Create, customize, rename, or reassign fleet handicap classes
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#94A3B8] uppercase font-mono tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#00D4FF]" />
              Active Race Classes
            </h3>

            {!isAdding && !editingClassId && (
              <button
                onClick={handleStartAdd}
                className="px-3 py-1.5 bg-[#00D4FF] hover:bg-cyan-300 text-slate-950 rounded-xl text-xs font-bold font-google flex items-center gap-1.5 transition-all shadow-md"
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
              className="p-4 bg-[#060B16] border border-[#00D4FF]/40 rounded-2xl space-y-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                <span className="text-xs font-bold text-[#00D4FF] font-google flex items-center gap-1.5">
                  {isAdding ? <Plus className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                  {isAdding ? 'Create New Race Class' : 'Edit Race Class'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingClassId(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1">
                    Class Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Class 4, IRC Premier, ILCA 7"
                    className="w-full bg-[#0A0F1E] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1">
                    Handicap System
                  </label>
                  <select
                    value={formRatingSystem}
                    onChange={(e) => setFormRatingSystem(e.target.value as HandicapSystem)}
                    className="w-full bg-[#0A0F1E] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="IRC">IRC (Time-on-Time TCC)</option>
                    <option value="ORC">ORC (Club / International)</option>
                    <option value="PY">Portsmouth Yardstick (PY)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1">
                    Description / Fleet Category
                  </label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="e.g. Sportsboats & Keelboats < 30ft"
                    className="w-full bg-[#0A0F1E] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1">
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
                    className="w-full bg-[#0A0F1E] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#00FF9D] outline-none"
                  />
                </div>
              </div>

              {/* Target Course Linking Selector */}
              <div>
                <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1">
                  Assigned Target Course Profile
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={formCourseProfileId}
                    onChange={(e) => setFormCourseProfileId(e.target.value)}
                    className="flex-1 bg-[#0A0F1E] border border-[#1E293B] focus:border-[#00D4FF] rounded-xl px-3 py-2 text-xs font-mono text-[#00D4FF] outline-none"
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
                      className="px-2.5 py-2 rounded-xl bg-[#1E293B] hover:bg-slate-700 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1 shrink-0"
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
                <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1.5">
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
                          ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#060B16]'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-6 h-6 rounded-lg bg-transparent cursor-pointer border border-slate-700 p-0"
                    title="Custom color picker"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1E293B]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingClassId(null);
                  }}
                  className="px-3 py-1.5 bg-[#1E293B] hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-google font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#00D4FF] hover:bg-cyan-300 text-slate-950 text-xs rounded-xl font-google font-bold flex items-center gap-1 transition-all shadow-md"
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
                  className="p-3.5 bg-[#060B16] border border-[#1E293B] hover:border-[#334155] rounded-2xl transition-all flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: cls.color || '#00D4FF' }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-white font-google truncate">
                            {cls.name}
                          </strong>
                          <span className="text-[9px] font-mono bg-[#1E293B] text-[#00D4FF] px-2 py-0.2 rounded font-bold border border-[#334155]">
                            {cls.ratingSystem || 'IRC'}
                          </span>
                        </div>
                        {cls.description && (
                          <p className="text-[10px] text-[#94A3B8] font-mono truncate mt-0.5">
                            {cls.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[9px] font-mono text-[#64748B] flex items-center gap-1">
                            <Navigation className="w-2.5 h-2.5 text-[#FBBC04]" />
                            Course:
                          </span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${cls.courseProfileName ? 'bg-[#FBBC04]/10 text-[#FBBC04] border border-[#FBBC04]/30' : 'text-[#64748B]'}`}>
                            {cls.courseProfileName || 'Default Live Course'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded-lg border border-slate-700 font-bold">
                        {boatsInClass.length} {boatsInClass.length === 1 ? 'Vessel' : 'Vessels'}
                      </span>

                      <button
                        onClick={() => handleStartEdit(cls)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-[#00D4FF] transition-all"
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
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 transition-all"
                        title="Delete Class"
                        disabled={classes.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Registered boats in this class pills */}
                  {boatsInClass.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#1E293B]/60">
                      <span className="text-[9px] font-mono text-[#64748B]">Assigned:</span>
                      {boatsInClass.map((b) => (
                        <span
                          key={b.id}
                          className="text-[9px] font-mono bg-[#0A0F1E] text-slate-300 px-1.5 py-0.5 rounded border border-[#1E293B] flex items-center gap-1"
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.color }} />
                          {b.name} ({b.sailNumber})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Delete Confirmation Box with Reassignment */}
                  {isDeletingThis && (
                    <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-xl space-y-2.5 text-red-200 mt-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-red-400 font-google">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Delete Race Class: {cls.name}?</span>
                      </div>

                      {boatsInClass.length > 0 && (
                        <div>
                          <p className="text-[11px] text-slate-300 mb-1.5">
                            There are <strong>{boatsInClass.length} boats</strong> currently assigned to this class. Select where to move them:
                          </p>
                          <select
                            value={reassignClass}
                            onChange={(e) => setReassignClass(e.target.value)}
                            className="w-full bg-[#060B16] border border-red-500/40 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none font-mono"
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
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl font-google transition-all"
                        >
                          Confirm & Delete Class
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingClassId(null)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-google transition-all"
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
          <div className="p-4 bg-[#060B16] border border-[#1E293B] rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00FF9D]" />
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
                        ? 'bg-[#0A0F1E] border-[#1E293B] opacity-40 cursor-not-allowed'
                        : 'bg-[#0A0F1E] border-[#1E293B] hover:border-[#00D4FF]/50 hover:bg-slate-900 group'
                    }`}
                  >
                    <div>
                      <strong className="block text-[11px] font-bold text-white group-hover:text-[#00D4FF]">
                        + {preset.name}
                      </strong>
                      <span className="text-[9px] text-[#64748B] font-mono block">
                        {preset.desc}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded shrink-0">
                      {preset.ratingSystem}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#060B16] border-t border-[#1E293B] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1E293B] hover:bg-slate-700 text-white rounded-xl text-xs font-bold font-google transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
