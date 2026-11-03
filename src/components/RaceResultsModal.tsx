import React, { useState, useMemo, useEffect } from 'react';
import { Boat, CourseMark, RaceClassDefinition, RaceState, CompletedRace, SeriesStanding, CompetitorImportRecord } from '../types/regatta';
import {
  Trophy,
  Medal,
  Download,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Gauge,
  Filter,
  FileText,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Flag,
  RotateCcw,
  Plus,
  Award,
  Timer,
  Navigation,
  Compass,
  Zap,
  Info,
  Calendar,
  Save,
  Trash2,
  FolderPlus,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  FileCode,
  Check,
  Users,
} from 'lucide-react';
import { formatTime, safeFixed } from '../utils/formatters';
import {
  calculateSeriesStandings,
  buildRaceSnapshotFromBoats,
  exportToWorldSailingXml,
  exportToSailwaveCsv,
  parseCompetitorRoster,
} from '../services/scoringService';

interface RaceResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  boats: Boat[];
  raceState: RaceState;
  raceClasses?: RaceClassDefinition[];
  courseMarks?: CourseMark[];
  seriesRaces?: CompletedRace[];
  onUpdateBoatStatus?: (boatId: string, status: Boat['status']) => void;
  onSaveRaceToSeries?: (race: CompletedRace) => void;
  onDeleteRaceFromSeries?: (raceId: string) => void;
  onResetForNextRace?: (nextRaceNumber: number) => void;
  onClearSeries?: () => void;
  onNewSeries?: (resetFleet: boolean) => void;
  onRestoreSampleSeries?: () => void;
  onImportCompetitors?: (competitors: CompetitorImportRecord[]) => void;
  viewMode?: 'RC_CONSOLE' | 'SPECTATOR';
}

export const RaceResultsModal: React.FC<RaceResultsModalProps> = ({
  isOpen,
  onClose,
  boats,
  raceState,
  raceClasses = [],
  courseMarks = [],
  seriesRaces = [],
  onUpdateBoatStatus,
  onSaveRaceToSeries,
  onDeleteRaceFromSeries,
  onResetForNextRace,
  onClearSeries,
  onNewSeries,
  onRestoreSampleSeries,
  onImportCompetitors,
  viewMode: appViewMode = 'RC_CONSOLE',
}) => {
  // Navigation: 'SERIES' (Overall Series Standings) or specific race ID ('live-race', 'race-1', 'race-2', etc.)
  const [activeTab, setActiveTab] = useState<string>('SERIES');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [showClassFilter, setShowClassFilter] = useState<boolean>(false);
  const [scoringSystem, setScoringSystem] = useState<'HANDICAP' | 'SCRATCH'>('HANDICAP');
  const [viewMode, setViewMode] = useState<'COMPACT' | 'MARK_SPLITS'>('COMPACT');
  const [discardRule, setDiscardRule] = useState<'1_DISCARD_3_RACES' | '1_DISCARD_4_RACES' | 'ALWAYS_1_DISCARD' | 'NONE'>('1_DISCARD_3_RACES');
  
  // Set of boat IDs whose mark splits drawer is expanded in individual race view
  const [expandedBoatSplits, setExpandedBoatSplits] = useState<Set<string>>(new Set());

  // State for saving current race snapshot dialog
  const [customRaceTitle, setCustomRaceTitle] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // State for deleting a specific race confirmation dialog
  const [raceToDelete, setRaceToDelete] = useState<CompletedRace | null>(null);

  // State for Series Manager (Start new / clear series)
  const [showSeriesManagerDialog, setShowSeriesManagerDialog] = useState(false);
  const [resetFleetWithNewSeries, setResetFleetWithNewSeries] = useState(true);

  // Feedback toast message for race officer actions
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Ecosystem & Data Standards: Export menu & Roster Import dialog state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showRosterImportModal, setShowRosterImportModal] = useState(false);
  const [rosterInputText, setRosterInputText] = useState('');
  const [parsedRosterRecords, setParsedRosterRecords] = useState<CompetitorImportRecord[]>([]);
  const [rosterParseError, setRosterParseError] = useState<string | null>(null);
  const [isParsingRoster, setIsParsingRoster] = useState(false);

  // Filter races for the currently selected class
  const classSeriesRaces = React.useMemo(() => {
    if (selectedClass === 'ALL') {
      return seriesRaces;
    }
    return seriesRaces.filter(
      (r) =>
        r.raceClass === selectedClass ||
        (r.raceClass === 'ALL' && r.results.some((res) => res.class === selectedClass)) ||
        (!r.raceClass && r.results.some((res) => res.class === selectedClass))
    );
  }, [seriesRaces, selectedClass]);

  // Sorted descending (latest race first down to oldest: e.g. R2, R1)
  const classSeriesRacesDesc = React.useMemo(() => {
    return [...classSeriesRaces].sort((a, b) => b.raceNumber - a.raceNumber);
  }, [classSeriesRaces]);

  // Active race number calculation for the selected class (highest existing race number + 1)
  const highestRaceNum = classSeriesRaces.length > 0
    ? Math.max(...classSeriesRaces.map((r) => r.raceNumber || 0))
    : 0;
  const nextRaceNum = highestRaceNum + 1;

  // Auto-switch away from deleted or non-matching historical races
  useEffect(() => {
    if (activeTab !== 'SERIES' && activeTab !== 'live-race') {
      const exists = classSeriesRaces.some((r) => r.id === activeTab);
      if (!exists) {
        setActiveTab('SERIES');
      }
    }
  }, [selectedClass, classSeriesRaces, activeTab]);

  // Notify user if a race was removed remotely while modal is open
  const prevSeriesCountRef = React.useRef(seriesRaces.length);
  useEffect(() => {
    if (prevSeriesCountRef.current > seriesRaces.length) {
      showToast('A race was removed from the official series. Overall standings recalculated.');
    }
    prevSeriesCountRef.current = seriesRaces.length;
  }, [seriesRaces.length]);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Find currently viewed race
  const isViewingSeries = activeTab === 'SERIES';
  const isViewingLiveRace = activeTab === 'live-race';
  const selectedHistoricalRace = !isViewingSeries && !isViewingLiveRace
    ? seriesRaces.find((r) => r.id === activeTab)
    : null;

  // Toggle boat mark split expansion
  const toggleBoatSplit = (boatId: string) => {
    setExpandedBoatSplits((prev) => {
      const next = new Set(prev);
      if (next.has(boatId)) next.delete(boatId);
      else next.add(boatId);
      return next;
    });
  };

  // Expand all or collapse all mark splits
  const toggleAllSplits = (allBoatsList: any[]) => {
    if (expandedBoatSplits.size > 0) {
      setExpandedBoatSplits(new Set());
    } else {
      setExpandedBoatSplits(new Set(allBoatsList.map((b) => b.id || b.boatId)));
    }
  };

  // Current race boats filtered by selected class
  const liveFilteredBoats = React.useMemo(() => {
    const seen = new Set<string>();
    return boats
      .filter((b) => selectedClass === 'ALL' || b.class === selectedClass)
      .filter((b) => {
        if (!b || !b.id || seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      });
  }, [boats, selectedClass]);

  // Sort live boats for final results:
  // 1. Finished boats sorted by correctedSeconds (or elapsedSeconds if Scratch)
  // 2. Racing / On Course
  // 3. Penalties: OCS, DNF, DNS, DSQ
  const sortedLiveBoats = [...liveFilteredBoats].sort((a, b) => {
    const isFinA = a.status === 'FINISHED';
    const isFinB = b.status === 'FINISHED';

    if (isFinA && !isFinB) return -1;
    if (!isFinA && isFinB) return 1;

    if (isFinA && isFinB) {
      const timeA = scoringSystem === 'HANDICAP' ? a.correctedSeconds : a.elapsedSeconds;
      const timeB = scoringSystem === 'HANDICAP' ? b.correctedSeconds : b.elapsedSeconds;
      return timeA - timeB;
    }

    // Both not finished
    const aPenalty = ['OCS', 'DNF', 'DNS', 'DSQ'].includes(a.status);
    const bPenalty = ['OCS', 'DNF', 'DNS', 'DSQ'].includes(b.status);
    if (!aPenalty && bPenalty) return -1;
    if (aPenalty && !bPenalty) return 1;

    return (b.markRoundings?.length || 0) - (a.markRoundings?.length || 0);
  });

  // Calculate live race winner time
  const liveWinner = sortedLiveBoats[0];
  const liveWinnerTime = liveWinner
    ? scoringSystem === 'HANDICAP'
      ? liveWinner.correctedSeconds
      : liveWinner.elapsedSeconds
    : 0;

  // Active historical race results filtered by selected class
  const historicalResults = selectedHistoricalRace?.results?.filter(
    (r) => selectedClass === 'ALL' || r.class === selectedClass
  ) || [];

  const sortedHistoricalResults = [...historicalResults].sort((a, b) => {
    const isFinA = a.status === 'FINISHED';
    const isFinB = b.status === 'FINISHED';
    if (isFinA && !isFinB) return -1;
    if (!isFinA && isFinB) return 1;
    if (isFinA && isFinB) {
      const timeA = scoringSystem === 'HANDICAP' ? a.correctedSeconds : a.elapsedSeconds;
      const timeB = scoringSystem === 'HANDICAP' ? b.correctedSeconds : b.elapsedSeconds;
      return timeA - timeB;
    }
    return a.rank - b.rank;
  });

  const historicalWinner = sortedHistoricalResults[0];
  const historicalWinnerTime = historicalWinner
    ? scoringSystem === 'HANDICAP'
      ? historicalWinner.correctedSeconds
      : historicalWinner.elapsedSeconds
    : 0;

  // Calculate Overall Series Standings (Low Point System with discards)
  const seriesStandings: SeriesStanding[] = useMemo(() => {
    return calculateSeriesStandings(seriesRaces, boats, selectedClass, discardRule);
  }, [seriesRaces, boats, selectedClass, discardRule]);

  // Handle Save Current Race to Series
  const handleSaveCurrentRace = () => {
    // If the user leaves the input blank, leave it empty without forcing default text
    const title = customRaceTitle.trim();
    const snapshot = buildRaceSnapshotFromBoats(
      nextRaceNum,
      title,
      boats,
      selectedClass,
      raceState.windSpeedKt,
      raceState.windDirectionDeg
    );
    if (onSaveRaceToSeries) {
      onSaveRaceToSeries(snapshot);
    }
    setShowSaveDialog(false);
    setCustomRaceTitle('');
    setActiveTab(snapshot.id);
    showToast(`Saved Race ${nextRaceNum} for ${selectedClass} to Series!`);
  };

  // Handle Deleting a Specific Race
  const handleConfirmDeleteRace = () => {
    if (!raceToDelete) return;
    const delId = raceToDelete.id;
    const delNum = raceToDelete.raceNumber;
    if (onDeleteRaceFromSeries) {
      onDeleteRaceFromSeries(delId);
    }
    if (activeTab === delId) {
      setActiveTab('SERIES');
    }
    setRaceToDelete(null);
    showToast(`Race ${delNum} removed from series. Overall standings recalculated.`);
  };

  // Handle Start Fresh Series
  const handleConfirmStartNewSeries = () => {
    if (onNewSeries) {
      onNewSeries(resetFleetWithNewSeries);
    } else if (onClearSeries) {
      onClearSeries();
      if (resetFleetWithNewSeries && onResetForNextRace) {
        onResetForNextRace(1);
      }
    }
    setActiveTab('SERIES');
    setShowSeriesManagerDialog(false);
    showToast('Started fresh regatta series. Historical races cleared.');
  };

  // Handle Restore Demo Series
  const handleConfirmRestoreSampleSeries = () => {
    if (onRestoreSampleSeries) {
      onRestoreSampleSeries();
      setActiveTab('SERIES');
      setShowSeriesManagerDialog(false);
      showToast('Restored 3-Race Demo Championship Series.');
    }
  };

  // Helper to format RRS low point strings
  const getRrsPointsDisplay = (status: string, rank: number, totalFleet: number): string => {
    if (status === 'FINISHED') return safeFixed(rank, 1, '-');
    if (status === 'OCS') return `${totalFleet + 1}.0 (OCS)`;
    if (status === 'DNF') return `${totalFleet + 1}.0 (DNF)`;
    if (status === 'RET') return `${totalFleet + 1}.0 (RET)`;
    if (status === 'DNS') return `${totalFleet + 1}.0 (DNS)`;
    if (status === 'DSQ') return `${totalFleet + 2}.0 (DSQ)`;
    if (status === 'PRE_START') return 'Pre-Start';
    return '-';
  };

  // Export CSV based on current view (Series or Individual Race)
  const handleExportCsv = () => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = '';

    if (isViewingSeries) {
      // Series CSV
      headers = [
        'Series Rank',
        'Sail Number',
        'Boat Name',
        'Class',
        'Skipper',
        'Rating',
        ...seriesRaces.map((r) => `R${r.raceNumber} Pts`),
        'Total Gross Pts',
        'Nett Pts',
      ];

      rows = seriesStandings.map((s) => {
        const racePointsCols = s.raceScores.map((score) =>
          score.isDiscarded ? `"[${safeFixed(score.points, 1)}]"` : `"${safeFixed(score.points, 1)}"`
        );
        return [
          s.seriesRank.toString(),
          `"${s.sailNumber}"`,
          `"${s.boatName}"`,
          `"${s.class}"`,
          `"${s.skipper}"`,
          safeFixed(s.handicapRating, 3, '1.000'),
          ...racePointsCols,
          `"${safeFixed(s.totalPoints, 1)}"`,
          `"${safeFixed(s.nettPoints, 1)}"`,
        ];
      });

      filename = `Regatta_Series_Standings_${selectedClass}_${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      // Individual Race CSV (with Mark Splits)
      headers = [
        'Rank',
        'Sail Number',
        'Boat Name',
        'Class',
        'Skipper',
        'Status',
        'Elapsed Time',
        'Rating',
        'Corrected Time',
        'Delta',
        'RRS Points',
        'Mark Roundings Breakdown',
      ];

      const activeList = isViewingLiveRace ? sortedLiveBoats : sortedHistoricalResults;
      const curWinnerTime = isViewingLiveRace ? liveWinnerTime : historicalWinnerTime;

      rows = activeList.map((b: any, idx) => {
        const sail = b.sailNumber;
        const name = b.name || b.boatName;
        const cls = b.class;
        const skp = b.skipper;
        const stat = b.status;
        const el = formatTime(Math.round(b.elapsedSeconds || 0));
        const rat = safeFixed(b.handicapRating, 3, '1.000');
        const cor = formatTime(Math.round(b.correctedSeconds || 0));
        const activeTime = scoringSystem === 'HANDICAP' ? b.correctedSeconds : b.elapsedSeconds;
        const deltaSec = b.status === 'FINISHED' && idx > 0 ? activeTime - curWinnerTime : 0;
        const deltaStr = idx === 0 || b.status !== 'FINISHED' ? '-' : `+${formatTime(Math.round(deltaSec))}`;
        const pts = getRrsPointsDisplay(b.status, idx + 1, activeList.length);

        const roundingsStr = (b.markRoundings || [])
          .map((m: any) => `${m.markName}: ${formatTime(m.elapsedAtSec || 0)} (split +${formatTime(m.legDurationSec || 0)}, ${m.legSpeedKt || 0}kt)`)
          .join(' | ');

        return [
          (b.status === 'FINISHED' ? idx + 1 : b.status).toString(),
          `"${sail}"`,
          `"${name}"`,
          `"${cls}"`,
          `"${skp}"`,
          stat,
          `"${el}"`,
          rat,
          `"${cor}"`,
          `"${deltaStr}"`,
          `"${pts}"`,
          `"${roundingsStr}"`,
        ];
      });

      const raceLabel = isViewingLiveRace ? 'Live_Race' : `Race_${selectedHistoricalRace?.raceNumber || 1}`;
      filename = `Official_${raceLabel}_Results_${selectedClass}_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
    showToast(`Downloaded ${filename}`);
  };

  // Export World Sailing XML
  const handleExportWorldSailing = () => {
    const validRaces = seriesRaces.filter((r) => {
      if (!r.results || r.results.length === 0) return false;
      if (selectedClass === 'ALL') return true;
      return r.raceClass === selectedClass || r.results.some((res) => res.class === selectedClass);
    });

    const xmlContent = exportToWorldSailingXml(
      'TMTRAC Regatta Championship',
      selectedClass,
      seriesStandings,
      validRaces
    );

    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `WorldSailing_Results_${selectedClass}_${new Date().toISOString().slice(0, 10)}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    showToast(`Exported World Sailing XML (${selectedClass})`);
  };

  // Export Sailwave-formatted CSV
  const handleExportSailwave = () => {
    const validRaces = seriesRaces.filter((r) => {
      if (!r.results || r.results.length === 0) return false;
      if (selectedClass === 'ALL') return true;
      return r.raceClass === selectedClass || r.results.some((res) => res.class === selectedClass);
    });

    const sailwaveContent = exportToSailwaveCsv(
      'TMTRAC Regatta Series',
      selectedClass,
      seriesStandings,
      validRaces
    );

    const blob = new Blob([sailwaveContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Sailwave_Series_${selectedClass}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    showToast(`Exported Sailwave CSV (${selectedClass})`);
  };

  // Parse Competitor Roster Text or File
  const handleParseRoster = (text: string) => {
    setIsParsingRoster(true);
    setRosterParseError(null);
    const res = parseCompetitorRoster(text);
    if (res.success && res.records.length > 0) {
      setParsedRosterRecords(res.records);
      setRosterParseError(null);
    } else {
      setParsedRosterRecords([]);
      setRosterParseError(res.error || 'No valid competitor records found. Check format.');
    }
    setIsParsingRoster(false);
  };

  // Confirm Import of Competitors into active fleet
  const handleConfirmRosterImport = () => {
    if (parsedRosterRecords.length === 0) return;
    if (onImportCompetitors) {
      onImportCompetitors(parsedRosterRecords);
      showToast(`Successfully imported ${parsedRosterRecords.length} competitors into the fleet`);
      setShowRosterImportModal(false);
      setRosterInputText('');
      setParsedRosterRecords([]);
    }
  };

  // Sample CSV template loader
  const handleLoadSampleRoster = () => {
    const sample = `BoatName,SailNo,Skipper,Class,Rating,Club
Ocean Spirit,MAS 101,Azlan Shah,Class 1,1.025,Royal Langkawi Yacht Club
Veloce,SIN 44,Marcus Tan,Class 1,1.010,Changi Sailing Club
Black Baccara,MAS 33,Haris Lee,Class 3,0.920,Royal Selangor Yacht Club
Nirvana,MAS 701,S. Pillai,Class 2,1.050,Penang Port Yacht Club
Tioman Breeze,MAS 88,Farid Zakaria,Class 2,0.985,Tioman Sailing Centre
Wave Runner,MAS 12,Ahmad Kamil,Class 3,0.940,Port Dickson Yacht Club`;
    setRosterInputText(sample);
    handleParseRoster(sample);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-5 landscape:p-1.5 bg-lb-black/75 backdrop-blur-xs animate-in fade-in duration-200 select-none font-google overflow-y-auto">
      <div className="bg-lb-0a0f1e/95 backdrop-blur-md border border-ll-334155/80 rounded-2xl sm:rounded-3xl w-full max-w-6xl max-h-[calc(100dvh-16px)] sm:max-h-[90vh] landscape:max-h-[98dvh] landscape:h-[98dvh] flex flex-col shadow-2xl overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain touch-pan-y text-lt-e2e8f0 relative my-auto">
        
        {/* Floating Feedback Toast */}
        {feedbackToast && (
          <div className="absolute top-4 right-14 z-50 bg-lb-00d4ff text-lt-black px-3.5 py-1.5 rounded-xl font-mono font-bold text-xs shadow-xl flex items-center gap-2 border border-ll-cyan-300 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-ll-1e293b bg-lb-060b16/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-lb-ffb800/15 border border-ll-ffb800/40 flex items-center justify-center text-lt-ffb800 shadow-sm shrink-0 mt-0.5 sm:mt-0">
              <Trophy className="w-5 h-5 font-bold" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-lt-white tracking-tight break-words leading-snug">
                  Official Scoring & Mark Timing
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-lb-00ff9d/15 text-lt-00ff9d border border-ll-00ff9d/30 shrink-0">
                  RRS APPENDIX A • MULTI-RACE SERIES
                </span>
              </div>
              <p className="text-xs sm:text-xs text-lt-94a3b8 font-mono mt-1 break-words leading-relaxed whitespace-normal">
                Low Point Scoring System • Mark Rounding Splits • Class Aggregates ({classSeriesRaces.length} Completed {selectedClass === 'ALL' ? 'Races' : `${selectedClass} Races`})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Class Filter Toggle (Hide / Unhide for more vertical viewing space) */}
            <button
              onClick={() => setShowClassFilter((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 border transition-all ${
                !showClassFilter
                  ? 'bg-lb-00d4ff/20 text-lt-00d4ff border-ll-00d4ff/40 shadow-sm'
                  : 'bg-lb-1e293b hover:bg-lb-334155 text-lt-94a3b8 hover:text-lt-white border-ll-334155'
              }`}
              title={showClassFilter ? 'Hide class filter & scoring controls for extra vertical viewing space' : 'Show class filter & scoring controls'}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{showClassFilter ? 'Hide Filters' : 'Show Filters'}</span>
              {showClassFilter ? (
                <ChevronUp className="w-3.5 h-3.5 text-lt-94a3b8" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-lt-00d4ff" />
              )}
            </button>

            {/* Prep Next Race Button (Cleanly Positioned in Top Actions) */}
            {appViewMode !== 'SPECTATOR' && onResetForNextRace && (
              <button
                onClick={() => {
                  onResetForNextRace(nextRaceNum);
                  showToast(`Fleet reset and prepared for Race ${nextRaceNum}`);
                }}
                className="px-3 py-1.5 rounded-xl bg-lb-amber-500/15 hover:bg-lb-amber-500/25 text-lt-ffb800 text-xs font-mono font-bold flex items-center gap-1.5 border border-ll-ffb800/40 transition-all shadow-sm"
                title={`Reset course timers & prepare fleet for Race ${nextRaceNum} (${selectedClass})`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prep Next Race (R{nextRaceNum})</span>
                <span className="sm:hidden">Prep R{nextRaceNum}</span>
              </button>
            )}

            {/* Save Current Race to Series */}
            {appViewMode !== 'SPECTATOR' && onSaveRaceToSeries && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="px-3 py-1.5 rounded-xl bg-lb-00d4ff/15 hover:bg-lb-00d4ff/25 text-lt-00d4ff text-xs font-mono font-bold flex items-center gap-1.5 border border-ll-00d4ff/40 transition-all shadow-sm"
                title={`Save current live race positions & mark roundings to ${selectedClass} series`}
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save Live to Series</span>
                <span className="sm:hidden">Save</span>
              </button>
            )}

            {/* Series Options (Manage Series / Start New) */}
            {appViewMode !== 'SPECTATOR' && (
              <button
                onClick={() => setShowSeriesManagerDialog(true)}
                className="px-3 py-1.5 rounded-xl bg-lb-1e293b hover:bg-lb-334155 text-lt-white text-xs font-mono font-bold flex items-center gap-1.5 border border-ll-334155 transition-all"
                title="Series Management: Start a new regatta series or manage individual races"
              >
                <FolderPlus className="w-3.5 h-3.5 text-lt-00ff9d" />
                <span className="hidden md:inline">Series Options</span>
              </button>
            )}

            {/* Import Competitor Roster (Sailwave / CSV / JSON) */}
            {appViewMode !== 'SPECTATOR' && (
              <button
                onClick={() => setShowRosterImportModal(true)}
                className="px-3 py-1.5 rounded-xl bg-lb-purple-500/15 hover:bg-lb-purple-500/25 text-lt-c084fc text-xs font-mono font-bold flex items-center gap-1.5 border border-ll-c084fc/40 transition-all shadow-sm"
                title="Import competitor roster from Sailwave, World Sailing, or CSV"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Import Roster</span>
                <span className="md:hidden">Import</span>
              </button>
            )}

            {/* Ecosystem Export Menu (World Sailing XML, Sailwave, Standard CSV) */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-lb-1e293b hover:bg-lb-334155 text-lt-white text-xs font-mono font-bold flex items-center gap-1.5 border border-ll-334155 transition-all shadow-sm"
                title="Export results in World Sailing XML, Sailwave CSV, or standard CSV format"
              >
                <Download className="w-3.5 h-3.5 text-lt-00d4ff" />
                <span className="hidden md:inline">Export</span>
                <ChevronDown className="w-3 h-3 text-lt-94a3b8" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1.5 w-64 bg-lb-0a0f1e border border-ll-334155 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 border-b border-ll-1e293b text-xs font-mono text-lt-64748b uppercase tracking-wider">
                    Ecosystem Export Formats
                  </div>
                  <button
                    onClick={handleExportWorldSailing}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-mono text-lt-white hover:bg-lb-1e293b flex items-center gap-2.5 transition-colors"
                  >
                    <FileCode className="w-4 h-4 text-lt-00ff9d shrink-0" />
                    <div>
                      <div className="font-bold">World Sailing XML</div>
                      <div className="text-xs text-lt-94a3b8">International standard exchange format</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportSailwave}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-mono text-lt-white hover:bg-lb-1e293b flex items-center gap-2.5 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-lt-00d4ff shrink-0" />
                    <div>
                      <div className="font-bold">Sailwave CSV</div>
                      <div className="text-xs text-lt-94a3b8">Direct import into Sailwave software</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportCsv}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-mono text-lt-white hover:bg-lb-1e293b flex items-center gap-2.5 transition-colors"
                  >
                    <Download className="w-4 h-4 text-lt-ffb800 shrink-0" />
                    <div>
                      <div className="font-bold">Standard Regatta CSV</div>
                      <div className="text-xs text-lt-94a3b8">Includes splits & timing audit breakdown</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Print Official Notice */}
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl bg-lb-1e293b hover:bg-lb-334155 text-lt-white text-xs font-mono font-bold flex items-center gap-1.5 border border-ll-334155 transition-all"
              title="Print official notice board summary"
            >
              <Printer className="w-3.5 h-3.5 text-lt-a78bfa" />
              <span className="hidden md:inline">Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-lt-94a3b8 hover:text-lt-white hover:bg-lb-1e293b transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. Filter & Configuration Bar (Positioned AT THE TOP OF RACE SERIES, Collapsible) */}
        {showClassFilter ? (
          <div className="px-3 sm:px-5 py-2.5 border-b border-ll-1e293b bg-lb-0a0f1e/80 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150 shrink-0">
            {/* Class Filters: Mobile Dropdown View vs Desktop Button Pills */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-full">
              {/* MOBILE DROPDOWN LIST (<select>) */}
              <div className="flex sm:hidden items-center gap-2 w-full">
                <span className="text-xs font-mono text-lt-64748b flex items-center gap-1 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-lt-00d4ff" /> Class:
                </span>
                <div className="relative flex-1">
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full bg-lb-0e172a border border-ll-00d4ff/40 text-lt-00d4ff font-mono text-xs font-bold rounded-xl px-3 py-1.5 appearance-none focus:outline-none focus:ring-1 focus:ring-ll-00d4ff pr-8 shadow-sm cursor-pointer"
                  >
                    <option value="ALL" className="bg-lb-0a0f1e text-lt-white">
                      ALL CLASSES ({boats.length} Boats)
                    </option>
                    {raceClasses.map((cls) => {
                      const count = boats.filter((b) => b.class === cls.name).length;
                      return (
                        <option key={cls.id} value={cls.name} className="bg-lb-0a0f1e text-lt-white">
                          {cls.name} ({count} {count === 1 ? 'boat' : 'boats'})
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 text-lt-00d4ff absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* DESKTOP BUTTON PILLS (Hidden on Mobile) */}
              <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-mono text-lt-64748b mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Class:
                </span>
                <button
                  onClick={() => setSelectedClass('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                    selectedClass === 'ALL'
                      ? 'bg-lb-00d4ff text-lt-black font-bold shadow-sm'
                      : 'bg-lb-1e293b/70 text-lt-94a3b8 hover:text-lt-white'
                  }`}
                >
                  ALL ({boats.length})
                </button>
                {raceClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClass(cls.name)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                      selectedClass === cls.name
                        ? 'bg-lb-00d4ff text-lt-black font-bold shadow-sm'
                        : 'bg-lb-1e293b/70 text-lt-94a3b8 hover:text-lt-white'
                    }`}
                  >
                    {cls.name} ({boats.filter((b) => b.class === cls.name).length})
                  </button>
                ))}
              </div>
            </div>

            {/* Right Control Toggles */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* View Mode (Compact vs Mark Splits) Toggle Switch */}
              {!isViewingSeries && (
                <div className="flex items-center bg-lb-070d1b border border-ll-1e293b p-1 rounded-xl shadow-inner">
                  <button
                    onClick={() => setViewMode('COMPACT')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all duration-150 ${
                      viewMode === 'COMPACT'
                        ? 'bg-lb-1e293b text-lt-white shadow-sm border border-ll-334155'
                        : 'text-lt-64748b hover:text-lt-94a3b8'
                    }`}
                    title="Compact view"
                  >
                    Compact
                  </button>
                  <button
                    onClick={() => setViewMode('MARK_SPLITS')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all duration-150 flex items-center gap-1.5 ${
                      viewMode === 'MARK_SPLITS'
                        ? 'bg-lb-00d4ff text-lt-black shadow-sm border border-ll-00d4ff'
                        : 'text-lt-64748b hover:text-lt-94a3b8'
                    }`}
                    title="Mark Splits view"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Mark Splits</span>
                  </button>
                </div>
              )}

              {/* Discard Rule Selector for Series View */}
              {isViewingSeries && (
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-lt-64748b hidden sm:inline">Discards:</span>
                  <select
                    value={discardRule}
                    onChange={(e) => setDiscardRule(e.target.value as any)}
                    className="bg-lb-0e172a border border-ll-1e293b text-xs text-lt-00d4ff font-mono rounded-lg px-2 py-1 focus:outline-none focus:border-ll-00d4ff"
                  >
                    <option value="1_DISCARD_3_RACES">1 Discard (3+ Races - RRS A2)</option>
                    <option value="1_DISCARD_4_RACES">1 Discard (4+ Races)</option>
                    <option value="ALWAYS_1_DISCARD">Always Drop 1 Worst Race</option>
                    <option value="NONE">No Discards (All Races Count)</option>
                  </select>
                </div>
              )}

              {/* Scoring Mode Toggle (Corrected IRC/PY vs Scratch) */}
              <div className="flex items-center bg-lb-070d1b border border-ll-1e293b p-1 rounded-xl shadow-inner">
                <button
                  onClick={() => setScoringSystem('HANDICAP')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all duration-150 ${
                    scoringSystem === 'HANDICAP'
                      ? 'bg-lb-1a73e8 text-lt-white shadow-sm border border-ll-1a73e8'
                      : 'text-lt-64748b hover:text-lt-94a3b8'
                  }`}
                >
                  IRC/PY Corrected
                </button>
                <button
                  onClick={() => setScoringSystem('SCRATCH')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all duration-150 ${
                    scoringSystem === 'SCRATCH'
                      ? 'bg-lb-1a73e8 text-lt-white shadow-sm border border-ll-1a73e8'
                      : 'text-lt-64748b hover:text-lt-94a3b8'
                  }`}
                >
                  Scratch
                </button>
              </div>

              {/* Quick Hide Button */}
              <button
                onClick={() => setShowClassFilter(false)}
                className="p-1 px-2 text-xs font-mono text-lt-64748b hover:text-lt-white hover:bg-lb-1e293b rounded-lg transition-colors flex items-center gap-1"
                title="Hide Class Filter bar"
              >
                <span>Hide</span>
                <ChevronUp className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          /* Collapsed Filter Indicator Banner (Saves generous vertical space on mobile) */
          <div className="px-3 sm:px-5 py-1.5 border-b border-ll-1e293b/70 bg-lb-0a0f1e/60 flex items-center justify-between gap-2 text-xs font-mono text-lt-94a3b8 animate-in fade-in duration-150 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <span className="text-lt-64748b flex items-center gap-1">
                <Filter className="w-3 h-3 text-lt-00d4ff" /> Filter:
              </span>
              <span className="px-2 py-0.5 rounded bg-lb-00d4ff/15 text-lt-00d4ff font-bold">
                {selectedClass === 'ALL' ? 'All Classes' : selectedClass}
              </span>
              <span className="px-2 py-0.5 rounded bg-lb-1e293b text-lt-cbd5e1">
                {scoringSystem === 'HANDICAP' ? 'IRC/PY' : 'Scratch'}
              </span>
              {isViewingSeries && (
                <span className="hidden sm:inline text-lt-64748b">
                  ({discardRule === 'NONE' ? 'No Discards' : '1 Discard'})
                </span>
              )}
            </div>
            <button
              onClick={() => setShowClassFilter(true)}
              className="px-2.5 py-1 rounded-lg bg-lb-00d4ff/10 hover:bg-lb-00d4ff/20 text-lt-00d4ff text-xs font-bold border border-ll-00d4ff/30 transition-all flex items-center gap-1 shrink-0"
            >
              <span>Unhide Filters</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* 2. Series & Individual Race Selector (Dropdown on portrait mobile, Slideable Tab Bar on Landscape Mobile & Desktop) */}
        <div className="px-2 sm:px-5 py-2 sm:py-2.5 border-y border-ll-334155 bg-lb-0b1426 shadow-md sticky top-0 z-20 shrink-0 w-full max-w-full overflow-x-clip overflow-y-visible">
          
          {/* MOBILE PORTRAIT VIEW: Compact Dropdown with Delete button on side */}
          <div className="flex sm:hidden landscape:hidden items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 shrink-0 text-xs font-mono text-lt-94a3b8">
              <Layers className="w-3.5 h-3.5 text-lt-00d4ff" />
              <span className="font-bold text-lt-white uppercase text-xs">Race:</span>
            </div>
            
            <div className="relative flex-1 min-w-0">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full bg-lb-0e172a border border-ll-3b82f6/50 text-lt-white font-mono text-xs font-bold rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-1 focus:ring-ll-00d4ff pr-8 shadow-sm cursor-pointer"
              >
                <option value="SERIES" className="bg-lb-0a0f1e text-lt-amber-400 font-bold">
                  🏆 Overall Series Standings ({classSeriesRaces.length} R)
                </option>
                <option value="live-race" className="bg-lb-0a0f1e text-lt-00ff9d font-bold">
                  🟢 Live Race ({selectedClass})
                </option>
                {classSeriesRacesDesc.map((race) => (
                  <option key={race.id} value={race.id} className="bg-lb-0a0f1e text-lt-00d4ff">
                    🏁 Race {race.raceNumber} ({race.results?.length || 0} finishers)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-lt-00d4ff absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Individual Delete Button on side when historical race is selected in dropdown */}
            {selectedHistoricalRace && onDeleteRaceFromSeries && (
              <button
                onClick={() => setRaceToDelete(selectedHistoricalRace)}
                className="px-2.5 py-2 rounded-xl bg-lb-red-500/20 hover:bg-lb-red-500/35 text-lt-red-400 border border-ll-red-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-sm"
                title={`Delete Race ${selectedHistoricalRace.raceNumber} from Series`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Del R{selectedHistoricalRace.raceNumber}</span>
              </button>
            )}
          </div>

          {/* HORIZONTAL MOBILE & DESKTOP VIEW: Smoothly Scrollable/Slideable Horizontal Tab Bar */}
          <div className="hidden sm:flex landscape:flex items-center gap-2 sm:gap-2.5 flex-nowrap w-full max-w-full overflow-x-auto custom-scrollbar touch-pan-x overscroll-x-contain py-1 select-none scroll-smooth">
            {/* Context Label for Instant Clarity */}
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-lb-060b16 border border-ll-1e293b text-xs font-mono text-lt-94a3b8 shrink-0 whitespace-nowrap">
              <Layers className="w-3.5 h-3.5 text-lt-00d4ff" />
              <span className="font-bold text-lt-white uppercase tracking-wider">Race View:</span>
            </div>

            {/* Overall Series Tab */}
            <button
              onClick={() => setActiveTab('SERIES')}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 sm:gap-2 transition-all shrink-0 border whitespace-nowrap ${
                activeTab === 'SERIES'
                  ? 'bg-gradient-to-r from-lb-ffb800 to-lb-ff8800 text-lt-black border-ll-ffb800 shadow-lg shadow-ll-amber-500/25 ring-1 ring-ll-amber-300/40 scale-102'
                  : 'bg-lb-121d33 text-lt-cbd5e1 border-ll-1e293b hover:text-lt-white hover:bg-lb-1e293b hover:border-ll-334155'
              }`}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>Overall Series Standings</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${activeTab === 'SERIES' ? 'bg-lb-black/25 text-lt-black' : 'bg-lb-060b16 text-lt-ffb800 border border-ll-ffb800/30'}`}>
                {classSeriesRaces.length} R
              </span>
            </button>

            {/* Live Race Tab (Leftmost race tab) */}
            <button
              onClick={() => setActiveTab('live-race')}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 sm:gap-2 transition-all shrink-0 border whitespace-nowrap ${
                activeTab === 'live-race'
                  ? 'bg-lb-00ff9d text-lt-black border-ll-00ff9d shadow-lg shadow-ll-emerald-500/25 ring-1 ring-ll-emerald-300/40 scale-102'
                  : 'bg-lb-121d33 text-lt-00ff9d border-ll-1e293b hover:bg-lb-1e293b hover:border-ll-00ff9d/40'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-lb-00ff9d animate-ping mr-0.5 shrink-0" />
              <span>Live Race ({selectedClass})</span>
            </button>

            {/* Completed Class Historical Races Tabs (from latest to oldest, left to right) */}
            {classSeriesRacesDesc.map((race) => (
              <div
                key={race.id}
                className={`group relative flex items-center rounded-xl transition-all shrink-0 border whitespace-nowrap ${
                  activeTab === race.id
                    ? 'bg-lb-1a73e8 text-lt-white border-ll-3b82f6 shadow-lg shadow-ll-blue-500/25 ring-1 ring-ll-blue-300/40 scale-102'
                    : 'bg-lb-121d33 text-lt-cbd5e1 border-ll-1e293b hover:text-lt-white hover:bg-lb-1e293b hover:border-ll-334155'
                }`}
              >
                <button
                  onClick={() => setActiveTab(race.id)}
                  className="px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-mono font-bold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Flag className="w-3.5 h-3.5 text-lt-00d4ff shrink-0" />
                  <span>Race {race.raceNumber}</span>
                  <span className={`text-xs px-1.5 py-0.2 rounded-md shrink-0 ${activeTab === race.id ? 'bg-lb-white/20 text-lt-white font-bold' : 'bg-lb-060b16 text-lt-00ff9d'}`}>
                    {race.results?.length || 0}
                  </span>
                </button>
                {onDeleteRaceFromSeries && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRaceToDelete(race);
                    }}
                    className={`p-1 mr-1.5 rounded-md text-lt-red-400 hover:text-lt-white hover:bg-lb-red-600/60 transition-all shrink-0 ${
                      activeTab === race.id ? 'opacity-90' : 'sm:opacity-0 sm:group-hover:opacity-100 opacity-80'
                    }`}
                    title={`Delete Race ${race.raceNumber} from ${race.raceClass || selectedClass} Series`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Modal Main Content Body (Flows seamlessly with outer unified scroll) */}
        <div className="p-3 sm:p-5 space-y-4">
          
          {/* ========================================================= */}
          {/* VIEW 1: OVERALL SERIES STANDINGS (ALL RACES BY CLASS) */}
          {/* ========================================================= */}
          {isViewingSeries && (
            <div className="space-y-4">
              
              {/* If no completed series races yet, display friendly instructions */}
              {seriesRaces.length === 0 ? (
                <div className="bg-lb-0a0f1e border border-ll-1e293b rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
                  <div className="w-14 h-14 rounded-2xl bg-lb-ffb800/15 border border-ll-ffb800/30 text-lt-ffb800 flex items-center justify-center mx-auto shadow-lg">
                    <Trophy className="w-7 h-7" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1.5">
                    <h3 className="text-base font-bold text-lt-white font-mono">
                      No Series Races Recorded Yet
                    </h3>
                    <p className="text-xs text-lt-94a3b8 font-mono leading-relaxed">
                      Run races on the water and click <strong>"Save Live to Series"</strong> (or <strong>"Prep Next Race"</strong>) to build your official multi-race regatta leaderboard with automated Low Point calculations and mark splits.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                    <button
                      onClick={() => setActiveTab('live-race')}
                      className="px-4 py-2 rounded-xl bg-lb-00ff9d text-lt-black font-mono font-bold text-xs hover:bg-lb-34d399 transition-all shadow-md shadow-ll-emerald-500/20 flex items-center gap-2"
                    >
                      <Flag className="w-4 h-4" />
                      <span>View Live Active Race</span>
                    </button>
                    {onSaveRaceToSeries && (
                      <button
                        onClick={() => setShowSaveDialog(true)}
                        className="px-4 py-2 rounded-xl bg-lb-00d4ff/20 hover:bg-lb-00d4ff/30 text-lt-00d4ff font-mono font-bold text-xs border border-ll-00d4ff/40 transition-all flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save Current Fleet as Race 1</span>
                      </button>
                    )}
                    {onRestoreSampleSeries && (
                      <button
                        onClick={handleConfirmRestoreSampleSeries}
                        className="px-3.5 py-2 rounded-xl bg-lb-1e293b hover:bg-lb-334155 text-lt-white font-mono text-xs border border-ll-334155 transition-all flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-lt-a78bfa" />
                        <span>Load 3-Race Demo Series</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Series Trophy Podium Highlights (Top 3) */}
                  {seriesStandings.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* 1st Place Series Winner */}
                      {seriesStandings[0] && (
                        <div className="bg-gradient-to-br from-lb-ffb800/20 to-lb-ff8800/5 border border-ll-ffb800/50 rounded-xl p-3.5 flex items-center gap-3 relative overflow-hidden shadow-lg">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-lb-ffd700 to-lb-ff9900 text-lt-black font-bold font-mono text-base flex items-center justify-center shadow-lg shadow-ll-amber-500/30 shrink-0">
                            1st
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-mono text-lt-ffb800 font-bold uppercase tracking-wider flex items-center gap-1">
                              <Trophy className="w-3 h-3" /> SERIES WINNER • {seriesStandings[0].nettPoints} NETT PTS
                            </div>
                            <div className="font-bold text-lt-white truncate text-sm">
                              {seriesStandings[0].boatName}
                            </div>
                            <div className="text-xs text-lt-94a3b8 font-mono">
                              {seriesStandings[0].sailNumber} • {seriesStandings[0].skipper} ({seriesStandings[0].class})
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2nd Place Runner Up */}
                      {seriesStandings[1] && (
                        <div className="bg-gradient-to-br from-lb-cbd5e1/15 to-lb-slate-800/10 border border-ll-cbd5e1/40 rounded-xl p-3.5 flex items-center gap-3 relative overflow-hidden shadow-md">
                          <div className="w-10 h-10 rounded-full bg-lb-cbd5e1 text-lt-black font-bold font-mono text-sm flex items-center justify-center shadow-md shrink-0">
                            2nd
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-mono text-lt-cbd5e1 font-bold uppercase tracking-wider">
                              2ND OVERALL • {seriesStandings[1].nettPoints} NETT PTS
                            </div>
                            <div className="font-bold text-lt-white truncate text-sm">
                              {seriesStandings[1].boatName}
                            </div>
                            <div className="text-xs text-lt-94a3b8 font-mono">
                              {seriesStandings[1].sailNumber} • {seriesStandings[1].skipper} ({seriesStandings[1].class})
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3rd Place Bronze */}
                      {seriesStandings[2] && (
                        <div className="bg-gradient-to-br from-lb-cd7f32/15 to-lb-amber-950/10 border border-ll-cd7f32/40 rounded-xl p-3.5 flex items-center gap-3 relative overflow-hidden shadow-md">
                          <div className="w-10 h-10 rounded-full bg-lb-cd7f32 text-lt-black font-bold font-mono text-sm flex items-center justify-center shadow-md shrink-0">
                            3rd
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-mono text-lt-cd7f32 font-bold uppercase tracking-wider">
                              3RD OVERALL • {seriesStandings[2].nettPoints} NETT PTS
                            </div>
                            <div className="font-bold text-lt-white truncate text-sm">
                              {seriesStandings[2].boatName}
                            </div>
                            <div className="text-xs text-lt-94a3b8 font-mono">
                              {seriesStandings[2].sailNumber} • {seriesStandings[2].skipper} ({seriesStandings[2].class})
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Overall Series Table */}
                  <div className="bg-lb-0a0f1e border border-ll-1e293b rounded-xl overflow-hidden shadow-xl">
                    <div className="px-4 py-3 border-b border-ll-1e293b flex flex-wrap items-center justify-between gap-2 bg-lb-0e172a">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-lt-ffb800" />
                        <span className="text-xs font-mono font-bold text-lt-white uppercase tracking-wider">
                          Official Series Leaderboard ({selectedClass} Class)
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs font-mono">
                        {discardRule !== 'NONE' && (
                          <span className="text-lt-00ff9d hidden md:inline">
                            *Values in (brackets) indicate discarded scores
                          </span>
                        )}
                        {appViewMode !== 'SPECTATOR' && (
                          <button
                            onClick={() => setShowSeriesManagerDialog(true)}
                            className="text-lt-94a3b8 hover:text-lt-ffb800 flex items-center gap-1 transition-colors"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Series Options ({classSeriesRaces.length} Races)</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead>
                          <tr className="border-b border-ll-1e293b text-lt-64748b text-xs uppercase tracking-wider bg-lb-060b16">
                            <th className="py-3 pl-3">Rank</th>
                            <th className="py-3">Sail / Boat</th>
                            <th className="py-3">Class</th>
                            <th className="py-3">Skipper</th>
                            <th className="py-3 text-right">Rating</th>
                            {classSeriesRaces.map((r) => (
                              <th key={r.id} className="py-3 text-center px-2">
                                <span className="hover:text-lt-00d4ff cursor-pointer" onClick={() => setActiveTab(r.id)}>
                                  R{r.raceNumber}
                                </span>
                              </th>
                            ))}
                            <th className="py-3 text-right">Total Pts</th>
                            <th className="py-3 text-right pr-4 font-bold text-lt-ffb800">Nett Pts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ll-1e293b/60">
                          {seriesStandings.map((standing, idx) => {
                            const isLeader = standing.seriesRank === 1;

                            return (
                              <tr
                                key={standing.boatId}
                                className={`hover:bg-lb-1e293b/40 transition-colors ${
                                  isLeader ? 'bg-lb-ffb800/5 font-semibold text-lt-white' : 'text-lt-cbd5e1'
                                }`}
                              >
                                <td className="py-3 pl-3">
                                  <span
                                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                      idx === 0
                                        ? 'bg-lb-ffb800 text-lt-black shadow-md shadow-ll-amber-500/20'
                                        : idx === 1
                                        ? 'bg-lb-cbd5e1 text-lt-black'
                                        : idx === 2
                                        ? 'bg-lb-cd7f32 text-lt-black'
                                        : 'bg-lb-1e293b text-lt-94a3b8'
                                    }`}
                                  >
                                    {standing.seriesRank}
                                  </span>
                                </td>

                                <td className="py-3">
                                  <div className="font-bold text-lt-white flex items-center gap-1.5">
                                    <span className="text-lt-00d4ff">{standing.sailNumber}</span>
                                    <span>{standing.boatName}</span>
                                  </div>
                                </td>

                                <td className="py-3">
                                  <span className="px-2 py-0.5 rounded bg-lb-1e293b text-lt-94a3b8 text-xs">
                                    {standing.class}
                                  </span>
                                </td>

                                <td className="py-3 text-lt-94a3b8">{standing.skipper}</td>

                                <td className="py-3 text-right text-lt-94a3b8">
                                  {safeFixed(standing.handicapRating, 3, '1.000')}
                                </td>

                                {/* Individual Race Score Columns */}
                                {standing.raceScores.map((score, sIdx) => (
                                  <td key={sIdx} className="py-3 text-center px-2">
                                    {score.isDiscarded ? (
                                      <span
                                        className="px-1.5 py-0.5 rounded bg-lb-red-950/40 text-lt-red-400/70 line-through text-xs border border-ll-red-900/30"
                                        title="Discarded worst race"
                                      >
                                        ({safeFixed(score.points, 1)})
                                      </span>
                                    ) : (
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                                          score.rank === 1
                                            ? 'bg-lb-ffb800/20 text-lt-ffb800 border border-ll-ffb800/40'
                                            : 'bg-lb-1e293b text-lt-white'
                                        }`}
                                      >
                                        {safeFixed(score.points, 1)}
                                      </span>
                                    )}
                                  </td>
                                ))}

                                <td className="py-3 text-right text-lt-94a3b8">
                                  {safeFixed(standing.totalPoints, 1)}
                                </td>

                                <td className="py-3 text-right pr-4 font-bold text-base text-lt-00ff9d">
                                  {safeFixed(standing.nettPoints, 1)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 2: INDIVIDUAL RACE VIEW (LIVE OR HISTORICAL RACE) */}
          {/* ========================================================= */}
          {!isViewingSeries && (
            <div className="space-y-4">
              
              {/* Race Meta Details Banner */}
              <div className="p-3.5 bg-lb-0a0f1e border border-ll-1e293b rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-lb-1a73e8/20 border border-ll-1a73e8/40 flex items-center justify-center text-lt-00d4ff">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-lt-white font-mono">
                      {isViewingLiveRace
                        ? 'Active Fleet Telemetry & Live Mark Splits'
                        : selectedHistoricalRace?.raceTitle || `Race ${selectedHistoricalRace?.raceNumber} Results`}
                    </h3>
                    <p className="text-xs text-lt-94a3b8 font-mono">
                      Wind: {isViewingLiveRace ? raceState.windSpeedKt : selectedHistoricalRace?.windSpeedKt || 14} kt @ {isViewingLiveRace ? raceState.windDirectionDeg : selectedHistoricalRace?.windDirectionDeg || 210}° • Low Point System • {isViewingLiveRace ? liveFilteredBoats.length : sortedHistoricalResults.length} Competitors
                    </p>
                  </div>
                </div>
              </div>

              {/* Individual Race Standings & Mark Roundings Table */}
              <div className="bg-lb-0a0f1e border border-ll-1e293b rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-ll-1e293b text-lt-64748b text-xs uppercase tracking-wider bg-lb-060b16">
                        <th className="py-3 pl-3 w-8"></th>
                        <th className="py-3 pl-1">Rank</th>
                        <th className="py-3">Sail / Boat</th>
                        <th className="py-3">Class</th>
                        <th className="py-3">Skipper</th>
                        <th className="py-3">Status</th>
                        <th className="py-3 text-right">Elapsed</th>
                        <th className="py-3 text-right">Rating</th>
                        <th className="py-3 text-right">Corrected</th>
                        <th className="py-3 text-right">Delta</th>
                        <th className="py-3 text-right pr-3">RRS Pts</th>
                        {onUpdateBoatStatus && isViewingLiveRace && <th className="py-3 text-center pr-3">PRO Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ll-1e293b/60">
                      {(isViewingLiveRace ? sortedLiveBoats : sortedHistoricalResults).map((b: any, idx) => {
                        const boatId = b.id || b.boatId;
                        const boatName = b.name || b.boatName;
                        const sailNumber = b.sailNumber;
                        const boatClass = b.class;
                        const skipper = b.skipper;
                        const status = b.status;
                        const handicapRating = b.handicapRating || 1.0;
                        const elapsedSec = Math.round(b.elapsedSeconds || 0);
                        const correctedSec = Math.round(b.correctedSeconds || 0);
                        const markRoundings: any[] = b.markRoundings || [];

                        const isFinished = status === 'FINISHED';
                        const isWinner = idx === 0 && isFinished;
                        const curWinnerTime = isViewingLiveRace ? liveWinnerTime : historicalWinnerTime;
                        const activeTime = scoringSystem === 'HANDICAP' ? correctedSec : elapsedSec;
                        const deltaSec = isFinished && idx > 0 ? activeTime - curWinnerTime : 0;
                        const isExpanded = expandedBoatSplits.has(boatId);

                        return (
                          <React.Fragment key={boatId}>
                            <tr
                              className={`hover:bg-lb-1e293b/40 transition-colors ${
                                isWinner ? 'bg-lb-ffb800/5 font-semibold text-lt-white' : 'text-lt-cbd5e1'
                              }`}
                            >
                              {/* Expand/Collapse Toggle Button */}
                              <td className="py-3 pl-3">
                                <button
                                  onClick={() => toggleBoatSplit(boatId)}
                                  className="p-1 rounded hover:bg-lb-1e293b text-lt-00d4ff transition-colors"
                                  title="View detailed mark roundings & split times"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-lt-ffb800" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-lt-94a3b8" />
                                  )}
                                </button>
                              </td>

                              {/* Rank */}
                              <td className="py-3 pl-1">
                                {isFinished ? (
                                  <span
                                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                      idx === 0
                                        ? 'bg-lb-ffb800 text-lt-black shadow-md shadow-ll-amber-500/20'
                                        : idx === 1
                                        ? 'bg-lb-cbd5e1 text-lt-black'
                                        : idx === 2
                                        ? 'bg-lb-cd7f32 text-lt-black'
                                        : 'bg-lb-1e293b text-lt-94a3b8'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                ) : (
                                  <span className="text-lt-64748b pl-2">-</span>
                                )}
                              </td>

                              {/* Sail & Boat Name */}
                              <td className="py-3">
                                <div className="font-bold text-lt-white flex items-center gap-1.5">
                                  <span className="text-lt-00d4ff">{sailNumber}</span>
                                  <span>{boatName}</span>
                                </div>
                              </td>

                              {/* Class */}
                              <td className="py-3">
                                <span className="px-2 py-0.5 rounded bg-lb-1e293b text-lt-94a3b8 text-xs">
                                  {boatClass}
                                </span>
                              </td>

                              {/* Skipper */}
                              <td className="py-3 text-lt-94a3b8">{skipper}</td>

                              {/* Status Badge */}
                              <td className="py-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    status === 'FINISHED'
                                      ? 'bg-lb-00ff9d/20 text-lt-00ff9d border border-ll-00ff9d/40'
                                      : status === 'RACING'
                                      ? 'bg-lb-00d4ff/20 text-lt-00d4ff border border-ll-00d4ff/40 animate-pulse'
                                      : status === 'PRE_START'
                                      ? 'bg-lb-amber-500/20 text-lt-ffb800 border border-ll-amber-500/40'
                                      : 'bg-lb-red-500/20 text-lt-red-400 border border-ll-red-500/40'
                                  }`}
                                >
                                  {status}
                                </span>
                              </td>

                              {/* Elapsed Time */}
                              <td className="py-3 text-right text-lt-cbd5e1">
                                {status === 'FINISHED' ? formatTime(elapsedSec) : '-'}
                              </td>

                              {/* Handicap Rating */}
                              <td className="py-3 text-right text-lt-94a3b8">
                                {safeFixed(handicapRating, 3, '1.000')}
                              </td>

                              {/* Corrected Time */}
                              <td className="py-3 text-right font-bold text-lt-white">
                                {status === 'FINISHED' ? formatTime(correctedSec) : '-'}
                              </td>

                              {/* Delta from Winner */}
                              <td className="py-3 text-right text-lt-94a3b8">
                                {isFinished && idx > 0 ? (
                                  <span className="text-lt-amber-400/90 font-mono">
                                    +{formatTime(Math.round(deltaSec))}
                                  </span>
                                ) : isFinished && idx === 0 ? (
                                  <span className="text-lt-00ff9d font-bold">WINNER</span>
                                ) : (
                                  '-'
                                )}
                              </td>

                              {/* World Sailing Low Point Score */}
                              <td className="py-3 text-right pr-3 font-bold text-lt-00ff9d text-sm">
                                {getRrsPointsDisplay(
                                  status,
                                  idx + 1,
                                  isViewingLiveRace ? liveFilteredBoats.length : sortedHistoricalResults.length
                                )}
                              </td>

                              {/* PRO Status Override Action (Live Race Only) */}
                              {onUpdateBoatStatus && isViewingLiveRace && (
                                <td className="py-3 text-center pr-3">
                                  <select
                                    value={status}
                                    onChange={(e) => onUpdateBoatStatus(boatId, e.target.value as any)}
                                    className="bg-lb-0e172a border border-ll-1e293b text-xs text-lt-00d4ff rounded px-1.5 py-0.5 focus:outline-none focus:border-ll-00d4ff"
                                  >
                                    <option value="PRE_START">PRE_START</option>
                                    <option value="RACING">RACING</option>
                                    <option value="FINISHED">FINISHED</option>
                                    <option value="OCS">OCS</option>
                                    <option value="CLEARED_OCS">CLEARED_OCS</option>
                                    <option value="RET">RET (Retired)</option>
                                    <option value="DNF">DNF</option>
                                    <option value="DNS">DNS</option>
                                    <option value="DSQ">DSQ</option>
                                  </select>
                                </td>
                              )}
                            </tr>

                            {/* Detailed Mark Rounding Drawer */}
                            {(isExpanded || viewMode === 'MARK_SPLITS') && (
                              <tr className="bg-lb-060b16/80 border-b border-ll-1e293b/40">
                                <td colSpan={12} className="py-3 px-4 sm:px-6">
                                  <div className="bg-lb-0e172a border border-ll-1e293b rounded-xl p-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs font-mono">
                                      <span className="text-lt-00d4ff font-bold flex items-center gap-1.5">
                                        <Navigation className="w-3.5 h-3.5" />
                                        Official Mark Rounding Splits for {boatName} ({sailNumber})
                                      </span>
                                      <span className="text-lt-94a3b8">
                                        Total Marks Rounded: {markRoundings.length}
                                      </span>
                                    </div>

                                    {markRoundings.length === 0 ? (
                                      <p className="text-xs text-lt-64748b italic">
                                        No mark roundings logged yet on course.
                                      </p>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                                        {markRoundings.map((mr: any, mIdx: number) => (
                                          <div
                                            key={mIdx}
                                            className="bg-lb-060b16 border border-ll-1e293b rounded-lg p-2.5 space-y-1"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-bold text-lt-white">
                                                Leg {mIdx + 1}: {mr.markName}
                                              </span>
                                              <span className="text-xs font-mono text-lt-ffb800 bg-lb-amber-500/10 px-1 rounded">
                                                #{mIdx + 1}
                                              </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1 pt-1">
                                              <div>
                                                <div className="text-xs text-lt-64748b font-mono">Elapsed At</div>
                                                <div className="text-xs font-mono text-lt-white">
                                                  {formatTime(mr.elapsedAtSec || 0)}
                                                </div>
                                              </div>
                                              <div>
                                                <div className="text-xs text-lt-64748b font-mono">Leg Duration</div>
                                                <div className="text-xs font-mono font-bold text-lt-00ff9d">
                                                  +{formatTime(mr.legDurationSec || 0)}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-1 border-t border-ll-1e293b/50 text-xs text-lt-94a3b8 font-mono">
                                              <span>Avg Speed: <strong className="text-lt-white">{mr.legSpeedKt || 7.5} kt</strong></span>
                                              <span className="text-lt-00ff9d flex items-center gap-0.5">
                                                <CheckCircle2 className="w-2.5 h-2.5" /> Valid
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer info & PRO Certification */}
        <div className="p-3.5 sm:p-4 border-t border-ll-1e293b bg-lb-060b16/90 flex flex-wrap items-center justify-between gap-3 text-xs text-lt-64748b font-mono">
          <div className="flex items-center gap-3 flex-wrap">
            <span>Wind: {raceState.windSpeedKt} kt @ {raceState.windDirectionDeg}°</span>
            <span>•</span>
            <span>Total Fleet: {boats.length} boats</span>
            <span>•</span>
            <span>Series Races: {seriesRaces.length} Completed</span>
          </div>

          <div className="flex items-center gap-3 ml-auto flex-wrap">
            <span className="hidden sm:inline text-right text-xs text-lt-94a3b8">
              World Sailing RRS Appendix A Scoring Engine • Automatic Finish & Mark Leg Splits
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-lb-1e293b hover:bg-lb-334155 text-lt-cbd5e1 hover:text-lt-white text-xs font-mono font-bold transition-all ml-auto"
            >
              Close
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* DIALOG 1: SAVE LIVE RACE SNAPSHOT TO SERIES */}
      {/* ========================================================= */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-lb-black/70 backdrop-blur-sm">
          <div className="bg-lb-0b132b border border-ll-1e293b rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4 text-lt-e2e8f0 font-google">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lt-white font-bold text-base">
                <Save className="w-5 h-5 text-lt-00d4ff" />
                <h3>Save Race to Series</h3>
              </div>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="p-1 rounded-lg text-lt-94a3b8 hover:text-lt-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-lt-94a3b8 font-mono">
              Save the current fleet elapsed times, corrected scores, and mark roundings as <strong>Race {nextRaceNum}</strong> in the regatta series.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-lt-cbd5e1">Race Title / Course Name:</label>
              <input
                type="text"
                value={customRaceTitle}
                placeholder={`Race ${nextRaceNum}: Harbour Passage & Windward Leg`}
                onChange={(e) => setCustomRaceTitle(e.target.value)}
                className="w-full bg-lb-060b16 border border-ll-1e293b rounded-xl px-3 py-2 text-xs font-mono text-lt-white focus:outline-none focus:border-ll-00d4ff"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-3 py-1.5 rounded-xl bg-lb-1e293b hover:bg-lb-334155 text-xs font-mono text-lt-94a3b8 hover:text-lt-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCurrentRace}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-lb-00d4ff to-lb-0099ff hover:from-lb-38e1ff hover:to-lb-22a5ff text-lt-black font-bold text-xs font-mono transition-all shadow-md shadow-ll-cyan-500/20"
              >
                Confirm & Save Race {nextRaceNum}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DIALOG 2: DELETE PARTICULAR RACE CONFIRMATION */}
      {/* ========================================================= */}
      {raceToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-lb-black/75 backdrop-blur-sm">
          <div className="bg-lb-0b132b border border-ll-red-900/50 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4 text-lt-e2e8f0 font-google">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lt-red-400 font-bold text-base">
                <Trash2 className="w-5 h-5" />
                <h3>Delete Race {raceToDelete.raceNumber}?</h3>
              </div>
              <button
                onClick={() => setRaceToDelete(null)}
                className="p-1 rounded-lg text-lt-94a3b8 hover:text-lt-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-lb-060b16 rounded-xl border border-ll-1e293b space-y-1">
              <div className="text-xs font-bold text-lt-white font-mono">
                {raceToDelete.raceTitle || `Race ${raceToDelete.raceNumber}`}
              </div>
              <div className="text-xs text-lt-94a3b8 font-mono">
                {raceToDelete.results?.length || 0} boat finish results • Wind: {raceToDelete.windSpeedKt} kt @ {raceToDelete.windDirectionDeg}°
              </div>
            </div>

            <p className="text-xs text-lt-94a3b8 font-mono">
              Are you sure you want to permanently remove this race from the regatta series? Overall series points, podium standings, and discard calculations will update immediately.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRaceToDelete(null)}
                className="px-3 py-1.5 rounded-xl bg-lb-1e293b hover:bg-lb-334155 text-xs font-mono text-lt-94a3b8 hover:text-lt-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteRace}
                className="px-4 py-1.5 rounded-xl bg-lb-red-600 hover:bg-lb-red-500 text-lt-white font-bold text-xs font-mono transition-all shadow-md shadow-ll-red-600/30 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Race</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DIALOG 3: REGATTA SERIES MANAGEMENT (NEW / CLEAR SERIES) */}
      {/* ========================================================= */}
      {showSeriesManagerDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-lb-black/75 backdrop-blur-sm">
          <div className="bg-lb-0b132b border border-ll-1e293b rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-5 text-lt-e2e8f0 font-google max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-ll-1e293b pb-3">
              <div className="flex items-center gap-2.5 text-lt-white font-bold text-base">
                <FolderPlus className="w-5 h-5 text-lt-00d4ff" />
                <h3>Regatta Series Management</h3>
              </div>
              <button
                onClick={() => setShowSeriesManagerDialog(false)}
                className="p-1 rounded-lg text-lt-94a3b8 hover:text-lt-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Series Summary */}
            <div className="grid grid-cols-3 gap-2 bg-lb-060b16 border border-ll-1e293b rounded-xl p-3 text-center font-mono">
              <div>
                <div className="text-xs text-lt-64748b">Completed Races</div>
                <div className="text-sm font-bold text-lt-00d4ff">{seriesRaces.length}</div>
              </div>
              <div>
                <div className="text-xs text-lt-64748b">Participating Fleet</div>
                <div className="text-sm font-bold text-lt-white">{boats.length} Boats</div>
              </div>
              <div>
                <div className="text-xs text-lt-64748b">Discards</div>
                <div className="text-sm font-bold text-lt-00ff9d">
                  {discardRule === 'NONE' ? 'None' : '1 Drop'}
                </div>
              </div>
            </div>

            {/* Section 1: Start New / Clear Series */}
            <div className="bg-lb-0e172a border border-ll-1e293b rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-lt-white font-mono">
                <Sparkles className="w-4 h-4 text-lt-ffb800" />
                <h4>Start a New Regatta Series</h4>
              </div>
              <p className="text-xs text-lt-94a3b8 font-mono leading-relaxed">
                Clears all past race results from local storage and starts a fresh series for today's championship round or regatta day.
              </p>

              <label className="flex items-center gap-2 text-xs font-mono text-lt-cbd5e1 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={resetFleetWithNewSeries}
                  onChange={(e) => setResetFleetWithNewSeries(e.target.checked)}
                  className="rounded border-ll-1e293b bg-lb-060b16 text-lt-00d4ff focus:ring-0"
                />
                <span>Also reset live fleet timers & mark roundings to Race 1</span>
              </label>

              <div className="pt-2">
                <button
                  onClick={handleConfirmStartNewSeries}
                  className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-lb-red-600/80 to-lb-amber-600/80 hover:from-lb-red-500 hover:to-lb-amber-500 text-lt-white font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Clear Historical Races & Start Fresh Series</span>
                </button>
              </div>
            </div>

            {/* Section 2: Manage Existing Races List */}
            {seriesRaces.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-lt-white font-mono flex items-center justify-between">
                  <span>Completed Historical Races ({seriesRaces.length})</span>
                  <span className="text-xs text-lt-64748b">Click trash to remove individual race</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                  {seriesRaces.map((r) => (
                    <div
                      key={r.id}
                      className="p-2 bg-lb-060b16 border border-ll-1e293b rounded-xl flex items-center justify-between gap-2 text-xs font-mono"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-lt-white truncate">
                          Race {r.raceNumber}{r.raceTitle ? `: ${r.raceTitle}` : ''}
                        </div>
                        <div className="text-xs text-lt-94a3b8">
                          {r.results?.length || 0} finishes • Wind {r.windSpeedKt}kt @ {r.windDirectionDeg}°
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setRaceToDelete(r);
                        }}
                        className="p-1.5 rounded-lg text-lt-red-400 hover:text-lt-white hover:bg-lb-red-600/50 transition-all shrink-0"
                        title={`Delete Race ${r.raceNumber}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3: Restore Demo Data */}
            {onRestoreSampleSeries && (
              <div className="pt-2 border-t border-ll-1e293b flex items-center justify-between">
                <span className="text-xs text-lt-64748b font-mono">Need demo/practice data?</span>
                <button
                  onClick={handleConfirmRestoreSampleSeries}
                  className="px-3 py-1.5 rounded-lg bg-lb-1e293b hover:bg-lb-334155 text-xs font-mono text-lt-cbd5e1 hover:text-lt-white transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-lt-00d4ff" />
                  <span>Restore Sample 3-Race Series</span>
                </button>
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setShowSeriesManagerDialog(false)}
                className="px-4 py-1.5 rounded-xl bg-lb-1e293b hover:bg-lb-334155 text-xs font-mono text-lt-94a3b8 hover:text-lt-white transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roster Import Modal (Sailwave / World Sailing / CSV / JSON) */}
      {showRosterImportModal && (
        <div className="fixed inset-0 z-60 bg-lb-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200">
          <div className="bg-lb-0a0f1e border border-ll-334155 w-full max-w-2xl rounded-3xl landscape:rounded-2xl shadow-2xl p-4 sm:p-6 space-y-4 max-h-[90vh] landscape:max-h-[96dvh] flex flex-col text-lt-e0e6ed overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ll-1e293b pb-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-lb-c084fc/15 border border-ll-c084fc/40 flex items-center justify-center text-lt-c084fc shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-lt-white flex items-center gap-2">
                    Import Competitor Fleet Roster
                    <span className="text-xs bg-lb-c084fc/20 text-lt-c084fc px-2 py-0.5 rounded-full font-mono border border-ll-c084fc/30">
                      SAILWAVE &amp; WS
                    </span>
                  </h3>
                  <p className="text-xs text-lt-64748b font-mono">
                    Upload or paste CSV / JSON entries to automatically register boats, sail numbers &amp; ratings
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRosterImportModal(false)}
                className="p-2 rounded-xl text-lt-94a3b8 hover:text-lt-white hover:bg-lb-1e293b transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
              {/* File drop / select + sample buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-lb-1e293b hover:bg-lb-334155 text-lt-white text-xs font-mono font-bold rounded-xl border border-ll-334155 cursor-pointer flex items-center gap-1.5 transition-all">
                    <Upload className="w-3.5 h-3.5 text-lt-00d4ff" />
                    <span>Upload CSV / JSON</span>
                    <input
                      type="file"
                      accept=".csv,.json,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const content = event.target?.result as string;
                          setRosterInputText(content);
                          handleParseRoster(content);
                        };
                        reader.readAsText(file);
                      }}
                    />
                  </label>
                  <button
                    onClick={handleLoadSampleRoster}
                    className="px-3 py-1.5 bg-lb-00d4ff/10 hover:bg-lb-00d4ff/20 text-lt-00d4ff text-xs font-mono font-bold rounded-xl border border-ll-00d4ff/30 transition-all"
                  >
                    Load Sample Roster
                  </button>
                </div>

                <span className="text-xs text-lt-64748b font-mono">
                  Headers: BoatName, SailNo, Skipper, Class, Rating
                </span>
              </div>

              {/* Textarea for pasting */}
              <div>
                <textarea
                  rows={5}
                  value={rosterInputText}
                  onChange={(e) => {
                    setRosterInputText(e.target.value);
                    handleParseRoster(e.target.value);
                  }}
                  placeholder={`Paste CSV or JSON competitor data here...\ne.g.\nBoatName,SailNo,Skipper,Class,Rating\nOcean Spirit,MAS 101,Azlan Shah,Class 1,1.025`}
                  className="w-full bg-lb-060b16 border border-ll-1e293b rounded-2xl p-3 text-xs text-lt-white font-mono placeholder:text-lt-slate-600 focus:border-ll-c084fc outline-none"
                />
              </div>

              {/* Parsing status / errors */}
              {rosterParseError && (
                <div className="p-3 rounded-xl bg-lb-red-500/15 border border-ll-red-500/40 text-lt-red-300 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-lt-red-400 shrink-0" />
                  <span>{rosterParseError}</span>
                </div>
              )}

              {/* Parsed records preview table */}
              {parsedRosterRecords.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-lt-00ff9d font-bold flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-lt-00ff9d" />
                      Detected {parsedRosterRecords.length} Competitors:
                    </span>
                    <span className="text-lt-64748b">Ready to register into active fleet</span>
                  </div>

                  <div className="border border-ll-1e293b rounded-2xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-lb-060b16 text-lt-64748b border-b border-ll-1e293b sticky top-0">
                        <tr>
                          <th className="p-2">Sail #</th>
                          <th className="p-2">Boat Name</th>
                          <th className="p-2">Skipper</th>
                          <th className="p-2">Class</th>
                          <th className="p-2 text-right">Rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ll-1e293b/60 bg-lb-0a0f1e">
                        {parsedRosterRecords.map((r, idx) => (
                          <tr key={idx} className="hover:bg-lb-1e293b/40">
                            <td className="p-2 font-bold text-lt-00d4ff">{r.sailNumber}</td>
                            <td className="p-2 text-lt-white">{r.name}</td>
                            <td className="p-2 text-lt-slate-300">{r.skipper}</td>
                            <td className="p-2">
                              <span className="px-2 py-0.5 rounded-full text-xs bg-lb-1e293b text-lt-94a3b8">
                                {r.className}
                              </span>
                            </td>
                            <td className="p-2 text-right font-bold text-lt-fbbc04">
                              {safeFixed(r.handicapRating, 3, '1.000')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-ll-1e293b shrink-0">
              <button
                onClick={() => setShowRosterImportModal(false)}
                className="px-4 py-2 rounded-xl bg-lb-1e293b hover:bg-lb-334155 text-xs font-mono text-lt-94a3b8 hover:text-lt-white transition-all"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmRosterImport}
                disabled={parsedRosterRecords.length === 0}
                className={`px-5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all ${
                  parsedRosterRecords.length > 0
                    ? 'bg-lb-00ff9d text-lt-black shadow-[0_0_15px_rgba(0,255,157,0.4)] hover:bg-lb-33ffaa'
                    : 'bg-lb-slate-800 text-lt-slate-500 cursor-not-allowed'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Sync {parsedRosterRecords.length} Boats to Fleet</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
