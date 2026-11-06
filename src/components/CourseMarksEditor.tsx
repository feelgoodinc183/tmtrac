import React from 'react';
import { ChevronDown, ChevronUp, MapPin, Plus, Trash2 } from 'lucide-react';
import { CourseMark } from '../types/regatta';
import { removeCourseMark, moveMarkOrder, updateMarkSettings } from '../services/courseService';

export interface CourseMarksEditorProps {
  marks: CourseMark[];
  onUpdateMarks: (marks: CourseMark[]) => void;
  onOpenCourseProfiles?: () => void;
  courseProfileCount?: number;
  /** Replaces the course with a preset (App asks first when marks exist). */
  onApplyCoursePreset: (preset: 'WINDWARD_LEEWARD' | 'TRIANGLE' | 'TRAPEZOID') => void;
  /** Adds the next mark near the course, or where the map is looking when there is none. */
  onAddCourseMark: () => void;
}

/** Course marks: profiles, presets, add, reorder, flip rounding, delete. Used by Race Control and Setup. */
export const CourseMarksEditor: React.FC<CourseMarksEditorProps> = ({
  marks,
  onUpdateMarks,
  onOpenCourseProfiles,
  courseProfileCount = 0,
  onApplyCoursePreset,
  onAddCourseMark,
}) => (
  <div className="bg-canvas border border-line p-3.5 rounded-2xl space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <span className="text-xs text-ink-muted block">
          Course marks
        </span>
        <span className="text-xs text-ink">
          Marks are ordered sequentially (1, 2, 3...). Deleting a mark automatically shifts subsequent marks.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onOpenCourseProfiles && (
          <button
            type="button"
            onClick={onOpenCourseProfiles}
            className="px-3 py-1.5 bg-accent/20 hover:bg-accent/30 border border-accent/50 text-accent text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            title="Manage saved course mark profiles (Max 10)"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Profiles ({courseProfileCount}/10)</span>
          </button>
        )}

        <button
          type="button"
          onClick={onAddCourseMark}
          className="min-h-10 px-4 bg-accent text-on-accent text-sm font-semibold rounded-control flex items-center gap-1.5 hover:brightness-110 transition-[filter]"
        >
          <Plus className="w-4 h-4" /> Add mark #{marks.filter(m => m.type !== 'PIN_END' && m.type !== 'RC_BOAT' && m.type !== 'FINISH' && m.type !== 'FINISH_PIN' && m.type !== 'FINISH_RC').length + 1}
        </button>

        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line">
          <button
            type="button"
            onClick={() => onApplyCoursePreset('WINDWARD_LEEWARD')}
            className="px-2 py-1 rounded-lg text-xs text-ink-muted hover:text-ink hover:bg-raised transition-colors"
            title="Load Windward-Leeward Course"
          >
            Preset: W/L
          </button>
          <button
            type="button"
            onClick={() => onApplyCoursePreset('TRIANGLE')}
            className="px-2 py-1 rounded-lg text-xs text-ink-muted hover:text-ink hover:bg-raised transition-colors"
            title="Load Olympic Triangle Course"
          >
            Preset: Triangle
          </button>
          <button
            type="button"
            onClick={() => onApplyCoursePreset('TRAPEZOID')}
            className="px-2 py-1 rounded-lg text-xs text-ink-muted hover:text-ink hover:bg-raised transition-colors"
            title="Load Trapezoid Course"
          >
            Preset: Trapezoid
          </button>
        </div>
      </div>
    </div>

    {/* Marks List */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto custom-scrollbar">
      {marks.map((m) => {
        const isPin = m.type === 'PIN_END';
        const isRC = m.type === 'RC_BOAT';
        const isFinish = m.type === 'FINISH' || m.type === 'FINISH_PIN' || m.type === 'FINISH_RC';
        const isSeq = !isPin && !isRC && !isFinish;

        return (
          <div
            key={m.id}
            className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between ${
              isPin
                ? 'bg-danger/10 border-danger-ink/40 text-ink'
                : isRC
                ? 'bg-accent/10 border-accent/40 text-ink'
                : isFinish
                ? 'bg-success-ink/10 border-success-ink/40 text-ink'
                : 'bg-surface border-line text-ink'
            }`}
          >
            <div>
              <div className="font-bold flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs text-canvas ${
                      isPin ? 'bg-danger' : isRC ? 'bg-accent' : isFinish ? 'bg-success-ink' : 'bg-warning-ink'
                    }`}
                  >
                    {m.shortName || (isPin ? 'SP' : isRC ? 'RC' : isFinish ? 'FP' : `#${m.orderIndex}`)}
                  </span>
                  <span className="truncate max-w-[140px]">{m.name}</span>
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    m.requiredRounding === 'STARBOARD'
                      ? 'bg-success-ink/20 text-success-ink border border-success-ink/50'
                      : m.requiredRounding === 'PORT'
                      ? 'bg-danger text-on-danger border border-danger'
                      : 'bg-raised text-ink'
                  }`}
                >
                  {m.requiredRounding}
                </span>
              </div>

              <div className="text-xs text-ink-muted space-y-0.5 mt-1">
                <div>Lat: {m.lat != null ? Number(m.lat).toFixed(5) : '0.00000'}° • Lng: {m.lng != null ? Number(m.lng).toFixed(5) : '0.00000'}°</div>
                <div>Radius: {m.radiusMeters}m • Type: {m.type}</div>
              </div>
            </div>

            {/* Mark Action Controls */}
            <div className="mt-2 pt-2 border-t border-line/60 flex items-center justify-between gap-1">
              {isSeq && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateMarks(moveMarkOrder(marks, m.id, 'UP'))}
                    disabled={m.orderIndex === 1}
                    className="p-1 rounded bg-raised hover:bg-raised disabled:opacity-30 text-accent"
                    title="Move Up in sequence"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateMarks(moveMarkOrder(marks, m.id, 'DOWN'))}
                    className="p-1 rounded bg-raised hover:bg-raised text-accent"
                    title="Move Down in sequence"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    const nextRounding = m.requiredRounding === 'PORT' ? 'STARBOARD' : 'PORT';
                    onUpdateMarks(updateMarkSettings(marks, m.id, { requiredRounding: nextRounding }));
                  }}
                  className="px-2 py-0.5 rounded bg-raised text-xs text-accent hover:text-ink"
                  title="Toggle Port / Starboard Rounding"
                >
                  Flip Rounding
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateMarks(removeCourseMark(marks, m.id))}
                  className="p-1 rounded bg-danger/20 hover:bg-danger/40 text-danger-ink border border-danger-ink/40"
                  title="Delete Mark (subsequent numbers will auto-shift)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
