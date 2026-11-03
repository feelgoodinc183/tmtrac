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
    <div className="fixed inset-0 z-50 bg-lb-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200 font-google">
      <div className="bg-lb-0a0f1e/95 backdrop-blur-md border border-ll-334155/80 rounded-3xl landscape:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-120px)] sm:max-h-[85vh] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-0 text-lt-e0e6ed">
        {/* Header */}
        <div className="px-5 py-4 landscape:py-2.5 border-b border-ll-1e293b bg-lb-060b16/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-2xl shrink-0 flex items-center justify-center font-mono font-bold text-xs ${
              isStart ? 'bg-lb-ff4d4d/20 text-lt-ff4d4d border border-ll-ff4d4d/40' :
              isFinish ? 'bg-lb-00ff9d/20 text-lt-00ff9d border border-ll-00ff9d/40' :
              'bg-lb-fbbc04/20 text-lt-fbbc04 border border-ll-fbbc04/40'
            }`}>
              {mark.shortName || (isStart ? 'START' : isFinish ? 'FINISH' : `#${mark.orderIndex}`)}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-lt-white flex items-center gap-2 truncate">
                {isSequential ? `Course Mark #${mark.orderIndex}` : isStart ? 'Start Line Mark' : 'Finish Line Mark'}
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-lb-1e293b text-lt-94a3b8">
                  {mark.type}
                </span>
              </h3>
              <p className="text-xs text-lt-64748b font-mono truncate">
                Lat: {safeFixed(mark.lat, 5)}° • Lng: {safeFixed(mark.lng, 5)}°
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-lt-94a3b8 hover:text-lt-white hover:bg-lb-1e293b/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 text-xs font-mono text-lt-e2e8f0 overflow-y-auto custom-scrollbar overscroll-contain flex-1 min-h-0">
          {/* Mark Name */}
          <div>
            <label className="text-xs text-lt-94a3b8 block mb-1">Mark Label / Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-lb-060b16 border border-ll-1e293b rounded-xl px-3 py-2 text-lt-white focus:border-ll-00d4ff focus:outline-none"
              placeholder="e.g. Mark 1 (Windward Top)"
            />
          </div>

          {/* Mark Type / Role */}
          <div>
            <label className="text-xs text-lt-94a3b8 block mb-1">Mark Role</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-lb-060b16 border border-ll-1e293b rounded-xl px-3 py-2 text-lt-white focus:border-ll-00d4ff focus:outline-none"
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
          <div className="bg-lb-060b16 p-3.5 rounded-xl border border-ll-1e293b space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-lt-00d4ff flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> GPS Coordinates
              </span>
              {deviceGps?.active && deviceGps.lat && (
                <button
                  type="button"
                  onClick={handleSetToGps}
                  className="text-xs text-lt-00ff9d hover:underline flex items-center gap-1"
                >
                  <Navigation className="w-3 h-3" /> Set to My GPS
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-lt-64748b block mb-0.5">Latitude (deg)</span>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg px-2.5 py-1.5 text-lt-white font-mono text-xs focus:border-ll-00d4ff focus:outline-none"
                />
              </div>
              <div>
                <span className="text-xs text-lt-64748b block mb-0.5">Longitude (deg)</span>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full bg-lb-0a0f1e border border-ll-1e293b rounded-lg px-2.5 py-1.5 text-lt-white font-mono text-xs focus:border-ll-00d4ff focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Rounding Direction & Geofence Radius */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-lt-94a3b8 block mb-1">Required Rounding</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setRequiredRounding('PORT')}
                  className={`py-1.5 rounded-lg border text-center font-bold text-xs transition-all ${
                    requiredRounding === 'PORT'
                      ? 'bg-lb-ff4d4d/20 border-ll-ff4d4d text-lt-ff4d4d'
                      : 'bg-lb-060b16 border-ll-1e293b text-lt-94a3b8'
                  }`}
                >
                  🔴 Port
                </button>
                <button
                  type="button"
                  onClick={() => setRequiredRounding('STARBOARD')}
                  className={`py-1.5 rounded-lg border text-center font-bold text-xs transition-all ${
                    requiredRounding === 'STARBOARD'
                      ? 'bg-lb-00ff9d/20 border-ll-00ff9d text-lt-00ff9d'
                      : 'bg-lb-060b16 border-ll-1e293b text-lt-94a3b8'
                  }`}
                >
                  🟢 Stbd
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-lt-94a3b8">Rounding Radius</label>
                <span className="text-lt-00d4ff font-bold">{radiusMeters}m</span>
              </div>
              <input
                type="range"
                min="15"
                max="100"
                step="5"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(parseInt(e.target.value))}
                className="w-full accent-ll-00d4ff"
              />
            </div>
          </div>

          {/* Reordering Controls (for Sequential Marks) */}
          {isSequential && (
            <div className="bg-lb-060b16 p-3 rounded-xl border border-ll-1e293b flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-lt-white block">Course Rounding Sequence</span>
                <span className="text-xs text-lt-64748b">Position in course routing: #{mark.orderIndex} of {totalSequentialMarks}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onMoveOrder(mark.id, 'UP')}
                  disabled={mark.orderIndex === 1}
                  className="p-1.5 rounded-lg bg-lb-1e293b hover:bg-lb-slate-700 disabled:opacity-30 text-lt-00d4ff"
                  title="Move Up in sequence"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveOrder(mark.id, 'DOWN')}
                  disabled={mark.orderIndex === totalSequentialMarks}
                  className="p-1.5 rounded-lg bg-lb-1e293b hover:bg-lb-slate-700 disabled:opacity-30 text-lt-00d4ff"
                  title="Move Down in sequence"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-ll-1e293b">
            <button
              type="button"
              onClick={() => {
                onDeleteMark(mark.id);
                onClose();
              }}
              className="px-3 py-2 bg-lb-ff4d4d/10 hover:bg-lb-ff4d4d/20 text-lt-ff4d4d border border-ll-ff4d4d/30 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold font-google"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Mark
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-lb-1e293b hover:bg-lb-slate-700 text-lt-94a3b8 hover:text-lt-white transition-colors text-xs font-bold font-google"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-lb-00d4ff hover:bg-lb-cyan-300 text-lt-020408 font-bold text-xs font-google transition-all shadow-[0_0_12px_rgba(0,212,255,0.4)] flex items-center gap-1.5"
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
