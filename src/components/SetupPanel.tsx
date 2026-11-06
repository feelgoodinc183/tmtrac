import React, { useId, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flag,
  Navigation,
  Pencil,
  Plus,
  QrCode,
  Radio,
  Route,
  Settings2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Boat,
  CourseMark,
  CourseProfile,
  DeviceGpsState,
  HandicapSystem,
  MeshtasticNode,
  RaceClassDefinition,
  RaceState,
} from '../types/regatta';
import { formatLastHeard, safeFixed } from '../utils/formatters';
import { sameNodeId } from '../utils/nodeId';
import { getSavedCourseProfiles } from '../services/courseProfileService';
import { Button } from './ui/Button';
import { DialogFrame } from './ui/Dialog';
import { ConfirmDialog } from './ConfirmDialog';
import { CourseMarksEditor } from './CourseMarksEditor';
import { MqttSettingsPanel } from './MqttSettingsPanel';

export type SetupSection = 'CLASSES' | 'FLEET' | 'TRACKERS' | 'COURSE';
const SECTIONS: SetupSection[] = ['CLASSES', 'FLEET', 'TRACKERS', 'COURSE'];
const SECTION_LABEL: Record<SetupSection, string> = {
  CLASSES: 'Classes',
  FLEET: 'Fleet',
  TRACKERS: 'Trackers',
  COURSE: 'Course',
};

export type CoursePreset = 'WINDWARD_LEEWARD' | 'TRIANGLE' | 'TRAPEZOID';
export type CourseChoice = { profileId: string } | { preset: CoursePreset };
const TEMPLATES: { preset: CoursePreset; name: string; hint: string }[] = [
  { preset: 'WINDWARD_LEEWARD', name: 'Windward-Leeward', hint: 'Start, windward mark, leeward gate' },
  { preset: 'TRIANGLE', name: 'Olympic Triangle', hint: 'Windward, wing and leeward marks' },
  { preset: 'TRAPEZOID', name: 'Trapezoid', hint: 'Four marks, inner and outer loops' },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Has any class had its start sequence run? Before that, Setup opens as a checklist. */
export function hasRaceStarted(raceState: RaceState): boolean {
  const states = Object.values(raceState.classStates || {});
  const started = (s: { status?: string; startSequenceActive?: boolean }) =>
    !!s.startSequenceActive || s.status === 'RACING' || s.status === 'FINISHED' || s.status === 'COUNTDOWN';
  return started(raceState) || states.some(started);
}

export interface SetupStatus {
  done: boolean;
  /** Short status shown under the step, e.g. "2 boats" */
  summary: string;
}

/** What is done in each setup step. Shared by the Setup panel and the header's progress badge. */
export function getSetupStatus(
  raceClasses: RaceClassDefinition[],
  boats: Boat[],
  marks: CourseMark[],
  raceState: RaceState
): Record<SetupSection, SetupStatus> {
  const profiles = getSavedCourseProfiles();
  const hasCourse = (c: RaceClassDefinition) => {
    if (!c.courseProfileId) return false;
    const p = profiles.find((x) => x.id === c.courseProfileId);
    return !p || p.marks.length > 0;
  };
  const withoutCourse = raceClasses.filter((c) => !hasCourse(c)).length;
  const withTracker = boats.filter((b) => !!b.nodeId).length;
  return {
    CLASSES: {
      done: raceClasses.length > 0 && withoutCourse === 0,
      summary:
        raceClasses.length === 0
          ? 'No classes yet'
          : withoutCourse > 0
          ? `${withoutCourse} without a course`
          : plural(raceClasses.length, 'class', 'classes'),
    },
    FLEET: {
      done: boats.length > 0,
      summary: boats.length === 0 ? 'No boats yet' : plural(boats.length, 'boat'),
    },
    TRACKERS: {
      done: boats.length > 0 && withTracker === boats.length,
      summary: boats.length === 0 ? 'Add boats first' : `${withTracker} of ${plural(boats.length, 'boat')}`,
    },
    COURSE: {
      done: marks.length > 0,
      summary: marks.length === 0 ? 'No course set' : raceState.courseName || plural(marks.length, 'mark'),
    },
  };
}

/** A skipper is worth showing only when one was entered (the boat form stores "Skipper" for none) */
const skipperOf = (b: Boat) => (b.skipper && b.skipper.trim() && b.skipper !== 'Skipper' ? b.skipper.trim() : null);

/** "Heard 2m ago", "Heard just now" or "Not heard yet" */
const heardText = (time?: number) => {
  const t = formatLastHeard(time);
  return t === 'Never' ? 'Not heard yet' : `Heard ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
};

export interface SetupPanelProps {
  onClose: () => void;
  /** Section to open on; otherwise the first unfinished step before the start, or Fleet after it */
  initialSection?: SetupSection;
  activeRoomCode: string;
  raceState: RaceState;
  raceClasses: RaceClassDefinition[];
  boats: Boat[];
  nodes: MeshtasticNode[];
  marks: CourseMark[];
  deviceGps: DeviceGpsState;
  onToggleDeviceGps: () => void;
  onAddClass: (c: Omit<RaceClassDefinition, 'id'>) => void;
  onUpdateClass: (id: string, c: Partial<RaceClassDefinition>) => void;
  onDeleteClass: (id: string, reassignToClassName?: string) => void;
  onOpenBoatEditor: (boat?: Boat) => void;
  onOpenRosterImport: () => void;
  onOpenBoatQr: () => void;
  onOpenConnectDevice: (nodeId?: string, boatId?: string) => void;
  /** Loads a saved course or a template (App asks first when it replaces marks) */
  onLoadCourse: (choice: CourseChoice) => void;
  /** Saved courses: save the current one, rename, import or export */
  onManageCourses: () => void;
  /** Changes when saved courses change, so the list re-reads them */
  courseProfileCount: number;
  onUpdateMarks: (marks: CourseMark[]) => void;
  onAddCourseMark: () => void;
  /** Close Setup and go to the start sequence */
  onFinish: () => void;
}

/**
 * Where a race officer sets up a regatta: classes, fleet, trackers and course, in that order.
 * Before the first start it is a checklist: it shows the step you are on, what is done, and ends
 * with "Done, go to race control" (or the steps still open). The dialogs it opens (boat form,
 * Connect device, saved courses) sit on top of it, so the officer comes back here.
 */
export const SetupPanel: React.FC<SetupPanelProps> = (props) => {
  const { onClose, onFinish, raceState, raceClasses, boats, marks, activeRoomCode } = props;
  const titleId = useId();
  const status = getSetupStatus(raceClasses, boats, marks, raceState);
  const started = hasRaceStarted(raceState);
  const doneCount = SECTIONS.filter((s) => status[s].done).length;
  const openSteps = SECTIONS.filter((s) => !status[s].done);

  const [section, setSection] = useState<SetupSection>(() => {
    if (props.initialSection) return props.initialSection;
    if (started) return 'FLEET';
    return openSteps[0] ?? 'COURSE';
  });
  const index = SECTIONS.indexOf(section);

  const goTo = (s: SetupSection) => {
    setSection(s);
    document.getElementById(`setup-tab-${s.toLowerCase()}`)?.focus();
  };

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % SECTIONS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + SECTIONS.length) % SECTIONS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = SECTIONS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    goTo(SECTIONS[next]);
  };

  const prev = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];

  return (
    <DialogFrame
      onClose={onClose}
      labelledBy={titleId}
      closeOnBackdrop
      overlayClassName="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-xs flex items-stretch sm:items-center justify-center sm:p-4"
      id="setup-panel"
      className="w-full sm:max-w-5xl h-dvh sm:h-[92vh] sm:max-h-[860px] sm:rounded-container flex flex-col overflow-hidden sm:border border-line shadow-2xl bg-surface text-ink"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-line shrink-0">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-bold text-ink flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-accent" aria-hidden="true" />
            Setup
            <span className="text-xs font-bold text-accent">#{activeRoomCode}</span>
          </h2>
          {!started && (
            <p className="text-xs text-ink-muted mt-0.5" aria-live="polite">
              {doneCount === SECTIONS.length
                ? 'Every step is done. You are ready to start.'
                : `Before the start: ${doneCount} of ${SECTIONS.length} steps done.`}
            </p>
          )}
        </div>
        <Button variant="ghost" icon={<X />} aria-label="Close setup" onClick={onClose} />
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Steps: a row on phones, a rail on wider screens */}
        <div
          role="tablist"
          aria-label="Setup steps"
          onKeyDown={onTabKeyDown}
          className="shrink-0 grid grid-cols-4 md:flex md:flex-col md:w-60 gap-1 p-2 md:p-3 border-b md:border-b-0 md:border-r border-line bg-canvas/50"
        >
          {SECTIONS.map((s, i) => {
            const selected = s === section;
            const st = status[s];
            return (
              <button
                key={s}
                id={`setup-tab-${s.toLowerCase()}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="setup-tabpanel"
                aria-label={`Step ${i + 1} of ${SECTIONS.length}, ${SECTION_LABEL[s]}, ${st.done ? 'done' : 'to do'}, ${st.summary}`}
                tabIndex={selected ? 0 : -1}
                data-autofocus={selected ? '' : undefined}
                onClick={() => setSection(s)}
                className={`min-w-0 flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-2.5 px-1 md:px-3 py-2 rounded-control text-center md:text-left transition-colors ${
                  selected ? 'bg-accent/15 text-ink ring-1 ring-accent' : 'text-ink hover:bg-raised'
                }`}
              >
                {st.done ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-success-ink" aria-hidden="true" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="w-5 h-5 shrink-0 rounded-full border border-line text-xs font-bold flex items-center justify-center text-ink-muted"
                  >
                    {i + 1}
                  </span>
                )}
                <span className="min-w-0 w-full">
                  <span className="block text-xs md:text-sm font-bold truncate">{SECTION_LABEL[s]}</span>
                  <span className={`block text-xs truncate ${st.done ? 'text-ink-muted' : 'text-warning-ink'}`}>{st.summary}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <div
          id="setup-tabpanel"
          role="tabpanel"
          aria-labelledby={`setup-tab-${section.toLowerCase()}`}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6"
        >
          <p className="text-xs font-bold text-ink-muted mb-1">
            Step {index + 1} of {SECTIONS.length}
          </p>
          {section === 'CLASSES' && <ClassesSection {...props} />}
          {section === 'FLEET' && <FleetSection {...props} />}
          {section === 'TRACKERS' && <TrackersSection {...props} />}
          {section === 'COURSE' && <CourseSection {...props} />}

          {/* Back / Next, and on the last step: finish */}
          <div className="mt-6 pt-4 border-t border-line space-y-3">
            {!next && (
              openSteps.length === 0 ? (
                <div className="p-3 rounded-container border border-success-ink/50 bg-success-ink/10 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-success-ink shrink-0" aria-hidden="true" />
                    {started ? 'Setup is complete.' : 'Setup is complete. Next: run the start sequence.'}
                  </p>
                  <Button variant="primary" icon={<Flag />} onClick={onFinish}>
                    Done, go to race control
                  </Button>
                </div>
              ) : (
                <div className="p-3 rounded-container border border-warning-ink/50 bg-warning-ink/10">
                  <p className="text-sm text-ink font-semibold">
                    Still to do: {plural(openSteps.length, 'step')}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {openSteps.map((s) => (
                      <li key={s}>
                        <Button onClick={() => goTo(s)}>{`${SECTION_LABEL[s]}: ${status[s].summary}`}</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {prev ? (
                <Button variant="ghost" icon={<ArrowLeft />} onClick={() => goTo(prev)}>
                  {`Back: ${SECTION_LABEL[prev]}`}
                </Button>
              ) : (
                <span />
              )}
              {next ? (
                <Button variant={status[section].done ? 'primary' : 'secondary'} icon={<ArrowRight />} onClick={() => goTo(next)}>
                  {`Next: ${SECTION_LABEL[next]}`}
                </Button>
              ) : (
                openSteps.length > 0 && <Button onClick={onClose}>Close setup</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DialogFrame>
  );
};

const SectionHeading: React.FC<{ title: string; hint: string; actions?: React.ReactNode }> = ({ title, hint, actions }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
    <div className="min-w-0 max-w-prose">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="text-xs text-ink-muted mt-0.5">{hint}</p>
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="p-6 rounded-container border border-dashed border-line text-center text-sm text-ink-muted">{children}</p>
);

const inputCls = 'w-full min-h-10 bg-canvas border border-line rounded-control px-3 text-sm text-ink';
const CLASS_COLORS = ['#00D4FF', '#00FF9D', '#FBBC04', '#FF5252', '#A855F7', '#EC4899', '#F97316', '#38BDF8'];

interface ClassDraft {
  name: string;
  ratingSystem: HandicapSystem;
  courseProfileId: string;
}

/** Add or edit one class, inline in the list */
const ClassForm: React.FC<{
  initial: ClassDraft;
  profiles: CourseProfile[];
  taken: string[];
  submitLabel: string;
  onSave: (d: ClassDraft) => void;
  onCancel: () => void;
}> = ({ initial, profiles, taken, submitLabel, onSave, onCancel }) => {
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const name = d.name.trim();
        if (!name) return setError('Give the class a name.');
        const clash = taken.find((t) => t.toLowerCase() === name.toLowerCase());
        if (clash) return setError(`There is already a class called ${clash}.`);
        onSave({ ...d, name });
      }}
      className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-container border border-accent bg-canvas/60"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <label className="text-xs text-ink-muted">
        Name
        <input
          autoFocus
          value={d.name}
          onChange={(e) => {
            setD({ ...d, name: e.target.value });
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          placeholder="e.g. Class 4"
          className={`mt-1 ${inputCls}`}
        />
      </label>
      <label className="text-xs text-ink-muted">
        Rating
        <select value={d.ratingSystem} onChange={(e) => setD({ ...d, ratingSystem: e.target.value as HandicapSystem })} className={`mt-1 ${inputCls}`}>
          <option value="IRC">IRC</option>
          <option value="ORC">ORC</option>
          <option value="PY">Portsmouth Yardstick</option>
        </select>
      </label>
      <label className="text-xs text-ink-muted">
        Course
        <select value={d.courseProfileId} onChange={(e) => setD({ ...d, courseProfileId: e.target.value })} className={`mt-1 ${inputCls}`}>
          <option value="">No course yet</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p id={`${id}-err`} role="alert" className="sm:col-span-3 text-xs text-danger-ink">
          {error}
        </p>
      )}
      <div className="sm:col-span-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

const ClassesSection: React.FC<SetupPanelProps> = ({
  raceClasses,
  boats,
  raceState,
  marks,
  courseProfileCount,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  onLoadCourse,
}) => {
  const profiles = React.useMemo(() => getSavedCourseProfiles(), [courseProfileCount]);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<RaceClassDefinition | null>(null);
  // The inline form goes away on save or cancel: put focus back on the button that opened it
  const refocus = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 0);
  const closeEdit = (classId: string) => {
    setEditing(null);
    refocus(`setup-class-edit-${classId}`);
  };
  const closeAdd = () => {
    setAdding(false);
    refocus('setup-add-class');
  };
  const draftFrom = (d: ClassDraft) => {
    const p = profiles.find((x) => x.id === d.courseProfileId);
    return { name: d.name, ratingSystem: d.ratingSystem, courseProfileId: p?.id, courseProfileName: p?.name };
  };
  const deletingBoats = deleting ? boats.filter((b) => b.class === deleting.name).length : 0;
  const moveTo = deleting ? raceClasses.find((c) => c.id !== deleting.id)?.name : undefined;

  return (
    <section>
      <SectionHeading
        title="Classes"
        hint="Each class starts on its own and sails the course linked to it."
        actions={
          !adding && (
            <Button id="setup-add-class" variant="primary" icon={<Plus />} onClick={() => { setAdding(true); setEditing(null); }}>
              Add class
            </Button>
          )
        }
      />
      <ul className="space-y-2">
        {raceClasses.map((c) => {
          if (editing === c.id) {
            return (
              <li key={c.id}>
                <ClassForm
                  initial={{ name: c.name, ratingSystem: c.ratingSystem || 'IRC', courseProfileId: c.courseProfileId || '' }}
                  profiles={profiles}
                  taken={raceClasses.filter((x) => x.id !== c.id).map((x) => x.name)}
                  submitLabel="Save class"
                  onSave={(d) => {
                    onUpdateClass(c.id, draftFrom(d));
                    closeEdit(c.id);
                  }}
                  onCancel={() => closeEdit(c.id)}
                />
              </li>
            );
          }
          const count = boats.filter((b) => b.class === c.name).length;
          const onWater = !!c.courseProfileName && marks.length > 0 && raceState.courseName === c.courseProfileName;
          const linked = profiles.find((p) => p.id === c.courseProfileId);
          const empty = !!linked && linked.marks.length === 0;
          return (
            <li key={c.id} className="p-3 rounded-container border border-line bg-canvas/60 flex items-start gap-3">
              <span className="w-3 h-3 mt-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color || '#00D4FF' }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-ink">
                  {c.name} <span className="text-xs font-normal text-ink-muted">· {c.ratingSystem || 'IRC'} · {plural(count, 'boat')}</span>
                </div>
                <div className="mt-1 flex items-start gap-1.5 text-xs">
                  <Route className={`w-3.5 h-3.5 mt-px shrink-0 ${c.courseProfileId && !empty ? 'text-accent' : 'text-warning-ink'}`} aria-hidden="true" />
                  {c.courseProfileId ? (
                    <span className="min-w-0 flex flex-wrap items-baseline gap-x-2">
                      <span className="text-ink">{c.courseProfileName || 'Saved course'}</span>
                      {onWater ? (
                        <span className="text-success-ink font-semibold">On the water</span>
                      ) : empty ? (
                        <span className="text-warning-ink">No marks saved in this course</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onLoadCourse({ profileId: c.courseProfileId! })}
                          className="text-accent font-semibold underline underline-offset-2"
                        >
                          Load it
                        </button>
                      )}
                    </span>
                  ) : (
                    <span className="text-warning-ink">No course linked</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0">
                <Button id={`setup-class-edit-${c.id}`} variant="ghost" icon={<Pencil />} aria-label={`Edit ${c.name}`} onClick={() => { setEditing(c.id); setAdding(false); }} />
                <Button
                  variant="ghost"
                  icon={<Trash2 />}
                  aria-label={`Delete ${c.name}`}
                  disabled={raceClasses.length <= 1}
                  onClick={() => setDeleting(c)}
                />
              </div>
            </li>
          );
        })}
        {adding && (
          <li>
            <ClassForm
              initial={{ name: '', ratingSystem: 'IRC', courseProfileId: profiles[0]?.id || '' }}
              profiles={profiles}
              taken={raceClasses.map((x) => x.name)}
              submitLabel="Add class"
              onSave={(d) => {
                onAddClass({ ...draftFrom(d), defaultRating: 1, color: CLASS_COLORS[raceClasses.length % CLASS_COLORS.length] });
                closeAdd();
              }}
              onCancel={closeAdd}
            />
          </li>
        )}
      </ul>
      {raceClasses.length === 0 && !adding && <EmptyState>No classes yet. Add one to start.</EmptyState>}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          body={
            deletingBoats > 0 && moveTo
              ? `Its ${plural(deletingBoats, 'boat')} move to ${moveTo}.`
              : 'No boats are in this class.'
          }
          confirmLabel="Delete class"
          onConfirm={() => {
            onDeleteClass(deleting.id, deletingBoats > 0 ? moveTo : undefined);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  );
};

const FleetSection: React.FC<SetupPanelProps> = ({ boats, onOpenBoatEditor, onOpenRosterImport, onOpenBoatQr }) => (
  <section>
    <SectionHeading
      title="Fleet"
      hint="Add boats one by one or import an entry list (Sailwave or World Sailing CSV). Print QR cards so skippers can check in."
      actions={
        <>
          <Button variant="primary" icon={<Plus />} onClick={() => onOpenBoatEditor()}>
            Add boat
          </Button>
          <Button icon={<Upload />} onClick={onOpenRosterImport}>
            Import roster
          </Button>
          <Button icon={<QrCode />} onClick={onOpenBoatQr} disabled={boats.length === 0}>
            Boat QRs
          </Button>
        </>
      }
    />
    {boats.length === 0 ? (
      <EmptyState>No boats yet. Add a boat or import a roster. Skippers can also add themselves with Track.</EmptyState>
    ) : (
      <ul className="divide-y divide-line border border-line rounded-container overflow-hidden">
        {boats.map((boat) => {
          const skipper = skipperOf(boat);
          return (
            <li key={boat.id} className="flex items-center gap-3 px-3 py-2.5 bg-canvas/60">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: boat.color || '#00D4FF' }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-ink truncate">
                  {boat.name} <span className="text-ink-muted font-normal">{boat.sailNumber}</span>
                </div>
                <div className="text-xs text-ink-muted truncate">
                  {[boat.class, `${boat.handicapSystem || 'IRC'} ${safeFixed(boat.handicapRating, 3, '1.000')}`, skipper].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Button variant="ghost" onClick={() => onOpenBoatEditor(boat)} aria-label={`Edit ${boat.name}`}>
                Edit
              </Button>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

const HEARD_LIMIT = 8;

const TrackersSection: React.FC<SetupPanelProps> = ({ boats, nodes, deviceGps, onToggleDeviceGps, onOpenConnectDevice }) => {
  const [showMqtt, setShowMqtt] = useState(false);
  const mqttId = useId();
  const isBound = (n: MeshtasticNode) => boats.some((b) => sameNodeId(b.nodeId, n.id));
  const isPhone = (n: MeshtasticNode) =>
    n.isDeviceGps || ['DEVICE_GPS', 'PHONE', 'TABLET', 'PC'].includes(n.connectionType || '');
  const heard = nodes.filter((n) => !isBound(n) && !isPhone(n)).sort((a, b) => (b.lastPingTime || 0) - (a.lastPingTime || 0));

  return (
    <section className="space-y-6">
      <SectionHeading
        title="Trackers"
        hint="Give every boat a tracker: a Meshtastic tracker over Bluetooth, or one heard over the internet (MQTT)."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => onOpenConnectDevice()}>
            Connect device
          </Button>
        }
      />

      <div>
        <h4 className="text-xs font-bold text-ink-muted mb-2">Boats</h4>
        {boats.length === 0 ? (
          <EmptyState>Add boats in Fleet first, or create a boat while connecting a tracker.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border border-line rounded-container overflow-hidden">
            {boats.map((boat) => {
              const node = boat.nodeId ? nodes.find((n) => sameNodeId(boat.nodeId, n.id)) : undefined;
              return (
                <li key={boat.id} className="flex items-center gap-3 px-3 py-2.5 bg-canvas/60">
                  {boat.nodeId ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-success-ink" aria-hidden="true" />
                  ) : (
                    <Radio className="w-4 h-4 shrink-0 text-warning-ink" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink truncate">
                      {boat.name} <span className="text-ink-muted font-normal">{boat.sailNumber}</span>
                    </div>
                    <div className={`text-xs truncate ${boat.nodeId ? 'text-ink-muted' : 'text-warning-ink'}`}>
                      {boat.nodeId ? `${boat.nodeId} · ${heardText(node?.lastPingTime)}` : 'No tracker'}
                    </div>
                  </div>
                  <Button
                    variant={boat.nodeId ? 'ghost' : 'secondary'}
                    onClick={() => onOpenConnectDevice(undefined, boat.id)}
                    aria-label={`${boat.nodeId ? 'Change tracker for' : 'Connect a tracker to'} ${boat.name}`}
                  >
                    {boat.nodeId ? 'Change' : 'Connect'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-xs font-bold text-ink-muted mb-2">Heard nearby, not on a boat</h4>
        {heard.length === 0 ? (
          <p className="text-xs text-ink-muted">No other trackers heard yet.</p>
        ) : (
          <ul className="divide-y divide-line border border-line rounded-container overflow-hidden">
            {heard.slice(0, HEARD_LIMIT).map((n) => (
              <li key={n.id} className="flex items-center gap-3 px-3 py-2 bg-canvas/60">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink truncate">
                    {n.longName || n.shortName || n.id} <span className="text-ink-muted text-xs">{n.id}</span>
                  </div>
                  <div className="text-xs text-ink-muted">
                    {n.connectionType === 'MQTT' ? 'Internet' : 'Radio'} · {heardText(n.lastPingTime)}
                  </div>
                </div>
                <Button onClick={() => onOpenConnectDevice(n.id)} aria-label={`Assign ${n.longName || n.id} to a boat`}>
                  Assign
                </Button>
              </li>
            ))}
          </ul>
        )}
        {heard.length > HEARD_LIMIT && (
          <p className="text-xs text-ink-muted mt-1">{heard.length - HEARD_LIMIT} more. Search them in Connect device.</p>
        )}
      </div>

      <div className="p-3 rounded-container border border-line bg-canvas/60 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-ink">This device's GPS</h4>
          <p className="text-xs text-ink-muted">
            {deviceGps.active
              ? `Sharing position: ${safeFixed(deviceGps.speedKt, 1, '0.0')} kt, ${deviceGps.headingDeg ?? 0}°`
              : 'Use this phone or tablet as a tracker, for example on the committee boat.'}
          </p>
        </div>
        <Button variant={deviceGps.active ? 'danger' : 'secondary'} icon={<Navigation />} onClick={onToggleDeviceGps}>
          {deviceGps.active ? 'Stop sharing' : 'Share GPS'}
        </Button>
      </div>

      <div className="rounded-container border border-line">
        <button
          type="button"
          aria-expanded={showMqtt}
          aria-controls={mqttId}
          onClick={() => setShowMqtt((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-3 text-sm font-bold text-ink hover:bg-raised rounded-container"
        >
          <span>Internet (MQTT) settings</span>
          {showMqtt ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
        </button>
        {showMqtt && (
          <div id={mqttId} className="px-3 pb-3">
            <MqttSettingsPanel />
          </div>
        )}
      </div>
    </section>
  );
};

const CourseSection: React.FC<SetupPanelProps> = ({
  marks,
  raceState,
  raceClasses,
  courseProfileCount,
  onLoadCourse,
  onManageCourses,
  onUpdateMarks,
  onAddCourseMark,
}) => {
  const profiles = React.useMemo(() => getSavedCourseProfiles(), [courseProfileCount]);
  const current = marks.length > 0 ? raceState.courseName || 'Custom course' : null;
  const usedBy = (name: string) => raceClasses.filter((c) => c.courseProfileName === name).map((c) => c.name);
  const [picking, setPicking] = useState(marks.length === 0);
  const pickerId = useId();

  const option = (key: string, name: string, detail: string, onLoad?: () => void) => {
    const isCurrent = current === name;
    return (
      <li key={key} className="flex items-center gap-3 px-3 py-2.5 bg-canvas/60">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{name}</div>
          <div className="text-xs text-ink-muted">{detail}</div>
        </div>
        {isCurrent ? (
          <span className="text-xs font-semibold text-success-ink shrink-0">On the water</span>
        ) : !onLoad ? null : (
          <Button
            onClick={() => {
              onLoad();
              setPicking(false);
            }}
            aria-label={`Load ${name}`}
          >
            Load
          </Button>
        )}
      </li>
    );
  };

  return (
    <section className="space-y-5">
      <SectionHeading
        title="Course"
        hint="Load a saved course or a template, then fine-tune the marks. Drag a mark on the map to move it."
      />

      <div className="p-3 rounded-container border border-line bg-canvas/60 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm flex items-center gap-2 min-w-0">
          <Route className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
          {current ? (
            <span className="text-ink">
              On the water: <strong>{current}</strong>
              {usedBy(current).length > 0 && <span className="text-ink-muted"> · for {usedBy(current).join(', ')}</span>}
            </span>
          ) : (
            <span className="text-warning-ink">No course set yet</span>
          )}
        </p>
        <Button aria-expanded={picking} aria-controls={pickerId} onClick={() => setPicking((v) => !v)}>
          {picking ? 'Hide courses' : current ? 'Change course' : 'Choose a course'}
        </Button>
      </div>

      {picking && (
        <div id={pickerId} className="space-y-3">
          <div>
            <h4 className="text-xs font-bold text-ink-muted mb-2">Saved courses</h4>
            {profiles.length === 0 ? (
              <p className="text-xs text-ink-muted">No saved courses on this device.</p>
            ) : (
              <ul className="divide-y divide-line border border-line rounded-container overflow-hidden">
                {profiles.map((p) => {
                  const classes = usedBy(p.name);
                  return option(
                    p.id,
                    p.name,
                    `${p.marks.length ? plural(p.marks.length, 'mark') : 'No marks saved'}${classes.length ? ` · for ${classes.join(', ')}` : ''}`,
                    p.marks.length ? () => onLoadCourse({ profileId: p.id }) : undefined
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink-muted mb-2">Templates, laid out around the map's view and the wind</h4>
            <ul className="divide-y divide-line border border-line rounded-container overflow-hidden">
              {TEMPLATES.map((t) => option(t.preset, t.name, t.hint, () => onLoadCourse({ preset: t.preset })))}
            </ul>
          </div>
          <Button variant="ghost" onClick={onManageCourses}>
            Save, rename or import courses…
          </Button>
        </div>
      )}

      <CourseMarksEditor marks={marks} onUpdateMarks={onUpdateMarks} onAddCourseMark={onAddCourseMark} />
    </section>
  );
};
