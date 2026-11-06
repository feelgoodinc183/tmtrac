import React, { useId, useState } from 'react';
import {
  CheckCircle2,
  Layers,
  Navigation,
  Plus,
  QrCode,
  Radio,
  Route,
  Sailboat,
  Settings2,
  Upload,
  X,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import { Boat, CourseMark, DeviceGpsState, MeshtasticNode, RaceClassDefinition, RaceState } from '../types/regatta';
import { formatLastHeard, safeFixed } from '../utils/formatters';
import { sameNodeId } from '../utils/nodeId';
import { Button } from './ui/Button';
import { DialogFrame } from './ui/Dialog';
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
  const withoutCourse = raceClasses.filter((c) => !c.courseProfileId).length;
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
  onOpenClassManager: () => void;
  onOpenBoatEditor: (boat?: Boat) => void;
  onOpenRosterImport: () => void;
  onOpenBoatQr: () => void;
  onOpenConnectDevice: (nodeId?: string, boatId?: string) => void;
  onOpenCourseProfiles: () => void;
  courseProfileCount: number;
  onUpdateMarks: (marks: CourseMark[]) => void;
  onApplyCoursePreset: (preset: 'WINDWARD_LEEWARD' | 'TRIANGLE' | 'TRAPEZOID') => void;
  onAddCourseMark: () => void;
}

/**
 * Where a race officer sets up a regatta: classes, fleet, trackers and course. Before the first
 * start it reads as a checklist in that order and shows what is done. The dialogs it opens
 * (boat form, class manager, Connect device, course profiles) sit on top of it, so the officer
 * comes back here when they close.
 */
export const SetupPanel: React.FC<SetupPanelProps> = (props) => {
  const { onClose, raceState, raceClasses, boats, nodes, marks, activeRoomCode } = props;
  const titleId = useId();
  const status = getSetupStatus(raceClasses, boats, marks, raceState);
  const started = hasRaceStarted(raceState);
  const doneCount = SECTIONS.filter((s) => status[s].done).length;

  const [section, setSection] = useState<SetupSection>(() => {
    if (props.initialSection) return props.initialSection;
    if (started) return 'FLEET';
    return SECTIONS.find((s) => !status[s].done) ?? 'FLEET';
  });

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const i = SECTIONS.indexOf(section);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % SECTIONS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + SECTIONS.length) % SECTIONS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = SECTIONS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setSection(SECTIONS[next]);
    document.getElementById(`setup-tab-${SECTIONS[next].toLowerCase()}`)?.focus();
  };

  const nextSection = SECTIONS[SECTIONS.indexOf(section) + 1];

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
                ? 'Ready to race: every step is done.'
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
          aria-label="Setup sections"
          aria-orientation="vertical"
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
                aria-label={`${started ? '' : `Step ${i + 1}, `}${SECTION_LABEL[s]}, ${st.done ? 'done' : 'to do'}, ${st.summary}`}
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
                  <span className={`block text-xs truncate ${st.done ? 'text-ink-muted' : 'text-warning-ink'}`}>
                    {st.summary}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Section content */}
        <div
          id="setup-tabpanel"
          role="tabpanel"
          aria-labelledby={`setup-tab-${section.toLowerCase()}`}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6"
        >
          {section === 'CLASSES' && <ClassesSection {...props} />}
          {section === 'FLEET' && <FleetSection {...props} />}
          {section === 'TRACKERS' && <TrackersSection {...props} />}
          {section === 'COURSE' && <CourseSection {...props} />}

          {!started && nextSection && (
            <div className="mt-6 pt-4 border-t border-line flex justify-end">
              <Button
                icon={<ArrowRight />}
                onClick={() => {
                  setSection(nextSection);
                  document.getElementById(`setup-tab-${nextSection.toLowerCase()}`)?.focus();
                }}
              >
                {`Next: ${SECTION_LABEL[nextSection]}`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </DialogFrame>
  );
};

const SectionHeading: React.FC<{ title: string; hint: string; actions?: React.ReactNode }> = ({ title, hint, actions }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
    <div className="min-w-0 max-w-prose">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <p className="text-xs text-ink-muted mt-0.5">{hint}</p>
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="p-6 rounded-container border border-dashed border-line text-center text-sm text-ink-muted">{children}</p>
);

const ClassesSection: React.FC<SetupPanelProps> = ({ raceClasses, boats, onOpenClassManager }) => (
  <section>
    <SectionHeading
      title="Classes"
      hint="Each class starts separately and sails its own course. Link a course profile to every class."
      actions={
        <Button variant="primary" icon={<Layers />} onClick={onOpenClassManager}>
          Add or edit classes
        </Button>
      }
    />
    {raceClasses.length === 0 ? (
      <EmptyState>No classes yet. Add one to start.</EmptyState>
    ) : (
      <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {raceClasses.map((c) => {
          const count = boats.filter((b) => b.class === c.name).length;
          return (
            <li key={c.id} className="p-3 rounded-container border border-line bg-canvas/60 flex items-start gap-3">
              <span className="w-3 h-3 mt-1 rounded-full shrink-0" style={{ backgroundColor: c.color || '#00D4FF' }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="text-sm font-bold text-ink">{c.name}</span>
                  <span className="text-xs text-ink-muted">
                    {c.ratingSystem || 'IRC'} · {plural(count, 'boat')}
                  </span>
                </div>
                {c.description && <p className="text-xs text-ink-muted truncate">{c.description}</p>}
                <p className={`text-xs mt-1 flex items-center gap-1 ${c.courseProfileId ? 'text-ink' : 'text-warning-ink'}`}>
                  <Route className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {c.courseProfileId ? `Course: ${c.courseProfileName || 'linked profile'}` : 'No course linked'}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

const trackerLabel = (boat: Boat, nodes: MeshtasticNode[]) => {
  if (!boat.nodeId) return null;
  const node = nodes.find((n) => sameNodeId(boat.nodeId, n.id));
  return {
    id: boat.nodeId,
    heard: node ? formatLastHeard(node.lastPingTime) : 'not heard yet',
  };
};

const FleetSection: React.FC<SetupPanelProps> = ({ boats, nodes, onOpenBoatEditor, onOpenRosterImport, onOpenBoatQr }) => (
  <section>
    <SectionHeading
      title="Fleet"
      hint="Add boats one by one, or import an entry list (Sailwave or World Sailing CSV). Print QR cards so skippers can check in."
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
          const tracker = trackerLabel(boat, nodes);
          return (
            <li key={boat.id} className="flex items-center gap-3 px-3 py-2.5 bg-canvas/60">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: boat.color || '#00D4FF' }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-ink truncate">
                  {boat.name} <span className="text-ink-muted font-normal">{boat.sailNumber}</span>
                </div>
                <div className="text-xs text-ink-muted truncate">
                  {boat.class} · {boat.handicapSystem || 'IRC'} {safeFixed(boat.handicapRating, 3, '1.000')} · {boat.skipper || 'No skipper'}
                  {' · '}
                  {tracker ? 'Tracker on' : <span className="text-warning-ink">No tracker</span>}
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
  const heard = nodes
    .filter((n) => !isBound(n) && !isPhone(n))
    .sort((a, b) => (b.lastPingTime || 0) - (a.lastPingTime || 0));

  return (
    <section className="space-y-6">
      <SectionHeading
        title="Trackers"
        hint="Give every boat a tracker. Connect a Meshtastic tracker over Bluetooth, or pick one heard over the internet (MQTT)."
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
              const tracker = trackerLabel(boat, nodes);
              return (
                <li key={boat.id} className="flex items-center gap-3 px-3 py-2.5 bg-canvas/60">
                  {tracker ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-success-ink" aria-hidden="true" />
                  ) : (
                    <Radio className="w-4 h-4 shrink-0 text-warning-ink" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink truncate">
                      {boat.name} <span className="text-ink-muted font-normal">{boat.sailNumber}</span>
                    </div>
                    <div className={`text-xs truncate ${tracker ? 'text-ink-muted' : 'text-warning-ink'}`}>
                      {tracker ? `Tracker ${tracker.id} · heard ${tracker.heard}` : 'No tracker'}
                    </div>
                  </div>
                  <Button
                    variant={tracker ? 'ghost' : 'secondary'}
                    onClick={() => onOpenConnectDevice(undefined, boat.id)}
                    aria-label={`${tracker ? 'Change tracker for' : 'Connect a tracker to'} ${boat.name}`}
                  >
                    {tracker ? 'Change' : 'Connect'}
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
                    {n.connectionType === 'MQTT' ? 'Internet' : 'Radio'} · heard {formatLastHeard(n.lastPingTime)}
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
          <p className="text-xs text-ink-muted mt-1">
            {heard.length - HEARD_LIMIT} more. Use Connect device to search them.
          </p>
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
  onUpdateMarks,
  onOpenCourseProfiles,
  courseProfileCount,
  onApplyCoursePreset,
  onAddCourseMark,
}) => (
  <section>
    <SectionHeading
      title="Course"
      hint="Load a saved course profile or a preset, then move marks on the map. Profiles are saved on this device."
      actions={
        <Button variant="primary" icon={<Sailboat />} onClick={onOpenCourseProfiles}>
          {`Course profiles (${courseProfileCount}/10)`}
        </Button>
      }
    />
    <p className="text-sm mb-3 flex items-center gap-1.5">
      <Route className="w-4 h-4 text-accent" aria-hidden="true" />
      {marks.length === 0 ? (
        <span className="text-warning-ink">No course set</span>
      ) : (
        <span className="text-ink">
          On the water: <strong>{raceState.courseName || 'Custom course'}</strong>, {plural(marks.length, 'mark')}
        </span>
      )}
    </p>
    <CourseMarksEditor
      marks={marks}
      onUpdateMarks={onUpdateMarks}
      onApplyCoursePreset={onApplyCoursePreset}
      onAddCourseMark={onAddCourseMark}
    />
  </section>
);
