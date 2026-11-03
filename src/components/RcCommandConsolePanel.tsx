import React, { useState } from 'react';
import { Boat, CourseMark, RaceClass, RaceClassDefinition, RaceState } from '../types/regatta';
import { serverNow } from '../services/serverClock';
import {
  addCourseMark,
  removeCourseMark,
  moveMarkOrder,
  updateMarkCoordinates,
  updateMarkSettings,
  generateCoursePreset,
} from '../services/courseService';
import {
  Compass,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle,
  Flag,
  Wind,
  Radio,
  Plus,
  Trash2,
  MapPin,
  Send,
  Sliders,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Layers,
  Trophy,
  X,
  Sailboat,
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
  directSunlightMode: boolean;
  raceClasses?: RaceClassDefinition[];
  onOpenClassManager?: () => void;
  onOpenResults?: () => void;
  onOpenCourseProfiles?: () => void;
  courseProfileCount?: number;
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
  directSunlightMode,
  raceClasses = [],
  onOpenClassManager,
  onOpenResults,
  onOpenCourseProfiles,
  courseProfileCount = 0,
  onClose,
  isOverlay = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'SEQUENCE' | 'OCS_FLEET' | 'ENVIRONMENT' | 'MARKS' | 'ANNOUNCE'>('SEQUENCE');

  // Announcement form
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeType, setNoticeType] = useState<'COURSE_CHANGE' | 'POSTPONEMENT' | 'SAFETY_WARNING' | 'GENERAL_ANNOUNCEMENT'>('COURSE_CHANGE');

  // Mark editing
  const [editingMarkId, setEditingMarkId] = useState<string | null>(null);

  // Active class state computation
  const activeClassState = raceState.classStates?.[raceState.activeClass] || {
    status: raceState.status,
    countdownSeconds: raceState.countdownSeconds,
    startSequenceActive: raceState.startSequenceActive,
    targetStartTime: raceState.targetStartTime,
    startTime: raceState.startTime,
  };
  const isSeqActive = activeClassState.startSequenceActive ?? raceState.startSequenceActive;
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
          ? 'w-full max-w-2xl max-h-[calc(100vh-130px)] sm:max-h-[82vh] landscape:max-h-[98dvh] landscape:h-[98dvh] h-full rounded-2xl sm:rounded-3xl bg-[#0A0F1E]/90 backdrop-blur-md border border-[#334155]/80 shadow-2xl overflow-hidden min-h-0'
          : directSunlightMode
          ? 'border-b z-20 bg-black text-white border-white'
          : 'border-b z-20 bg-[#1F1F1F] text-[#E8EAED] border-[#3C4043]'
      }`}
    >
      {/* Console Title Bar */}
      <div
        className={`px-3 sm:px-4 py-2.5 landscape:py-1.5 flex items-center justify-between border-b shrink-0 ${
          isOverlay
            ? 'border-[#334155]/80 bg-[#121826]/75'
            : 'border-[#3C4043] bg-[#28292A]/80'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#FBBC04] text-black flex items-center justify-center font-bold text-xs shadow-md shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-google font-bold tracking-tight text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span>Race Control</span>
              <span className="bg-[#FBBC04]/20 text-[#FBBC04] text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-mono border border-[#FBBC04]/40 font-bold">
                ADMIN CONSOLE
              </span>
              {(() => {
                 const currentClassDef = raceClasses.find(c => c.name === raceState.activeClass);
                 if (currentClassDef?.courseProfileName) {
                   return (
                     <span className="bg-[#00D4FF]/20 text-[#00D4FF] text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-mono border border-[#00D4FF]/40 flex items-center gap-1 font-bold">
                       <Route className="w-3 h-3" />
                       Course: {currentClassDef.courseProfileName}
                     </span>
                   );
                 }
                 return null;
               })()}
              <span
                className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border flex items-center gap-1 ${
                  activeClassState.status === 'RACING'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : activeClassState.status === 'FINISHED'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                    : activeClassState.status === 'COUNTDOWN'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-700/50 text-slate-300 border-slate-600'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeClassState.status === 'RACING' ? 'bg-emerald-400 animate-pulse' : 'bg-current'
                  }`}
                />
                {raceState.activeClass}: {activeClassState.status === 'RACING' ? 'IN PROGRESS' : activeClassState.status}
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Race Class Switcher */}
          <div className="hidden sm:flex items-center bg-[#1F1F1F] border border-[#3C4043] rounded-full p-1 text-[11px] font-mono gap-1">
            {(raceClasses.length > 0
              ? raceClasses.map((c) => c.name)
              : ['Class 1', 'Class 2', 'Class 3']
            ).map((cls) => (
              <button
                key={cls}
                onClick={() => onUpdateRaceState({ activeClass: cls })}
                className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${
                  raceState.activeClass === cls
                    ? 'bg-[#1A73E8] text-white shadow-sm'
                    : 'text-[#9AA0A6] hover:text-white'
                }`}
              >
                {cls}
              </button>
            ))}
            {onOpenClassManager && (
              <button
                onClick={onOpenClassManager}
                className="px-2 py-0.5 rounded-full text-[#8AB4F8] hover:text-white hover:bg-[#3C4043] transition-all flex items-center gap-1 font-bold text-[10px]"
                title="Manage Regatta Race Classes"
              >
                <Layers className="w-3 h-3" />
                <span className="hidden md:inline">Classes</span>
              </button>
            )}
          </div>

          {!isOverlay && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-full text-[#9AA0A6] hover:text-white hover:bg-[#3C4043] transition-all"
              title={isExpanded ? 'Collapse Console' : 'Expand Console'}
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#9AA0A6] hover:text-white hover:bg-white/10 transition-all ml-1"
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
          <div className="flex border-b border-[#3C4043] gap-1 overflow-x-auto pb-1 custom-scrollbar">
            <button
              onClick={() => setActiveTab('SEQUENCE')}
              className={`px-3 py-1.5 rounded-full text-xs font-google font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'SEQUENCE'
                  ? 'bg-[#1A73E8] text-white shadow-sm'
                  : 'bg-[#292A2D] text-[#9AA0A6] hover:text-white border border-[#3C4043]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              5-4-1-Go Start Sequence
            </button>

            <button
              onClick={() => setActiveTab('MARKS')}
              className={`px-3 py-1.5 rounded-full text-xs font-google font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'MARKS'
                  ? 'bg-[#FBBC04] text-black shadow-sm font-bold'
                  : 'bg-[#292A2D] text-[#9AA0A6] hover:text-white border border-[#3C4043]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              Course Marks ({marks.length})
            </button>

            <button
              onClick={() => setActiveTab('OCS_FLEET')}
              className={`px-3 py-1.5 rounded-full text-xs font-google font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'OCS_FLEET'
                  ? 'bg-[#EA4335] text-white shadow-sm'
                  : 'bg-[#292A2D] text-[#9AA0A6] hover:text-white border border-[#3C4043]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              OCS & Fleet Flags {ocsBoats.length > 0 && `(${ocsBoats.length})`}
            </button>

            <button
              onClick={() => setActiveTab('ENVIRONMENT')}
              className={`px-3 py-1.5 rounded-full text-xs font-google font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'ENVIRONMENT'
                  ? 'bg-[#34A853] text-white shadow-sm'
                  : 'bg-[#292A2D] text-[#9AA0A6] hover:text-white border border-[#3C4043]'
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              Wind & Telemetry Rate
            </button>

            <button
              onClick={() => setActiveTab('ANNOUNCE')}
              className={`px-3 py-1.5 rounded-full text-xs font-google font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'ANNOUNCE'
                  ? 'bg-[#A142F4] text-white shadow-sm'
                  : 'bg-[#292A2D] text-[#9AA0A6] hover:text-white border border-[#3C4043]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Broadcast VHF Bulletin
            </button>

            {onOpenResults && (
              <button
                type="button"
                onClick={onOpenResults}
                className="px-3 py-1.5 rounded-full text-xs font-google font-bold transition-all flex items-center gap-1.5 shrink-0 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 ml-auto shadow-sm"
                title="Open Official Race Results & RRS Scoring Summary (Phase 4)"
              >
                <Trophy className="w-3.5 h-3.5 text-[#FFB800]" />
                Official Results & Scoring
              </button>
            )}
          </div>

          {/* TAB 1: START SEQUENCE */}
          {activeTab === 'SEQUENCE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Division 1: Race Countdown Clock with Incorporated Quick Sequence Presets */}
              <div className="bg-[#292A2D] border border-[#3C4043] p-3.5 rounded-2xl flex flex-col justify-between space-y-3">
                {/* Header & Status Indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#9AA0A6] uppercase tracking-wider font-bold">
                    Race Countdown Clock
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    isSeqActive
                      ? 'bg-[#81C995]/20 text-[#81C995] border-[#81C995]/40 animate-pulse'
                      : activeClassState.status === 'RACING'
                      ? 'bg-[#00FF9D]/20 text-[#00FF9D] border-[#00FF9D]/40'
                      : 'bg-[#3C4043] text-[#9AA0A6] border-[#5F6368]'
                  }`}>
                    {isSeqActive ? 'SEQUENCE RUNNING' : activeClassState.status === 'RACING' ? 'RACING' : 'STOPPED'}
                  </span>
                </div>

                {/* Class List Selector for Countdown Timer */}
                <div className="bg-[#1F1F1F] border border-[#3C4043] p-2 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono text-[#8AB4F8] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#00D4FF]" />
                      Select Class for Start:
                    </label>
                    <span className="text-[9px] font-mono text-[#9AA0A6]">
                      Active: <strong className="text-white">{raceState.activeClass}</strong>
                    </span>
                  </div>

                  {/* Dropdown for Mobile / Compact view */}
                  <select
                    value={raceState.activeClass}
                    onChange={(e) => onUpdateRaceState({ activeClass: e.target.value })}
                    className="w-full bg-[#292A2D] text-white text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 border border-[#3C4043] focus:border-[#00D4FF] focus:outline-hidden cursor-pointer"
                    title="Switch Class to Start Respective Race"
                  >
                    {(raceClasses.length > 0
                      ? raceClasses
                      : [
                          { id: 'c1', name: 'Class 1' },
                          { id: 'c2', name: 'Class 2' },
                          { id: 'c3', name: 'Class 3' },
                        ]
                    ).map((c) => {
                      const clsState = raceState.classStates?.[c.name];
                      const clsStatus = clsState?.status || (c.name === raceState.activeClass ? raceState.status : 'NOT_STARTED');
                      return (
                        <option key={c.id || c.name} value={c.name}>
                          {c.name} — [{clsStatus}]
                        </option>
                      );
                    })}
                  </select>

                  {/* Quick-tap pills for available classes */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                    {(raceClasses.length > 0
                      ? raceClasses.map((c) => c.name)
                      : ['Class 1', 'Class 2', 'Class 3']
                    ).map((cls) => {
                      const isSelected = raceState.activeClass === cls;
                      const clsState = raceState.classStates?.[cls];
                      const clsStatus = clsState?.status || (cls === raceState.activeClass ? raceState.status : 'NOT_STARTED');

                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => onUpdateRaceState({ activeClass: cls })}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold shrink-0 transition-all border ${
                            isSelected
                              ? 'bg-[#1A73E8] text-white border-[#1A73E8] shadow-xs'
                              : 'bg-[#292A2D] text-[#9AA0A6] hover:text-white border-[#3C4043]'
                          }`}
                          title={`Switch to ${cls} (${clsStatus})`}
                        >
                          <span>{cls}</span>
                          {clsStatus === 'RACING' && (
                            <span className="ml-1 text-[8px] text-[#00FF9D]">●</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Big Countdown Display */}
                <div className="text-4xl sm:text-5xl font-mono font-black text-white text-center py-1 tracking-tight">
                  {formattedTimer}
                </div>

                {/* Incorporated Quick Sequence Presets (Compacted directly inside Clock Division) */}
                <div className="bg-[#1F1F1F] border border-[#3C4043]/80 p-2 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-[#9AA0A6] uppercase tracking-wider font-semibold">
                      Quick Sequence Presets
                    </span>
                    <span className="text-[8px] font-mono text-[#5F6368]">RRS Rule 26</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateRaceState({ countdownSeconds: 300, startSequenceActive: true })}
                      className="p-1.5 bg-[#292A2D] hover:bg-[#333538] border border-[#3C4043] hover:border-[#1A73E8] text-white rounded-lg text-center transition-all flex flex-col items-center justify-center"
                      title="5-Min Warning (Class)"
                    >
                      <span className="text-xs font-mono font-bold">5m</span>
                      <span className="text-[8px] text-[#9AA0A6] leading-none mt-0.5">Warning</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateRaceState({ countdownSeconds: 240, startSequenceActive: true })}
                      className="p-1.5 bg-[#292A2D] hover:bg-[#333538] border border-[#3C4043] hover:border-[#1A73E8] text-white rounded-lg text-center transition-all flex flex-col items-center justify-center"
                      title="4-Min Preparatory (P)"
                    >
                      <span className="text-xs font-mono font-bold">4m</span>
                      <span className="text-[8px] text-[#9AA0A6] leading-none mt-0.5">Prep (P)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateRaceState({ countdownSeconds: 60, startSequenceActive: true })}
                      className="p-1.5 bg-[#292A2D] hover:bg-[#333538] border border-[#3C4043] hover:border-[#EA4335] text-[#F28B82] rounded-lg text-center transition-all flex flex-col items-center justify-center"
                      title="1-Min Prep Down"
                    >
                      <span className="text-xs font-mono font-bold">1m</span>
                      <span className="text-[8px] text-[#F28B82]/80 leading-none mt-0.5">1-Min</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateRaceState({ countdownSeconds: 0, status: 'RACING', startSequenceActive: false })}
                      className="p-1.5 bg-[#1E8E3E]/25 hover:bg-[#1E8E3E]/40 border border-[#81C995] text-[#81C995] rounded-lg text-center transition-all flex flex-col items-center justify-center"
                      title="0:00 START RACE NOW"
                    >
                      <span className="text-xs font-mono font-bold">0:00</span>
                      <span className="text-[8px] text-[#81C995] leading-none mt-0.5">Go / Start</span>
                    </button>
                  </div>
                </div>

                {/* Control Action Buttons (Start button is prominent / slightly larger) */}
                <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                  <button
                    onClick={onToggleRaceTimer}
                    className={`px-5 py-2.5 rounded-full font-google text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-md ${
                      isSeqActive
                        ? 'bg-[#FBBC04] text-black hover:bg-yellow-400'
                        : 'bg-[#34A853] text-white hover:bg-green-600'
                    }`}
                    title={`Toggle sequence for ${raceState.activeClass}`}
                  >
                    {isSeqActive ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" /> Pause Sequence
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" /> Start {raceState.activeClass}
                      </>
                    )}
                  </button>

                  <button
                    onClick={onResetTimer}
                    className="p-2.5 rounded-full bg-[#3C4043] text-[#9AA0A6] hover:text-white transition-all"
                    title="Reset to 5:00"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {onToggleMute && (
                    <button
                      onClick={onToggleMute}
                      className={`p-2.5 rounded-full transition-all ${
                        isMuted
                          ? 'bg-[#EA4335]/20 text-[#F28B82] hover:bg-[#EA4335]/30 border border-[#EA4335]/40'
                          : 'bg-[#1E8E3E]/20 text-[#81C995] hover:bg-[#1E8E3E]/30 border border-[#81C995]/40'
                      }`}
                      title={isMuted ? 'Muted — Click to Unmute' : 'Audio Active — Click to Mute'}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  )}

                  <button
                    onClick={onPlayStartSignal}
                    className="px-3.5 py-2 rounded-full bg-[#1A73E8] text-white hover:bg-blue-600 transition-all font-bold text-xs"
                    title="Sound Horn Signal"
                  >
                    Sound Horn
                  </button>
                </div>
              </div>

              {/* Division 2: Official Flags & Recalls */}
              <div className="bg-[#292A2D] border border-[#3C4043] p-3.5 rounded-2xl flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-[#9AA0A6] uppercase tracking-wider font-bold">
                      Official Flags & Recalls
                    </span>
                    <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                      RRS Race Signals
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9AA0A6] mb-3">
                    Signal fleet flags over VHF bulletins and synchronize timers automatically.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      onClick={() => {
                        onUpdateRaceState({ status: 'PRE_START', startSequenceActive: false, countdownSeconds: 300 });
                        if (onUpdateFleetStatus) {
                          onUpdateFleetStatus('PRE_START', raceState.activeClass);
                        } else {
                          boats.forEach((b) => onUpdateBoatStatus(b.id, 'PRE_START'));
                        }
                        onSendVhfNotice('POSTPONEMENT (AP FLAG)', 'Race postponed under RRS 27.3. Starting sequence held in pre-start.', 'POSTPONEMENT');
                      }}
                      className="p-3 bg-[#FBBC04]/10 border border-[#FBBC04] hover:bg-[#FBBC04]/20 text-[#FBBC04] text-xs font-mono font-bold rounded-xl text-left transition-all"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Flag className="w-3.5 h-3.5 text-[#FBBC04]" />
                        <span>AP Flag</span>
                      </div>
                      <div className="text-[10px] text-[#FBBC04]/80 font-normal">Postponement (Hold in Pre-Start)</div>
                    </button>

                    <button
                      onClick={() => {
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
                      className="p-3 bg-[#EA4335]/10 border border-[#EA4335] hover:bg-[#EA4335]/20 text-[#F28B82] text-xs font-mono font-bold rounded-xl text-left transition-all"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#EA4335]" />
                        <span>General Recall</span>
                      </div>
                      <div className="text-[10px] text-[#F28B82]/80 font-normal">1st Substitute (Reset Start)</div>
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#1F1F1F] border border-[#3C4043]/60 text-[10px] font-mono text-[#9AA0A6] flex items-center justify-between">
                  <span>Class in Sequence: <strong className="text-white">{raceState.activeClass}</strong></span>
                  <span className="text-[#81C995]">Ready to broadcast signals</span>
                </div>
              </div>

              {/* Race Finish & Finalize Results Bar */}
              <div className="col-span-1 md:col-span-2 bg-[#1F1F1F] border border-[#3C4043] p-3.5 rounded-2xl flex items-center justify-between flex-wrap gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-sm">
                    🏁
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-google flex items-center gap-2">
                      Race Control: <span className="text-[#00FF9D]">{raceState.status === 'RACING' ? `In Progress (${raceState.activeClass})` : raceState.status === 'FINISHED' ? 'Race Concluded / Finished' : raceState.status}</span>
                    </h4>
                    <p className="text-[10px] text-[#9AA0A6] font-mono">
                      Fleet: {boats.filter((b) => b.status === 'RACING').length} Racing • {boats.filter((b) => b.status === 'FINISHED').length} Finished • {boats.filter((b) => b.status === 'OCS').length} OCS
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {onEndRace && (
                    <button
                      onClick={() => onEndRace(raceState.activeClass)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 shadow-md"
                      title="Finish and lock times for active race class"
                    >
                      <span>🏁 Finish Class {raceState.activeClass}</span>
                    </button>
                  )}

                  {onEndRace && (
                    <button
                      onClick={() => onEndRace()}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 shadow-md"
                      title="Finish race for all classes, stop all timers, and open official scoring"
                    >
                      <span>🏁 End Entire Race</span>
                    </button>
                  )}

                  {onRestartRace && (
                    <button
                      onClick={() => onRestartRace(raceState.activeClass)}
                      className="px-3 py-1.5 bg-[#3C4043] hover:bg-[#4E5256] text-[#E8EAED] rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5"
                      title="Reset elapsed time to 00:00 and reset fleet positions"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restart Race</span>
                    </button>
                  )}

                  {onOpenResults && (
                    <button
                      onClick={onOpenResults}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Trophy className="w-3.5 h-3.5 text-[#FFB800]" />
                      <span>Official Results</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OCS & FLEET FLAGS */}
          {activeTab === 'OCS_FLEET' && (
            <div className="bg-[#292A2D] border border-[#3C4043] p-3.5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-google font-bold text-white flex items-center gap-2">
                    Fleet Pre-Start & Racing Status Manager
                  </h3>
                  <span className="text-[10px] font-mono text-[#9AA0A6]">
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
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer"
                    title="Set all boats in active class to PRE_START"
                  >
                    Reset Active Fleet to Pre-Start
                  </button>
                  <button
                    onClick={() => {
                      if (onUpdateFleetStatus) {
                        onUpdateFleetStatus('RACING', raceState.activeClass);
                      } else {
                        boats.forEach((b) => onUpdateBoatStatus(b.id, 'RACING'));
                      }
                    }}
                    className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer"
                    title="Set all boats in active class to RACING"
                  >
                    Set Active Fleet to Racing
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar">
                {Array.from(new Map<string, Boat>(boats.map((b) => [b.id, b])).values()).map((boat) => (
                  <div
                    key={boat.id}
                    className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 text-xs font-mono transition-all ${
                      boat.status === 'OCS'
                        ? 'bg-[#EA4335]/15 border-[#EA4335] text-white shadow-sm'
                        : boat.status === 'PRE_START'
                        ? 'bg-[#FBBC04]/10 border-[#FBBC04]/40 text-[#E8EAED]'
                        : boat.status === 'RACING'
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-white'
                        : boat.status === 'FINISHED'
                        ? 'bg-purple-950/30 border-purple-500/40 text-[#E8EAED]'
                        : 'bg-[#1F1F1F] border-[#3C4043] text-[#E8EAED]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: boat.color }} />
                          {boat.name}
                        </div>
                        <span className="text-[10px] text-[#9AA0A6]">{boat.sailNumber} • {boat.class}</span>
                      </div>

                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          boat.status === 'OCS'
                            ? 'bg-[#EA4335] text-white animate-pulse'
                            : boat.status === 'PRE_START'
                            ? 'bg-[#FBBC04]/30 text-[#FBBC04] border border-[#FBBC04]/50'
                            : boat.status === 'RACING'
                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                            : boat.status === 'FINISHED'
                            ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {boat.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5">
                      <select
                        value={boat.status}
                        onChange={(e) => onUpdateBoatStatus(boat.id, e.target.value as any)}
                        className="bg-[#0D1117] border border-[#3C4043] hover:border-[#00D4FF] text-[10px] text-white font-mono rounded px-1.5 py-1 focus:outline-none focus:border-[#00D4FF] flex-1 cursor-pointer"
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
                          className="px-2 py-1 rounded bg-[#34A853] hover:bg-[#2e9449] text-white text-[9.5px] font-bold shadow-sm transition-colors cursor-pointer shrink-0"
                          title="Clear OCS status and restore to racing"
                        >
                          Clear
                        </button>
                      ) : boat.status !== 'FINISHED' ? (
                        <button
                          onClick={() => onUpdateBoatStatus(boat.id, boat.status === 'PRE_START' ? 'RACING' : 'PRE_START')}
                          className={`px-2 py-1 rounded text-[9.5px] font-bold transition-colors cursor-pointer shrink-0 ${
                            boat.status === 'PRE_START'
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : 'bg-amber-600 hover:bg-amber-500 text-white'
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
              <div className="bg-[#292A2D] border border-[#3C4043] p-3.5 rounded-2xl space-y-3">
                <span className="text-[10px] font-mono text-[#9AA0A6] uppercase tracking-wider block">
                  Live Course Wind Settings
                </span>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-[#9AA0A6]">Wind Speed:</span>
                      <span className="text-[#8AB4F8] font-bold">{raceState.windSpeedKt} knots</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="35"
                      step="0.5"
                      value={raceState.windSpeedKt}
                      onChange={(e) => onUpdateWind(parseFloat(e.target.value), raceState.windDirectionDeg)}
                      className="w-full accent-[#1A73E8]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="text-[#9AA0A6]">Wind Direction:</span>
                      <span className="text-[#81C995] font-bold">{raceState.windDirectionDeg}° SW</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="359"
                      value={raceState.windDirectionDeg}
                      onChange={(e) => onUpdateWind(raceState.windSpeedKt, parseInt(e.target.value))}
                      className="w-full accent-[#34A853]"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#292A2D] border border-[#3C4043] p-3.5 rounded-2xl space-y-3">
                <span className="text-[10px] font-mono text-[#9AA0A6] uppercase tracking-wider block">
                  Telemetry Ping Rate Mode
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onUpdateRaceState({ telemetryRate: 'HIGH_FREQUENCY' })}
                    className={`p-3 rounded-xl border text-left text-xs font-mono font-bold transition-all ${
                      raceState.telemetryRate === 'HIGH_FREQUENCY'
                        ? 'bg-[#1A73E8]/20 border-[#1A73E8] text-white shadow-sm'
                        : 'bg-[#1F1F1F] border-[#3C4043] text-[#9AA0A6]'
                    }`}
                  >
                    <div>High Frequency (5s)</div>
                    <span className="text-[10px] text-[#9AA0A6] font-normal">Start sequence precision</span>
                  </button>

                  <button
                    onClick={() => onUpdateRaceState({ telemetryRate: 'OFFSHORE_LEG' })}
                    className={`p-3 rounded-xl border text-left text-xs font-mono font-bold transition-all ${
                      raceState.telemetryRate === 'OFFSHORE_LEG'
                        ? 'bg-[#34A853]/20 border-[#34A853] text-white shadow-sm'
                        : 'bg-[#1F1F1F] border-[#3C4043] text-[#9AA0A6]'
                    }`}
                  >
                    <div>Offshore Mode (60s)</div>
                    <span className="text-[10px] text-[#9AA0A6] font-normal">Battery saving mode</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COURSE MARKS & BUOY MANAGER */}
          {activeTab === 'MARKS' && (
            <div className="bg-[#292A2D] border border-[#3C4043] p-3.5 rounded-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono text-[#9AA0A6] uppercase tracking-wider block">
                    Dynamic Course Geometry & Mark Buoy Sequencing
                  </span>
                  <span className="text-xs text-white font-google">
                    Marks are ordered sequentially (1, 2, 3...). Deleting a mark automatically shifts subsequent marks.
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onOpenCourseProfiles && (
                    <button
                      type="button"
                      onClick={onOpenCourseProfiles}
                      className="px-3 py-1.5 bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 border border-[#00D4FF]/50 text-[#00D4FF] font-google text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                      title="Manage saved course mark profiles (Max 10)"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Profiles ({courseProfileCount}/10)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const centerLat = marks.length > 0 ? marks[0].lat : 6.308;
                      const centerLng = marks.length > 0 ? marks[0].lng : 99.845;
                      const newMarks = addCourseMark(marks, centerLat + (Math.random() - 0.5) * 0.01, centerLng + (Math.random() - 0.5) * 0.01, 'WINDWARD');
                      onUpdateMarks(newMarks);
                    }}
                    className="px-3 py-1.5 bg-[#FBBC04] text-black font-google text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md hover:bg-yellow-400 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Add Mark #{marks.filter(m => m.type !== 'PIN_END' && m.type !== 'RC_BOAT' && m.type !== 'FINISH' && m.type !== 'FINISH_PIN' && m.type !== 'FINISH_RC').length + 1}
                  </button>

                  <div className="flex items-center gap-1 bg-[#1F1F1F] p-1 rounded-xl border border-[#3C4043]">
                    <button
                      type="button"
                      onClick={() => {
                        const centerLat = marks.length > 0 ? marks[0].lat : 6.308;
                        const centerLng = marks.length > 0 ? marks[0].lng : 99.845;
                        onUpdateMarks(generateCoursePreset('WINDWARD_LEEWARD', centerLat, centerLng, raceState.windDirectionDeg));
                      }}
                      className="px-2 py-1 rounded-lg text-[10px] font-mono text-[#9AA0A6] hover:text-white hover:bg-[#3C4043] transition-colors"
                      title="Load Windward-Leeward Course"
                    >
                      Preset: W/L
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const centerLat = marks.length > 0 ? marks[0].lat : 6.308;
                        const centerLng = marks.length > 0 ? marks[0].lng : 99.845;
                        onUpdateMarks(generateCoursePreset('TRIANGLE', centerLat, centerLng, raceState.windDirectionDeg));
                      }}
                      className="px-2 py-1 rounded-lg text-[10px] font-mono text-[#9AA0A6] hover:text-white hover:bg-[#3C4043] transition-colors"
                      title="Load Olympic Triangle Course"
                    >
                      Preset: Triangle
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const centerLat = marks.length > 0 ? marks[0].lat : 6.308;
                        const centerLng = marks.length > 0 ? marks[0].lng : 99.845;
                        onUpdateMarks(generateCoursePreset('TRAPEZOID', centerLat, centerLng, raceState.windDirectionDeg));
                      }}
                      className="px-2 py-1 rounded-lg text-[10px] font-mono text-[#9AA0A6] hover:text-white hover:bg-[#3C4043] transition-colors"
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
                      className={`p-3 rounded-xl border transition-all text-xs font-mono flex flex-col justify-between ${
                        isPin
                          ? 'bg-[#FF4D4D]/10 border-[#FF4D4D]/40 text-white'
                          : isRC
                          ? 'bg-[#00D4FF]/10 border-[#00D4FF]/40 text-white'
                          : isFinish
                          ? 'bg-[#00FF9D]/10 border-[#00FF9D]/40 text-white'
                          : 'bg-[#1F1F1F] border-[#3C4043] text-[#E8EAED]'
                      }`}
                    >
                      <div>
                        <div className="font-bold flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-[10px] text-black ${
                                isPin ? 'bg-[#FF4D4D]' : isRC ? 'bg-[#00D4FF]' : isFinish ? 'bg-[#00FF9D]' : 'bg-[#FBBC04]'
                              }`}
                            >
                              {m.shortName || (isPin ? 'SP' : isRC ? 'RC' : isFinish ? 'FP' : `#${m.orderIndex}`)}
                            </span>
                            <span className="truncate max-w-[140px]">{m.name}</span>
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                              m.requiredRounding === 'STARBOARD'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : m.requiredRounding === 'PORT'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {m.requiredRounding}
                          </span>
                        </div>

                        <div className="text-[10px] text-[#9AA0A6] space-y-0.5 mt-1">
                          <div>Lat: {m.lat != null ? Number(m.lat).toFixed(5) : '0.00000'}° • Lng: {m.lng != null ? Number(m.lng).toFixed(5) : '0.00000'}°</div>
                          <div>Radius: {m.radiusMeters}m • Type: {m.type}</div>
                        </div>
                      </div>

                      {/* Mark Action Controls */}
                      <div className="mt-2 pt-2 border-t border-[#3C4043]/60 flex items-center justify-between gap-1">
                        {isSeq && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onUpdateMarks(moveMarkOrder(marks, m.id, 'UP'))}
                              disabled={m.orderIndex === 1}
                              className="p-1 rounded bg-[#3C4043] hover:bg-slate-600 disabled:opacity-30 text-[#8AB4F8]"
                              title="Move Up in sequence"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateMarks(moveMarkOrder(marks, m.id, 'DOWN'))}
                              className="p-1 rounded bg-[#3C4043] hover:bg-slate-600 text-[#8AB4F8]"
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
                            className="px-2 py-0.5 rounded bg-[#3C4043] text-[10px] text-[#8AB4F8] hover:text-white"
                            title="Toggle Port / Starboard Rounding"
                          >
                            Flip Rounding
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateMarks(removeCourseMark(marks, m.id))}
                            className="p-1 rounded bg-[#EA4335]/20 hover:bg-[#EA4335]/40 text-[#F28B82] border border-[#EA4335]/40"
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
          )}

          {/* TAB 5: BROADCAST VHF BULLETIN */}
          {activeTab === 'ANNOUNCE' && (
            <form onSubmit={handleBroadcastNotice} className="bg-[#292A2D] border border-[#3C4043] p-3.5 rounded-2xl space-y-3">
              <span className="text-[10px] font-mono text-[#9AA0A6] uppercase tracking-wider block">
                Broadcast Fleet Notice over Digital VHF & Meshtastic LoRa
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={noticeType}
                  onChange={(e: any) => setNoticeType(e.target.value)}
                  className="bg-[#1F1F1F] border border-[#3C4043] text-white rounded-xl p-2 text-xs font-mono"
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
                  className="sm:col-span-2 bg-[#1F1F1F] border border-[#3C4043] text-white rounded-xl p-2 text-xs font-mono"
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Notice message text..."
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  className="flex-1 bg-[#1F1F1F] border border-[#3C4043] text-white rounded-xl p-2 text-xs font-mono"
                />

                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1A73E8] hover:bg-blue-600 text-white font-google text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Broadcast
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
