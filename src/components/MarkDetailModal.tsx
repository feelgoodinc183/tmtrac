import React, { useState, useEffect } from 'react';
import { CourseMark, DeviceGpsState } from '../types/regatta';
import { MapPin, Trash2, ArrowUp, ArrowDown, Navigation, Check, X, Shield, Compass, RotateCcw } from 'lucide-react';
import { safeFixed } from '../utils/formatters';

interface MarkDetailModalProps {
  mark: CourseMark | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateMark: (markId: string, updates: Partial<CourseMark>) => void;
  onDeleteMark: (markId: string) => void;
  onMoveOrder: (markId: string, direction: 'UP' | 'DOWN') => void;
  deviceGps?: DeviceGpsState;
  totalSequentialMarks: number;
}

export const MarkDetailModal: React.FC<MarkDetailModalProps> = ({
  mark,
  isOpen,
  onClose,
  onUpdateMark,
  onDeleteMark,
  onMoveOrder,
  deviceGps,
  totalSequentialMarks,
}) => {
  const [name, setName] = useState(mark?.name || '');
  const [type, setType] = useState<CourseMark['type']>(mark?.type || 'STANDARD');
  const [lat, setLat] = useState(mark?.lat?.toString() || '');
  const [lng, setLng] = useState(mark?.lng?.toString() || '');
  const [radiusMeters, setRadiusMeters] = useState(mark?.radiusMeters || 40);
  const [requiredRounding, setRequiredRounding] = useState<'PORT' | 'STARBOARD' | 'LINE'>(mark?.requiredRounding || 'PORT');

  // Synchronize modal state immediately when mark props update (e.g. sequence re-ordering or position change)
  useEffect(() => {
    if (mark) {
      setName(mark.name);
      setType(mark.type);
      setLat(mark.lat.toString());
      setLng(mark.lng.toString());
      setRadiusMeters(mark.radiusMeters || 40);
      setRequiredRounding(mark.requiredRounding || 'PORT');
    }
  }, [mark?.id, mark?.name, mark?.type, mark?.lat, mark?.lng, mark?.radiusMeters, mark?.requiredRounding, mark?.orderIndex]);

  if (!isOpen || !mark) return null;

  const isStart = mark.type === 'PIN_END' || mark.type === 'RC_BOAT';
  const isFinish = mark.type === 'FINISH' || mark.type === 'FINISH_PIN' || mark.type === 'FINISH_RC';
  const isSequential = !isStart && !isFinish;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) return;

    onUpdateMark(mark.id, {
      name,
      type,
      lat: parsedLat,
      lng: parsedLng,
      radiusMeters,
      requiredRounding,
    });
    onClose();
  };

  const handleSetToGps = () => {
    if (typeof deviceGps?.lat === 'number' && typeof deviceGps?.lng === 'number') {
      setLat(deviceGps.lat.toFixed(6));
      setLng(deviceGps.lng.toFixed(6));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200 font-google">
      <div className="bg-[#0A0F1E]/95 backdrop-blur-md border border-[#334155]/80 rounded-3xl landscape:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-120px)] sm:max-h-[85vh] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-0 text-[#E0E6ED]">
        {/* Header */}
        <div className="px-5 py-4 landscape:py-2.5 border-b border-[#1E293B] bg-[#060B16]/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center font-mono font-bold text-xs ${
              isStart ? 'bg-[#FF4D4D]/20 text-[#FF4D4D] border border-[#FF4D4D]/40' :
              isFinish ? 'bg-[#00FF9D]/20 text-[#00FF9D] border border-[#00FF9D]/40' :
              'bg-[#FBBC04]/20 text-[#FBBC04] border border-[#FBBC04]/40'
            }`}>
              {mark.shortName || (isStart ? 'START' : isFinish ? 'FINISH' : `#${mark.orderIndex}`)}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 truncate">
                {isSequential ? `Course Mark #${mark.orderIndex}` : isStart ? 'Start Line Mark' : 'Finish Line Mark'}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1E293B] text-[#94A3B8]">
                  {mark.type}
                </span>
              </h3>
              <p className="text-[11px] text-[#64748B] font-mono truncate">
                Lat: {safeFixed(mark.lat, 5)}° • Lng: {safeFixed(mark.lng, 5)}°
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 text-xs font-mono text-[#E2E8F0] overflow-y-auto custom-scrollbar overscroll-contain flex-1 min-h-0">
          {/* Mark Name */}
          <div>
            <label className="text-[11px] text-[#94A3B8] block mb-1">Mark Label / Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#060B16] border border-[#1E293B] rounded-xl px-3 py-2 text-white focus:border-[#00D4FF] focus:outline-none"
              placeholder="e.g. Mark 1 (Windward Top)"
            />
          </div>

          {/* Mark Type / Role */}
          <div>
            <label className="text-[11px] text-[#94A3B8] block mb-1">Mark Role</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-[#060B16] border border-[#1E293B] rounded-xl px-3 py-2 text-white focus:border-[#00D4FF] focus:outline-none"
            >
              <option value="WINDWARD">Windward Mark (Top Buoy)</option>
              <option value="WING">Wing / Jibe Mark</option>
              <option value="LEEWARD">Leeward Mark (Bottom Buoy)</option>
              <option value="GATE">Gate Mark</option>
              <option value="CUSTOM_MARK">Custom Course Mark</option>
              <option value="PIN_END">Start Pin End</option>
              <option value="RC_BOAT">Start RC Signal Boat</option>
              <option value="FINISH_PIN">Finish Pin End</option>
              <option value="FINISH_RC">Finish RC Boat</option>
              <option value="FINISH">Finish Line Mark</option>
            </select>
          </div>

          {/* GPS Coordinates */}
          <div className="bg-[#060B16] p-3.5 rounded-xl border border-[#1E293B] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#00D4FF] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> GPS Coordinates
              </span>
              {deviceGps?.active && deviceGps.lat && (
                <button
                  type="button"
                  onClick={handleSetToGps}
                  className="text-[10px] text-[#00FF9D] hover:underline flex items-center gap-1"
                >
                  <Navigation className="w-3 h-3" /> Set to My GPS
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-[#64748B] block mb-0.5">Latitude (deg)</span>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-[#00D4FF] focus:outline-none"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block mb-0.5">Longitude (deg)</span>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full bg-[#0A0F1E] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-[#00D4FF] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Rounding Direction & Geofence Radius */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#94A3B8] block mb-1">Required Rounding</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setRequiredRounding('PORT')}
                  className={`py-1.5 rounded-lg border text-center font-bold text-[11px] transition-all ${
                    requiredRounding === 'PORT'
                      ? 'bg-[#FF4D4D]/20 border-[#FF4D4D] text-[#FF4D4D]'
                      : 'bg-[#060B16] border-[#1E293B] text-[#94A3B8]'
                  }`}
                >
                  🔴 Port
                </button>
                <button
                  type="button"
                  onClick={() => setRequiredRounding('STARBOARD')}
                  className={`py-1.5 rounded-lg border text-center font-bold text-[11px] transition-all ${
                    requiredRounding === 'STARBOARD'
                      ? 'bg-[#00FF9D]/20 border-[#00FF9D] text-[#00FF9D]'
                      : 'bg-[#060B16] border-[#1E293B] text-[#94A3B8]'
                  }`}
                >
                  🟢 Stbd
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] text-[#94A3B8]">Rounding Radius</label>
                <span className="text-[#00D4FF] font-bold">{radiusMeters}m</span>
              </div>
              <input
                type="range"
                min="15"
                max="100"
                step="5"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(parseInt(e.target.value))}
                className="w-full accent-[#00D4FF]"
              />
            </div>
          </div>

          {/* Reordering Controls (for Sequential Marks) */}
          {isSequential && (
            <div className="bg-[#060B16] p-3 rounded-xl border border-[#1E293B] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Course Rounding Sequence</span>
                <span className="text-[10px] text-[#64748B]">Position in course routing: #{mark.orderIndex} of {totalSequentialMarks}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onMoveOrder(mark.id, 'UP')}
                  disabled={mark.orderIndex === 1}
                  className="p-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-700 disabled:opacity-30 text-[#00D4FF]"
                  title="Move Up in sequence"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveOrder(mark.id, 'DOWN')}
                  disabled={mark.orderIndex === totalSequentialMarks}
                  className="p-1.5 rounded-lg bg-[#1E293B] hover:bg-slate-700 disabled:opacity-30 text-[#00D4FF]"
                  title="Move Down in sequence"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#1E293B]">
            <button
              type="button"
              onClick={() => {
                onDeleteMark(mark.id);
                onClose();
              }}
              className="px-3 py-2 bg-[#FF4D4D]/10 hover:bg-[#FF4D4D]/20 text-[#FF4D4D] border border-[#FF4D4D]/30 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold font-google"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Mark
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-[#1E293B] hover:bg-slate-700 text-[#94A3B8] hover:text-white transition-colors text-xs font-bold font-google"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#00D4FF] hover:bg-cyan-300 text-[#020408] font-bold text-xs font-google transition-all shadow-[0_0_12px_rgba(0,212,255,0.4)] flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
