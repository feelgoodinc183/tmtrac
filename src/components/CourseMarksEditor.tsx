import React from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { CourseMark } from '../types/regatta';
import { removeCourseMark, moveMarkOrder, updateMarkSettings } from '../services/courseService';
import { Button } from './ui/Button';

export interface CourseMarksEditorProps {
  marks: CourseMark[];
  onUpdateMarks?: (marks: CourseMark[]) => void;
  /** Adds the next mark near the course, or where the map is looking when there is none. */
  onAddCourseMark?: () => void;
  /** List only, no controls (race panel); editing happens in Setup > Course */
  readOnly?: boolean;
}

const TYPE_LABEL: Record<CourseMark['type'], string> = {
  PIN_END: 'Start line, pin end',
  RC_BOAT: 'Start line, committee boat',
  WINDWARD: 'Windward mark',
  WING: 'Wing mark',
  LEEWARD: 'Leeward mark',
  GATE: 'Gate',
  CUSTOM_MARK: 'Mark',
  FINISH: 'Finish',
  FINISH_PIN: 'Finish line, pin end',
  FINISH_RC: 'Finish line, committee boat',
};

const isLineMark = (m: CourseMark) =>
  m.type === 'PIN_END' || m.type === 'RC_BOAT' || m.type === 'FINISH' || m.type === 'FINISH_PIN' || m.type === 'FINISH_RC';

/** Start line first, then the rounding marks in sailing order, then the finish */
const sortForDisplay = (marks: CourseMark[]) => {
  const rank = (m: CourseMark) =>
    m.type === 'PIN_END' || m.type === 'RC_BOAT' ? 0 : m.type === 'FINISH' || m.type === 'FINISH_PIN' || m.type === 'FINISH_RC' ? 2 : 1;
  return [...marks].sort((a, b) => rank(a) - rank(b) || (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
};

/** The course's marks as one list: order, name, type and rounding, with position as secondary detail. */
export const CourseMarksEditor: React.FC<CourseMarksEditorProps> = ({ marks, onUpdateMarks, onAddCourseMark, readOnly = false }) => {
  const rounding = marks.filter((m) => !isLineMark(m));
  const lastOrder = Math.max(0, ...rounding.map((m) => m.orderIndex ?? 0));
  const edit = !readOnly && onUpdateMarks;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="text-sm font-bold text-ink">
          Marks <span className="text-ink-muted font-normal">({marks.length})</span>
        </h4>
        {!readOnly && onAddCourseMark && (
          <Button icon={<Plus />} onClick={onAddCourseMark}>
            Add mark
          </Button>
        )}
      </div>
      {marks.length === 0 ? (
        <p className="p-4 rounded-container border border-dashed border-line text-center text-sm text-ink-muted">No marks yet.</p>
      ) : (
        <ol className="divide-y divide-line border border-line rounded-container overflow-hidden">
          {sortForDisplay(marks).map((m) => {
            const line = isLineMark(m);
            const badge = m.shortName || (line ? (m.type === 'RC_BOAT' || m.type === 'FINISH_RC' ? 'RC' : m.type === 'PIN_END' ? 'SP' : 'F') : String(m.orderIndex ?? ''));
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-canvas/60">
                <span
                  aria-hidden="true"
                  className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                    line ? 'bg-raised text-ink border border-line' : 'bg-warning-ink text-canvas'
                  }`}
                >
                  {badge}
                </span>
                <div className="min-w-[10rem] flex-1">
                  <div className="text-sm font-semibold text-ink break-words">{m.name}</div>
                  <div className="text-xs text-ink-muted">
                    {TYPE_LABEL[m.type] || 'Mark'}
                    {!line && ` · leave to ${m.requiredRounding === 'STARBOARD' ? 'starboard' : 'port'}`}
                    <span className="hidden sm:inline">
                      {' · '}
                      {Number(m.lat).toFixed(4)}, {Number(m.lng).toFixed(4)}
                    </span>
                  </div>
                </div>
                {edit && (
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    {!line && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateMarks(updateMarkSettings(marks, m.id, { requiredRounding: m.requiredRounding === 'PORT' ? 'STARBOARD' : 'PORT' }))
                          }
                          aria-label={`${m.name}: leave to ${m.requiredRounding === 'STARBOARD' ? 'starboard' : 'port'}. Switch side`}
                          className="min-h-10 px-2 rounded-control border border-line text-xs font-bold text-ink hover:bg-raised"
                        >
                          {m.requiredRounding === 'STARBOARD' ? 'Stbd' : 'Port'}
                        </button>
                        <Button
                          variant="ghost"
                          icon={<ChevronUp />}
                          aria-label={`Move ${m.name} earlier`}
                          disabled={(m.orderIndex ?? 0) <= 1}
                          onClick={() => onUpdateMarks(moveMarkOrder(marks, m.id, 'UP'))}
                        />
                        <Button
                          variant="ghost"
                          icon={<ChevronDown />}
                          aria-label={`Move ${m.name} later`}
                          disabled={(m.orderIndex ?? 0) >= lastOrder}
                          onClick={() => onUpdateMarks(moveMarkOrder(marks, m.id, 'DOWN'))}
                        />
                      </>
                    )}
                    <Button
                      variant="ghost"
                      icon={<Trash2 />}
                      aria-label={`Delete ${m.name}`}
                      onClick={() => onUpdateMarks(removeCourseMark(marks, m.id))}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
