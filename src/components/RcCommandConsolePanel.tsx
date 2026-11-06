import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Boat, CourseMark, RaceClassDefinition, RaceState } from '../types/regatta';
import { serverNow } from '../services/serverClock';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ConfirmDialog';

const STATUS_LABEL: Record<string, string> = {
  PRE_START: 'pre-start',
  COUNTDOWN: 'countdown',
  RACING: 'racing',
  FINISHED: 'finished',
};
import { CourseMarksEditor } from './CourseMarksEditor';
import {
  Compass,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  AlertTriangle,
  Flag,
  Wind,
  Radio,
  MapPin,
  Send,
  ChevronDown,
  ChevronUp,
  Layers,
  Trophy,
  X,
  Route,
} from 'lucide-react';

interface RcCommandConsolePanelProps {
  raceState: RaceState;
  boats: Boat[];
  marks: CourseMark[];
  onToggleRaceTimer: () => void;
  onResetTimer: () => void;
  onPlayStartSignal: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onUpdateRaceState: (partial: Partial<RaceState>) => void;
  onUpdateBoatStatus: (boatId: string, status: Boat['status']) => void;
  onUpdateFleetStatus?: (status: Boat['status'], forClass?: string) => void;
  onUpdateWind: (speedKt: number, dirDeg: number) => void;
  onUpdateMarks: (marks: CourseMark[]) => void;
  onSendVhfNotice: (title: string, content: string, type: 'COURSE_CHANGE' | 'POSTPONEMENT' | 'SAFETY_WARNING' | 'GENERAL_ANNOUNCEMENT') => void;
  onEndRace?: (forClass?: string) => void;
  onRestartRace?: (forClass?: string) => void;
  onGeneralRecall?: (forClass: string) => void;
  raceClasses?: RaceClassDefinition[];
  /** Opens Setup > Classes */
  onOpenClassManager?: () => void;
  onOpenResults?: () => void;
  /** Opens Setup > Course, the one place the course is built */
  onEditCourse?: () => void;
  /** Changes when Setup is finished, to bring the start sequence to the front */
  showSequenceSignal?: number;
  onClose?: () => void;
  isOverlay?: boolean;
}

export const RcCommandConsolePanel: React.FC<RcCommandConsolePanelProps> = ({
  raceState,
  boats,
  marks,
  onToggleRaceTimer,
  onResetTimer,
  onPlayStartSignal,
  isMuted = false,
  onToggleMute,
  onUpdateRaceState,
  onUpdateBoatStatus,
  onUpdateFleetStatus,
  onUpdateWind,
  onUpdateMarks,
  onSendVhfNotice,
  onEndRace,
  onRestartRace,
  onGeneralRecall,
  raceClasses = [],
  onOpenClassManager,
  onOpenResults,
  onEditCourse,
  showSequenceSignal,
  onClose,
  isOverlay = false,
}) => {
  // Collapsed, the console is one strip (class, clock, Start) so the map gets the screen.
  // Remembered per device.
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tmtrac_console_expanded') !== '0';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('tmtrac_console_expanded', isExpanded ? '1' : '0');
    } catch {}
  }, [isExpanded]);
  const [activeTab, setActiveTab] = useState<'SEQUENCE' | 'OCS_FLEET' | 'ENVIRONMENT' | 'MARKS' | 'ANNOUNCE'>('SEQUENCE');
  // Setup finished: show the start sequence
  useEffect(() => {
    if (!showSequenceSignal) return;
    setActiveTab('SEQUENCE');
    setIsExpanded(true);
  }, [showSequenceSignal]);

  // Announcement form
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeType, setNoticeType] = useState<'COURSE_CHANGE' | 'POSTPONEMENT' | 'SAFETY_WARNING' | 'GENERAL_ANNOUNCEMENT'>('COURSE_CHANGE');


  // Active class state computation
  const activeClassState = raceState.classStates?.[raceState.activeClass] || {
    status: raceState.status,
    countdownSeconds: raceState.countdownSeconds,
    startSequenceActive: raceState.startSequenceActive,
    targetStartTime: raceState.targetStartTime,
    startTime: raceState.startTime,
    postponed: raceState.postponed,
  };
  const isSeqActive = activeClassState.startSequenceActive ?? raceState.startSequenceActive;
  const classStatus = activeClassState.status;
  const isRacing = classStatus === 'RACING';
  // AP holds a class only before its start signal.
  const isPostponed = !!activeClassState.postponed && !isSeqActive && classStatus === 'PRE_START';
  const isBeforeStart = classStatus === 'PRE_START' || classStatus === 'COUNTDOWN';
  const [confirmAp, setConfirmAp] = useState(false);

  // RRS 27.3 / Race Signals: when AP comes down, the warning signal is made 1 minute later.
  // So the clock restarts at 6:00; the existing horn at 5:00 is that warning signal.
  const AP_DOWN_TO_START_SECONDS = 360;

  const hoistAp = () => {
    setConfirmAp(false);
    onUpdateRaceState({ status: 'PRE_START', startSequenceActive: false, countdownSeconds: 300, postponed: true });
    onSendVhfNotice(
      `POSTPONEMENT (AP) ${raceState.activeClass}`,
      `${raceState.activeClass}: races not started are postponed (RRS 27.3). The warning signal will be made 1 minute after AP is removed.`,
      'POSTPONEMENT'
    );
  };

  const lowerAp = () => {
    onUpdateRaceState({ countdownSeconds: AP_DOWN_TO_START_SECONDS, startSequenceActive: true, postponed: false });
    onPlayStartSignal();
    onSendVhfNotice(
      `AP DOWN ${raceState.activeClass}`,
      `${raceState.activeClass}: postponement over. Warning signal in 1 minute, start in 6 minutes.`,
      'POSTPONEMENT'
    );
  };
  const target = activeClassState.targetStartTime ?? raceState.targetStartTime;
  const displayCountdown = isSeqActive && target
    ? Math.max(0, Math.ceil((target - serverNow()) / 1000))
    : (activeClassState.countdownSeconds ?? raceState.countdownSeconds);

  const formattedTimer = `${Math.floor(displayCountdown / 60)
    .toString()
    .padStart(2, '0')}:${(displayCountdown % 60)
    .toString()
    .padStart(2, '0')}`;

  const ocsBoats = boats.filter((b) => b.status === 'OCS');

  const handleBroadcastNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle || !noticeContent) return;
    onSendVhfNotice(noticeTitle, noticeContent, noticeType);
    setNoticeTitle('');
    setNoticeContent('');
  };

  return (
    <div
      className={`transition-all select-none flex flex-col ${
        isOverlay
          ? 'w-full max-w-2xl max-h-[calc(100vh-130px)] sm:max-h-[82vh] landscape:max-h-[98dvh] landscape:h-[98dvh] h-full rounded-2xl sm:rounded-3xl bg-surface/90 backdrop-blur-md border border-line/80 shadow-2xl overflow-hidden min-h-0'
          : 'border-b z-20 bg-surface text-ink border-line'
      }`}
    >
      {/* Console Title Bar */}
      <div
        className={`px-3 sm:px-4 py-2.5 landscape:py-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b shrink-0 ${
          isOverlay
            ? 'border-line/80 bg-surface/75'
            : 'border-line bg-surface/80'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 basis-[16rem]">
          <div className="w-7 h-7 rounded-full bg-raised text-ink flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold tracking-tight text-ink flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span>Race Control</span>
              {/* The course on the water: what was last applied, not the class's linked profile. */}
              {marks.length === 0 ? (
                <span className="bg-raised/50 text-ink-muted text-xs px-1.5 sm:px-2 py-0.5 rounded-full border border-line flex items-center gap-1 font-bold max-w-full truncate">
                  <Route className="w-3 h-3" />
                  No course set
                </span>
              ) : (
                <span className="bg-accent/20 text-accent text-xs px-1.5 sm:px-2 py-0.5 rounded-full border border-accent/40 flex items-center gap-1 font-bold max-w-full truncate">
                  <Route className="w-3 h-3" />
                  Course: {raceState.courseName || `Custom, ${marks.length} ${marks.length === 1 ? 'mark' : 'marks'}`}
                </span>
              )}
              <span
                className={`text-xs sm:text-xs px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                  activeClassState.status === 'RACING'
                    ? 'bg-success-ink/20 text-success-ink border-success-ink/50'
                    : activeClassState.status === 'FINISHED'
                    ? 'bg-raised/20 text-ink-muted border-line/50'
                    : activeClassState.status === 'COUNTDOWN'
                    ? 'bg-warning-ink/20 text-warning-ink border-warning-ink/50'
                    : 'bg-raised/50 text-ink border-line'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeClassState.status === 'RACING' ? 'bg-success-ink' : 'bg-current'
                  }`}
                />
                {raceState.activeClass}: {STATUS_LABEL[activeClassState.status] || activeClassState.status}
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* The one class picker: sets the class the clock, flags and finish act on */}
          <div role="group" aria-label="Active class" className="flex items-center bg-surface border border-line rounded-full p-1 text-xs gap-1 overflow-x-auto no-scrollbar max-w-[60vw] sm:max-w-none">
            {(raceClasses.length > 0
              ? raceClasses.map((c) => c.name)
              : ['Class 1', 'Class 2', 'Class 3']
            ).map((cls) => (
              <button
                key={cls}
                onClick={() => onUpdateRaceState({ activeClass: cls })}
                aria-pressed={raceState.activeClass === cls}
                className={`px-2.5 py-0.5 rounded-full font-bold transition-all shrink-0 ${
                  raceState.activeClass === cls
                    ? 'bg-accent text-on-accent shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {cls}
              </button>
            ))}
            {onOpenClassManager && (
              <button
                onClick={onOpenClassManager}
                className="px-2 py-0.5 rounded-full text-accent hover:text-ink hover:bg-raised transition-all flex items-center gap-1 font-bold text-xs"
                title="Manage Regatta Race Classes"
              >
                <Layers className="w-3 h-3" />
                <span className="hidden md:inline">Classes</span>
              </button>
            )}
          </div>

          {!isOverlay && !isExpanded && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-lg font-bold text-ink tabular-nums" aria-label={`Start clock ${formattedTimer}`}>
                {formattedTimer}
              </span>
              {isPostponed ? (
                <Button variant="primary" onClick={lowerAp} icon={<Flag />}>
                  AP down
                </Button>
              ) : isSeqActive ? (
                <Button onClick={() => setConfirmAp(true)} icon={<Flag />}>
                  AP
                </Button>
              ) : classStatus === 'PRE_START' ? (
                <Button variant="primary" onClick={onToggleRaceTimer} icon={<Play className="fill-current" />}>
                  Start {raceState.activeClass}
                </Button>
              ) : isRacing && onEndRace ? (
                <Button onClick={() => onEndRace(raceState.activeClass)}>Finish {raceState.activeClass}</Button>
              ) : null}
            </div>
          )}

          {!isOverlay && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              aria-expanded={isExpanded}
              className="px-2 py-1 rounded-full text-xs font-bold text-ink-muted hover:text-ink hover:bg-raised transition-all flex items-center gap-1"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-ink-muted hover:text-ink hover:bg-ink/10 transition-all ml-1"
              title="Close Manager Console"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Console Controls */}
      {isExpanded && (
        <div className={`p-3 sm:p-4 landscape:p-2 landscape:space-y-2 flex-1 min-h-0 pb-8 landscape:pb-2 overscroll-contain touch-pan-y ${isOverlay ? 'overflow-y-auto max-h-[calc(100vh-190px)] sm:max-h-[calc(82vh-60px)] landscape:max-h-[calc(98dvh-50px)] custom-scrollbar' : ''}`}>
          {/* Tabs */}
          <div role="tablist" aria-label="Race console sections" className="flex border-b border-line gap-1 overflow-x-auto pb-1 custom-scrollbar">
            <button
              role="tab"
              aria-selected={activeTab === 'SEQUENCE'}
              onClick={() => setActiveTab('SEQUENCE')}
              className={`min-h-10 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'SEQUENCE'
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'bg-canvas text-ink-muted hover:text-ink border border-line'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Start sequence
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'MARKS'}
              onClick={() => setActiveTab('MARKS')}
              className={`min-h-10 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'MARKS'
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'bg-canvas text-ink-muted hover:text-ink border border-line'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Course ({marks.length})
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'OCS_FLEET'}
              onClick={() => setActiveTab('OCS_FLEET')}
              className={`min-h-10 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'OCS_FLEET'
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'bg-canvas text-ink-muted hover:text-ink border border-line'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              OCS & fleet flags {ocsBoats.length > 0 && `(${ocsBoats.length})`}
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'ENVIRONMENT'}
              onClick={() => setActiveTab('ENVIRONMENT')}
              className={`min-h-10 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'ENVIRONMENT'
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'bg-canvas text-ink-muted hover:text-ink border border-line'
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              Wind & telemetry
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'ANNOUNCE'}
              onClick={() => setActiveTab('ANNOUNCE')}
              className={`min-h-10 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'ANNOUNCE'
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'bg-canvas text-ink-muted hover:text-ink border border-line'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              VHF bulletin
            </button>

            {onOpenResults && (
              <Button onClick={onOpenResults} icon={<Trophy />} className="ml-auto shrink-0">
                Results
              </Button>
            )}
          </div>

          {/* TAB 1: START SEQUENCE */}
          {activeTab === 'SEQUENCE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Division 1: Race Countdown Clock with Incorporated Quick sequence presets */}
              <div className="bg-canvas border border-line p-3.5 rounded-2xl flex flex-col justify-between space-y-3">
                {/* Header & Status Indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted font-bold">
                    Start clock: <span className="text-ink">{raceState.activeClass}</span>
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    isPostponed
                      ? 'bg-warning-ink/20 text-warning-ink border-warning-ink/50'
                      : isSeqActive || isRacing
                      ? 'bg-success-ink/20 text-success-ink border-success-ink/40'
                      : 'bg-raised text-ink-muted border-line'
                  }`}>
                    {isPostponed
                      ? 'POSTPONED (AP)'
                      : isSeqActive && displayCountdown > 300
                      ? `WARNING IN ${displayCountdown - 300}s`
                      : isSeqActive
                      ? 'SEQUENCE RUNNING'
                      : isRacing
                      ? 'RACING'
                      : classStatus === 'FINISHED'
                      ? 'FINISHED'
                      : 'STOPPED'}
                  </span>
                </div>


                {/* Big Countdown Display */}
                <div className="text-4xl sm:text-5xl font-bold font-mono tabular-nums text-ink text-center py-1" role="timer" aria-live="off">
                  {formattedTimer}
                </div>

                {/* Presets start or jump the sequence, so they're only offered before the start and not under AP. */}
                {isBeforeStart && !isPostponed && (
                <div className="bg-surface border border-line/80 p-2 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted font-semibold">
                      Quick sequence presets
                    </span>
                    <span className="text-xs text-ink-muted">RRS Rule 26</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateRaceState({ countdownSeconds: 300, startSequenceActive: true })}
                      className="min-h-11 p-1.5 bg-canvas hover:bg-raised border border-line text-ink rounded-control text-center transition-colors flex flex-col items-center justify-center"
                      title="5-Min Warning (Class)"
                    >
                      <span className="text-sm font-bold font-mono">5m</span>
                      <span className="text-xs text-ink-muted leading-none mt-0.5">Warning</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateRaceState({ countdownSeconds: 240, startSequenceActive: true })}
                      className="min-h-11 p-1.5 bg-canvas hover:bg-raised border border-line text-ink rounded-control text-center transition-colors flex flex-col items-center justify-center"
                      title="4-Min Preparatory (P)"
                    >
                      <span className="text-sm font-bold font-mono">4m</span>
                      <span className="text-xs text-ink-muted leading-none mt-0.5">Prep (P)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateRaceState({ countdownSeconds: 60, startSequenceActive: true })}
                      className="min-h-11 p-1.5 bg-canvas hover:bg-raised border border-line text-ink rounded-control text-center transition-colors flex flex-col items-center justify-center"
                      title="1-Min Prep Down"
                    >
                      <span className="text-sm font-bold font-mono">1m</span>
                      <span className="text-xs text-ink-muted leading-none mt-0.5">1 min</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateRaceState({ countdownSeconds: 0, status: 'RACING', startSequenceActive: false })}
                      className="min-h-11 p-1.5 bg-canvas hover:bg-raised border border-line text-ink rounded-control text-center transition-colors flex flex-col items-center justify-center"
                      title="0:00 START RACE NOW"
                    >
                      <span className="text-sm font-bold font-mono">0:00</span>
                      <span className="text-xs text-ink-muted leading-none mt-0.5">Start now</span>
                    </button>
                  </div>
                </div>
                )}

                {/* The primary action follows the class state: Start before the sequence, AP down while
                    postponed. During the sequence and racing, the actions are under Flags and recalls. */}
                <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                  {isPostponed ? (
                    <Button variant="primary" size="lg" onClick={lowerAp} icon={<Flag />}>
                      AP down
                    </Button>
                  ) : classStatus === 'PRE_START' && !isSeqActive ? (
                    <Button variant="primary" size="lg" onClick={onToggleRaceTimer} icon={<Play className="fill-current" />}>
                      Start {raceState.activeClass}
                    </Button>
                  ) : null}

                  {/* Reset is how a sequence started by mistake is stopped; after the start, Restart (confirmed) does this. */}
                  {isBeforeStart && (
                    <Button size="lg" onClick={onResetTimer} icon={<RotateCcw />} aria-label="Reset clock to 5:00" />
                  )}

                  {onToggleMute && (
                    <Button
                      size="lg"
                      onClick={onToggleMute}
                      aria-pressed={isMuted}
                      icon={isMuted ? <VolumeX /> : <Volume2 />}
                      aria-label={isMuted ? 'Horn muted. Unmute' : 'Mute horn'}
                    />
                  )}

                  <Button size="lg" onClick={onPlayStartSignal}>
                    Sound horn
                  </Button>
                </div>
              </div>

              {/* Division 2: Official Flags & Recalls */}
              <div className="bg-canvas border border-line p-3.5 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-ink-muted font-bold">
                      Flags and recalls
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted mb-3">
                    {isPostponed
                      ? 'AP is up. Lower it to restart the sequence: warning signal 1 minute later, start 6 minutes later.'
                      : isRacing
                      ? 'Racing. Recall the class or mark boats over the line early.'
                      : classStatus === 'FINISHED'
                      ? 'This class has finished.'
                      : 'Flags go out to the fleet as VHF bulletins.'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {isPostponed && (
                      <button
                        onClick={lowerAp}
                        className="p-3 bg-warning-ink/10 border border-warning-ink hover:bg-warning-ink/20 text-warning-ink text-xs font-bold rounded-xl text-left transition-all"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Flag className="w-3.5 h-3.5 text-warning-ink" />
                          <span>AP down</span>
                        </div>
                        <div className="text-xs text-warning-ink/80 font-normal">Warning signal in 1 minute</div>
                      </button>
                    )}

                    {isBeforeStart && !isPostponed && (
                      <button
                        onClick={() => setConfirmAp(true)}
                        className="p-3 bg-warning-ink/10 border border-warning-ink hover:bg-warning-ink/20 text-warning-ink text-xs font-bold rounded-xl text-left transition-all"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Flag className="w-3.5 h-3.5 text-warning-ink" />
                          <span>AP flag</span>
                        </div>
                        <div className="text-xs text-warning-ink/80 font-normal">Postpone (hold the sequence)</div>
                      </button>
                    )}

                    {(isSeqActive || isRacing) && (
                    <button
                      onClick={() => {
                        if (onGeneralRecall) {
                          // Confirmed and broadcast by the parent.
                          onGeneralRecall(raceState.activeClass);
                          return;
                        }
                        if (onRestartRace) {
                          onRestartRace(raceState.activeClass);
                        } else {
                          onUpdateRaceState({ status: 'PRE_START', startSequenceActive: false, countdownSeconds: 300 });
                          if (onUpdateFleetStatus) {
                            onUpdateFleetStatus('PRE_START', raceState.activeClass);
                          } else {
                            boats.forEach((b) => onUpdateBoatStatus(b.id, 'PRE_START'));
                          }
                        }
                        onSendVhfNotice('GENERAL RECALL (FIRST SUBSTITUTE)', 'General recall ordered under RRS 29.2. All boats return to pre-start area. Start sequence reset.', 'SAFETY_WARNING');
                      }}
                      className="p-3 bg-danger/10 border border-danger-ink hover:bg-danger/20 text-danger-ink text-xs font-bold rounded-xl text-left transition-all"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-danger-ink" />
                        <span>General Recall</span>
                      </div>
                      <div className="text-xs text-danger-ink/80 font-normal">1st Substitute (Reset Start)</div>
                    </button>
                    )}

                    {isRacing && (
                      <button
                        onClick={() => setActiveTab('OCS_FLEET')}
                        className="p-3 bg-surface border border-line hover:bg-raised text-ink text-xs font-bold rounded-xl text-left transition-all"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>OCS{ocsBoats.length > 0 ? ` (${ocsBoats.length})` : ''}</span>
                        </div>
                        <div className="text-xs text-ink-muted font-normal">Mark or clear boats over early</div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Finishing the race sits here, under the flags, instead of in a separate full-width bar */}
                <div className="pt-3 border-t border-line space-y-2.5">
                  <p className="text-xs text-ink-muted">
                    Fleet: {boats.filter((b) => b.status === 'RACING').length} racing · {boats.filter((b) => b.status === 'FINISHED').length} finished · {boats.filter((b) => b.status === 'OCS').length} OCS
                  </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {onEndRace && isRacing && (
                    <Button variant="primary" onClick={() => onEndRace(raceState.activeClass)}>Finish {raceState.activeClass}</Button>
                  )}

                  {/* Actions that wipe or end the race sit apart from Finish, behind a divider. */}
                  {(onRestartRace || onEndRace) && (
                    <div className={`flex items-center gap-2 ${onEndRace && isRacing ? 'pl-3 ml-3 border-l border-line' : ''}`}>
                      {onRestartRace && (
                        <Button variant="danger" onClick={() => onRestartRace(raceState.activeClass)} icon={<RotateCcw />}>
                          Restart {raceState.activeClass}
                        </Button>
                      )}

                      {onEndRace && (
                        <Button variant="danger" onClick={() => onEndRace()}>
                          End entire race
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: OCS & FLEET FLAGS */}
          {activeTab === 'OCS_FLEET' && (
            <div className="bg-canvas border border-line p-3.5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-bold text-ink flex items-center gap-2">
                    Fleet status
                  </h3>
                  <span className="text-xs text-ink-muted">
                    Set individual or bulk status: PRE_START, RACING, OCS, FINISHED, DNS, DNF, DSQ
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => {
                      if (onUpdateFleetStatus) {
                        onUpdateFleetStatus('PRE_START', raceState.activeClass);
                      } else {
                        boats.forEach((b) => onUpdateBoatStatus(b.id, 'PRE_START'));
                      }
                    }}
                    className="min-h-10 px-3 bg-raised text-ink border border-line hover:brightness-110 rounded-control text-sm font-semibold transition-[filter] cursor-pointer"
                    title="Set all boats in active class to PRE_START"
                  >
                    Set class to pre-start
                  </button>
                  <button
                    onClick={() => {
                      if (onUpdateFleetStatus) {
                        onUpdateFleetStatus('RACING', raceState.activeClass);
                      } else {
                        boats.forEach((b) => onUpdateBoatStatus(b.id, 'RACING'));
                      }
                    }}
                    className="min-h-10 px-3 bg-raised text-ink border border-line hover:brightness-110 rounded-control text-sm font-semibold transition-[filter] cursor-pointer"
                    title="Set all boats in active class to RACING"
                  >
                    Set class to racing
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar">
                {Array.from(new Map<string, Boat>(boats.map((b) => [b.id, b])).values()).map((boat) => (
                  <div
                    key={boat.id}
                    className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 text-xs transition-all ${
                      boat.status === 'OCS'
                        ? 'bg-danger/15 border-danger-ink text-ink shadow-sm'
                        : boat.status === 'PRE_START'
                        ? 'bg-warning-ink/10 border-warning-ink/40 text-ink'
                        : boat.status === 'RACING'
                        ? 'bg-success-ink/30 border-success-ink/40 text-ink'
                        : boat.status === 'FINISHED'
                        ? 'bg-raised/30 border-line/40 text-ink'
                        : 'bg-surface border-line text-ink'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: boat.color }} />
                          {boat.name}
                        </div>
                        <span className="text-xs text-ink-muted">{boat.sailNumber} • {boat.class}</span>
                      </div>

                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          boat.status === 'OCS'
                            ? 'bg-danger text-on-danger'
                            : boat.status === 'PRE_START'
                            ? 'bg-warning-ink/30 text-warning-ink border border-warning-ink/50'
                            : boat.status === 'RACING'
                            ? 'bg-success-ink/30 text-success-ink border border-success-ink/50'
                            : boat.status === 'FINISHED'
                            ? 'bg-raised/30 text-ink-muted border border-line/50'
                            : 'bg-raised text-ink'
                        }`}
                      >
                        {boat.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-line/5">
                      <select
                        value={boat.status}
                        onChange={(e) => onUpdateBoatStatus(boat.id, e.target.value as any)}
                        className="bg-canvas border border-line hover:border-accent text-xs text-ink rounded px-1.5 py-1 focus:outline-none focus:border-accent flex-1 cursor-pointer"
                        title="Override status"
                      >
                        <option value="PRE_START">PRE_START</option>
                        <option value="RACING">RACING</option>
                        <option value="OCS">OCS</option>
                        <option value="CLEARED_OCS">CLEARED_OCS</option>
                        <option value="FINISHED">FINISHED</option>
                        <option value="RET">RET (Retired)</option>
                        <option value="DNF">DNF</option>
                        <option value="DNS">DNS</option>
                        <option value="DSQ">DSQ</option>
                      </select>

                      {boat.status === 'OCS' ? (
                        <button
                          onClick={() => onUpdateBoatStatus(boat.id, 'CLEARED_OCS')}
                          className="px-2 py-1 rounded bg-accent hover:brightness-110 text-on-accent text-xs font-bold shadow-sm transition-colors cursor-pointer shrink-0"
                          title="Clear OCS status and restore to racing"
                        >
                          Clear
                        </button>
                      ) : boat.status !== 'FINISHED' ? (
                        <button
                          onClick={() => onUpdateBoatStatus(boat.id, boat.status === 'PRE_START' ? 'RACING' : 'PRE_START')}
                          className={`px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                            boat.status === 'PRE_START'
                              ? 'bg-success-ink hover:bg-success-ink text-canvas'
                              : 'bg-warning-ink hover:bg-warning-ink text-canvas'
                          }`}
                          title={boat.status === 'PRE_START' ? 'Set to RACING' : 'Reset to PRE_START'}
                        >
                          {boat.status === 'PRE_START' ? '→ Race' : '→ Pre'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ENVIRONMENT & TELEMETRY */}
          {activeTab === 'ENVIRONMENT' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-canvas border border-line p-3.5 rounded-2xl space-y-3">
                <span className="text-xs text-ink-muted block">
                  Wind
                </span>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink-muted">Wind Speed:</span>
                      <span className="text-accent font-bold">{raceState.windSpeedKt} knots</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="35"
                      step="0.5"
                      value={raceState.windSpeedKt}
                      onChange={(e) => onUpdateWind(parseFloat(e.target.value), raceState.windDirectionDeg)}
                      className="w-full accent-accent"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-ink-muted">Wind Direction:</span>
                      <span className="text-success-ink font-bold">{raceState.windDirectionDeg}° SW</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="359"
                      value={raceState.windDirectionDeg}
                      onChange={(e) => onUpdateWind(raceState.windSpeedKt, parseInt(e.target.value))}
                      className="w-full accent-success-ink"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-canvas border border-line p-3.5 rounded-2xl space-y-3">
                <span className="text-xs text-ink-muted block">
                  Tracking rate
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onUpdateRaceState({ telemetryRate: 'HIGH_FREQUENCY' })}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                      raceState.telemetryRate === 'HIGH_FREQUENCY'
                        ? 'bg-accent/20 border-accent text-ink shadow-sm'
                        : 'bg-surface border-line text-ink-muted'
                    }`}
                  >
                    <div>High Frequency (5s)</div>
                    <span className="text-xs text-ink-muted font-normal">Start sequence precision</span>
                  </button>

                  <button
                    onClick={() => onUpdateRaceState({ telemetryRate: 'OFFSHORE_LEG' })}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                      raceState.telemetryRate === 'OFFSHORE_LEG'
                        ? 'bg-accent/20 border-success-ink text-ink shadow-sm'
                        : 'bg-surface border-line text-ink-muted'
                    }`}
                  >
                    <div>Offshore Mode (60s)</div>
                    <span className="text-xs text-ink-muted font-normal">Battery saving mode</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COURSE. Read here; built in Setup > Course. */}
          {activeTab === 'MARKS' && (
            <div className="bg-canvas border border-line p-3.5 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ink">
                  {marks.length === 0 ? 'No course set.' : <>Course: <strong>{raceState.courseName || 'Custom course'}</strong></>}
                </p>
                {onEditCourse && (
                  <Button variant={marks.length === 0 ? 'primary' : 'secondary'} icon={<Route />} onClick={onEditCourse}>
                    {marks.length === 0 ? 'Set the course in Setup' : 'Edit course in Setup'}
                  </Button>
                )}
              </div>
              {marks.length > 0 && <CourseMarksEditor marks={marks} readOnly />}
            </div>
          )}

          {/* TAB 5: BROADCAST VHF BULLETIN */}
          {activeTab === 'ANNOUNCE' && (
            <form onSubmit={handleBroadcastNotice} className="bg-canvas border border-line p-3.5 rounded-2xl space-y-3">
              <span className="text-xs text-ink-muted block">
                Send a notice to the fleet
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={noticeType}
                  onChange={(e: any) => setNoticeType(e.target.value)}
                  className="bg-surface border border-line text-ink rounded-xl p-2 text-xs"
                >
                  <option value="COURSE_CHANGE">COURSE CHANGE</option>
                  <option value="POSTPONEMENT">POSTPONEMENT</option>
                  <option value="SAFETY_WARNING">SAFETY WARNING</option>
                  <option value="GENERAL_ANNOUNCEMENT">ANNOUNCEMENT</option>
                </select>

                <input
                  type="text"
                  placeholder="Notice Title..."
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  className="sm:col-span-2 bg-surface border border-line text-ink rounded-xl p-2 text-xs"
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Notice message text..."
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  className="flex-1 bg-surface border border-line text-ink rounded-xl p-2 text-xs"
                />

                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent text-on-accent text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Broadcast
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Portaled: the overlay panel's backdrop-blur would otherwise trap the fixed-position dialog inside it. */}
      {confirmAp &&
        createPortal(
          <ConfirmDialog
            title={`Postpone ${raceState.activeClass}?`}
            body="AP goes up and the start clock stops at 5:00. The fleet gets a postponement notice on VHF. When you lower AP, the warning signal comes 1 minute later."
            confirmLabel="Hoist AP"
            onConfirm={hoistAp}
            onCancel={() => setConfirmAp(false)}
          />,
          document.body
        )}
    </div>
  );
};
