import { csvBlob, csvCell, csvRows, csvTextCell } from '../services/csv';
import React, { useState, useMemo, useEffect, useId } from 'react';
import { Boat, RaceClassDefinition, RaceState, CompletedRace, SeriesStanding } from '../types/regatta';
import {
  Trophy,
  Download,
  Printer,
  X,
  CheckCircle2,
  Filter,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Flag,
  RotateCcw,
  Award,
  Navigation,
  Compass,
  Save,
  Trash2,
  FolderPlus,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import { formatTime, safeFixed } from '../utils/formatters';
import {
  calculateSeriesStandings,
  buildRaceSnapshotFromBoats,
  exportToWorldSailingXml,
  exportToSailwaveCsv,
  scoreForRace,
} from '../services/scoringService';
import { DialogFrame } from './ui/Dialog';

interface RaceResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  boats: Boat[];
  raceState: RaceState;
  raceClasses?: RaceClassDefinition[];
  seriesRaces?: CompletedRace[];
  onUpdateBoatStatus?: (boatId: string, status: Boat['status']) => void;
  onSaveRaceToSeries?: (race: CompletedRace) => void;
  onDeleteRaceFromSeries?: (raceId: string) => void;
  onResetForNextRace?: (nextRaceNumber: number) => void;
  onClearSeries?: () => void;
  onNewSeries?: (resetFleet: boolean) => void;
  viewMode?: 'RC_CONSOLE' | 'SPECTATOR';
}

export const RaceResultsModal: React.FC<RaceResultsModalProps> = ({
  isOpen,
  onClose,
  boats,
  raceState,
  raceClasses = [],
  seriesRaces = [],
  onUpdateBoatStatus,
  onSaveRaceToSeries,
  onDeleteRaceFromSeries,
  onResetForNextRace,
  onClearSeries,
  onNewSeries,
  viewMode: appViewMode = 'RC_CONSOLE',
}) => {
  const titleId = useId();
  const saveTitleId = useId();
  const deleteTitleId = useId();
  const seriesTitleId = useId();
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

  // Ecosystem & Data Standards: Export menu
  const [showExportMenu, setShowExportMenu] = useState(false);

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
        ...classSeriesRaces.map((r) => `R${r.raceNumber} Pts`),
        'Total Gross Pts',
        'Nett Pts',
      ];

      rows = seriesStandings.map((s) => {
        // One column per series race, matched by race (a boat may have no score in some)
        const racePointsCols = classSeriesRaces.map((race) => {
          const score = scoreForRace(s, race);
          if (!score) return csvCell('');
          return csvCell(score.isDiscarded ? `[${safeFixed(score.points, 1)}]` : safeFixed(score.points, 1));
        });
        return [
          csvCell(s.seriesRank),
          csvTextCell(s.sailNumber),
          csvTextCell(s.boatName),
          csvTextCell(s.class),
          csvTextCell(s.skipper),
          csvCell(safeFixed(s.handicapRating, 3, '1.000')),
          ...racePointsCols,
          csvCell(safeFixed(s.totalPoints, 1)),
          csvCell(safeFixed(s.nettPoints, 1)),
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
          csvCell(b.status === 'FINISHED' ? idx + 1 : b.status),
          csvTextCell(sail),
          csvTextCell(name),
          csvTextCell(cls),
          csvTextCell(skp),
          csvCell(stat),
          csvCell(el),
          csvCell(rat),
          csvCell(cor),
          csvCell(deltaStr),
          csvCell(pts),
          csvCell(roundingsStr),
        ];
      });

      const raceLabel = isViewingLiveRace ? 'Live_Race' : `Race_${selectedHistoricalRace?.raceNumber || 1}`;
      filename = `Official_${raceLabel}_Results_${selectedClass}_${new Date().toISOString().slice(0, 10)}.csv`;
    }

    // A file, not a data: URL (a '#' anywhere in a name used to cut the file short there)
    const url = URL.createObjectURL(csvBlob(csvRows([headers.map(csvCell), ...rows])));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

    const blob = csvBlob(sailwaveContent);
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


  if (!isOpen) return null;

  return (
    <>
      <DialogFrame
        onClose={onClose}
        labelledBy={titleId}
        initialFocus="container"
        overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-5 landscape:p-1.5 bg-canvas/75 backdrop-blur-xs animate-in fade-in duration-200 select-none overflow-y-auto"
        className="bg-surface/95 backdrop-blur-md border border-line/80 rounded-2xl sm:rounded-3xl w-full max-w-6xl max-h-[calc(100dvh-16px)] sm:max-h-[90vh] landscape:max-h-[98dvh] landscape:h-[98dvh] flex flex-col shadow-2xl overflow-y-auto overflow-x-hidden custom-scrollbar overscroll-contain touch-pan-y text-ink relative my-auto"
      >
        
        {/* Floating Feedback Toast */}
        {feedbackToast && (
          <div className="absolute top-4 right-14 z-50 bg-accent text-on-accent px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xl flex items-center gap-2 border border-accent">
            <CheckCircle2 className="w-4 h-4" />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Top Header Bar */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-line bg-canvas/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-start sm:items-center gap-3 min-w-[18rem] flex-1">
            <div className="w-10 h-10 rounded-2xl bg-raised flex items-center justify-center text-ink shrink-0 mt-0.5 sm:mt-0">
              <Trophy className="w-5 h-5 font-bold" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id={titleId} className="text-base sm:text-lg font-bold text-ink leading-snug">Results</h2>
              </div>
              <p className="text-xs sm:text-xs text-ink-muted mt-1 break-words leading-relaxed whitespace-normal">
                Low-point scoring (RRS Appendix A) · {classSeriesRaces.length} completed {classSeriesRaces.length === 1 ? 'race' : 'races'}{selectedClass === 'ALL' ? '' : ` in ${selectedClass}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Class Filter Toggle (Hide / Unhide for more vertical viewing space) */}
            <button
              onClick={() => setShowClassFilter((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs  font-bold flex items-center gap-1.5 border transition-all ${
                !showClassFilter
                  ? 'bg-accent/20 text-accent border-accent/40 shadow-sm'
                  : 'bg-raised hover:bg-raised text-ink-muted hover:text-ink border-line'
              }`}
              title={showClassFilter ? 'Hide class filter & scoring controls for extra vertical viewing space' : 'Show class filter & scoring controls'}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{showClassFilter ? 'Hide Filters' : 'Show Filters'}</span>
              {showClassFilter ? (
                <ChevronUp className="w-3.5 h-3.5 text-ink-muted" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-accent" />
              )}
            </button>

            {/* Prep Next Race Button (Cleanly Positioned in Top Actions) */}
            {appViewMode !== 'SPECTATOR' && onResetForNextRace && (
              <button
                onClick={() => {
                  onResetForNextRace(nextRaceNum);
                  showToast(`Fleet reset and prepared for Race ${nextRaceNum}`);
                }}
                className="px-3 py-1.5 rounded-xl bg-raised hover:brightness-110 text-ink text-xs font-bold flex items-center gap-1.5 border border-line transition-[filter]"
                title={`Reset course timers & prepare fleet for Race ${nextRaceNum} (${selectedClass})`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prepare race {nextRaceNum}</span>
                <span className="sm:hidden">Prep R{nextRaceNum}</span>
              </button>
            )}

            {/* Save Current Race to Series */}
            {appViewMode !== 'SPECTATOR' && onSaveRaceToSeries && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="px-3 py-1.5 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent text-xs font-bold flex items-center gap-1.5 border border-accent/40 transition-all shadow-sm"
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
                className="px-3 py-1.5 rounded-xl bg-raised hover:bg-raised text-ink text-xs font-bold flex items-center gap-1.5 border border-line transition-all"
                title="Series Management: Start a new regatta series or manage individual races"
              >
                <FolderPlus className="w-3.5 h-3.5 text-success-ink" />
                <span className="hidden md:inline">Series Options</span>
              </button>
            )}


            {/* Ecosystem Export Menu (World Sailing XML, Sailwave, Standard CSV) */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-raised hover:bg-raised text-ink text-xs font-bold flex items-center gap-1.5 border border-line transition-all shadow-sm"
                title="Export results in World Sailing XML, Sailwave CSV, or standard CSV format"
              >
                <Download className="w-3.5 h-3.5 text-accent" />
                <span className="hidden md:inline">Export</span>
                <ChevronDown className="w-3 h-3 text-ink-muted" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1.5 w-64 bg-surface border border-line rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 border-b border-line text-xs text-ink-muted">
                    Ecosystem Export Formats
                  </div>
                  <button
                    onClick={handleExportWorldSailing}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-ink hover:bg-raised flex items-center gap-2.5 transition-colors"
                  >
                    <FileCode className="w-4 h-4 text-success-ink shrink-0" />
                    <div>
                      <div className="font-bold">World Sailing XML</div>
                      <div className="text-xs text-ink-muted">International standard exchange format</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportSailwave}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-ink hover:bg-raised flex items-center gap-2.5 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-accent shrink-0" />
                    <div>
                      <div className="font-bold">Sailwave CSV</div>
                      <div className="text-xs text-ink-muted">Direct import into Sailwave software</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportCsv}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-ink hover:bg-raised flex items-center gap-2.5 transition-colors"
                  >
                    <Download className="w-4 h-4 text-warning-ink shrink-0" />
                    <div>
                      <div className="font-bold">Standard Regatta CSV</div>
                      <div className="text-xs text-ink-muted">Includes splits & timing audit breakdown</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Print Official Notice */}
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-xl bg-raised hover:bg-raised text-ink text-xs font-bold flex items-center gap-1.5 border border-line transition-all"
              title="Print official notice board summary"
            >
              <Printer className="w-3.5 h-3.5 text-ink-muted" />
              <span className="hidden md:inline">Print</span>
            </button>

            <button
              aria-label="Close"
              onClick={onClose}
              className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-raised transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. Filter & Configuration Bar (Positioned AT THE TOP OF RACE SERIES, Collapsible) */}
        {showClassFilter ? (
          <div className="px-3 sm:px-5 py-2.5 border-b border-line bg-surface/80 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150 shrink-0">
            {/* Class Filters: Mobile Dropdown View vs Desktop Button Pills */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-full">
              {/* MOBILE DROPDOWN LIST (<select>) */}
              <div className="flex sm:hidden items-center gap-2 w-full">
                <span className="text-xs text-ink-muted flex items-center gap-1 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-accent" /> Class:
                </span>
                <div className="relative flex-1">
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full bg-surface border border-accent/40 text-accent text-xs font-bold rounded-xl px-3 py-1.5 appearance-none focus:outline-none focus:ring-1 focus:ring-accent pr-8 shadow-sm cursor-pointer"
                  >
                    <option value="ALL" className="bg-surface text-ink">
                      ALL CLASSES ({boats.length} Boats)
                    </option>
                    {raceClasses.map((cls) => {
                      const count = boats.filter((b) => b.class === cls.name).length;
                      return (
                        <option key={cls.id} value={cls.name} className="bg-surface text-ink">
                          {cls.name} ({count} {count === 1 ? 'boat' : 'boats'})
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-4 h-4 text-accent absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* DESKTOP BUTTON PILLS (Hidden on Mobile) */}
              <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-ink-muted mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Class:
                </span>
                <button
                  onClick={() => setSelectedClass('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs  transition-all ${
                    selectedClass === 'ALL'
                      ? 'bg-accent text-on-accent font-bold shadow-sm'
                      : 'bg-raised/70 text-ink-muted hover:text-ink'
                  }`}
                >
                  ALL ({boats.length})
                </button>
                {raceClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClass(cls.name)}
                    className={`px-2.5 py-1 rounded-lg text-xs  transition-all ${
                      selectedClass === cls.name
                        ? 'bg-accent text-on-accent font-bold shadow-sm'
                        : 'bg-raised/70 text-ink-muted hover:text-ink'
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
                <div className="flex items-center bg-canvas border border-line p-1 rounded-xl shadow-inner">
                  <button
                    onClick={() => setViewMode('COMPACT')}
                    className={`px-3 py-1 rounded-lg text-xs  font-bold transition-all duration-150 ${
                      viewMode === 'COMPACT'
                        ? 'bg-raised text-ink shadow-sm border border-line'
                        : 'text-ink-muted hover:text-ink-muted'
                    }`}
                    title="Compact view"
                  >
                    Compact
                  </button>
                  <button
                    onClick={() => setViewMode('MARK_SPLITS')}
                    className={`px-3 py-1 rounded-lg text-xs  font-bold transition-all duration-150 flex items-center gap-1.5 ${
                      viewMode === 'MARK_SPLITS'
                        ? 'bg-accent text-on-accent shadow-sm border border-accent'
                        : 'text-ink-muted hover:text-ink-muted'
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
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-ink-muted hidden sm:inline">Discards:</span>
                  <select
                    value={discardRule}
                    onChange={(e) => setDiscardRule(e.target.value as any)}
                    className="bg-surface border border-line text-xs text-accent rounded-lg px-2 py-1 focus:outline-none focus:border-accent"
                  >
                    <option value="1_DISCARD_3_RACES">1 Discard (3+ Races - RRS A2)</option>
                    <option value="1_DISCARD_4_RACES">1 Discard (4+ Races)</option>
                    <option value="ALWAYS_1_DISCARD">Always Drop 1 Worst Race</option>
                    <option value="NONE">No Discards (All Races Count)</option>
                  </select>
                </div>
              )}

              {/* Scoring Mode Toggle (Corrected IRC/PY vs Scratch) */}
              <div className="flex items-center bg-canvas border border-line p-1 rounded-xl shadow-inner">
                <button
                  onClick={() => setScoringSystem('HANDICAP')}
                  className={`px-3 py-1 rounded-lg text-xs  font-bold transition-all duration-150 ${
                    scoringSystem === 'HANDICAP'
                      ? 'bg-accent text-on-accent shadow-sm border border-accent'
                      : 'text-ink-muted hover:text-ink-muted'
                  }`}
                >
                  IRC/PY Corrected
                </button>
                <button
                  onClick={() => setScoringSystem('SCRATCH')}
                  className={`px-3 py-1 rounded-lg text-xs  font-bold transition-all duration-150 ${
                    scoringSystem === 'SCRATCH'
                      ? 'bg-accent text-on-accent shadow-sm border border-accent'
                      : 'text-ink-muted hover:text-ink-muted'
                  }`}
                >
                  Scratch
                </button>
              </div>

              {/* Quick Hide Button */}
              <button
                onClick={() => setShowClassFilter(false)}
                className="p-1 px-2 text-xs text-ink-muted hover:text-ink hover:bg-raised rounded-lg transition-colors flex items-center gap-1"
                title="Hide Class Filter bar"
              >
                <span>Hide</span>
                <ChevronUp className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          /* Collapsed Filter Indicator Banner (Saves generous vertical space on mobile) */
          <div className="px-3 sm:px-5 py-1.5 border-b border-line/70 bg-surface/60 flex items-center justify-between gap-2 text-xs text-ink-muted animate-in fade-in duration-150 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <span className="text-ink-muted flex items-center gap-1">
                <Filter className="w-3 h-3 text-accent" /> Filter:
              </span>
              <span className="px-2 py-0.5 rounded bg-accent/15 text-accent font-bold">
                {selectedClass === 'ALL' ? 'All Classes' : selectedClass}
              </span>
              <span className="px-2 py-0.5 rounded bg-raised text-ink">
                {scoringSystem === 'HANDICAP' ? 'IRC/PY' : 'Scratch'}
              </span>
              {isViewingSeries && (
                <span className="hidden sm:inline text-ink-muted">
                  ({discardRule === 'NONE' ? 'No Discards' : '1 Discard'})
                </span>
              )}
            </div>
            <button
              onClick={() => setShowClassFilter(true)}
              className="px-2.5 py-1 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-xs font-bold border border-accent/30 transition-all flex items-center gap-1 shrink-0"
            >
              <span>Unhide Filters</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* 2. Series & Individual Race Selector (Dropdown on portrait mobile, Slideable Tab Bar on Landscape Mobile & Desktop) */}
        <div className="px-2 sm:px-5 py-2 sm:py-2.5 border-y border-line bg-surface shadow-md sticky top-0 z-20 shrink-0 w-full max-w-full overflow-x-clip overflow-y-visible">
          
          {/* MOBILE PORTRAIT VIEW: Compact Dropdown with Delete button on side */}
          <div className="flex sm:hidden landscape:hidden items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 shrink-0 text-xs text-ink-muted">
              <Layers className="w-3.5 h-3.5 text-accent" />
              <span className="font-bold text-ink text-xs">Race:</span>
            </div>
            
            <div className="relative flex-1 min-w-0">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full bg-surface border border-accent/50 text-ink text-xs font-bold rounded-xl px-3 py-2 appearance-none focus:outline-none focus:ring-1 focus:ring-accent pr-8 shadow-sm cursor-pointer"
              >
                <option value="SERIES" className="bg-surface text-warning-ink font-bold">
                  Overall Series Standings ({classSeriesRaces.length} R)
                </option>
                <option value="live-race" className="bg-surface text-success-ink font-bold">
                  Live Race ({selectedClass})
                </option>
                {classSeriesRacesDesc.map((race) => (
                  <option key={race.id} value={race.id} className="bg-surface text-accent">
                    Race {race.raceNumber} ({race.results?.length || 0} finishers)
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-accent absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Individual Delete Button on side when historical race is selected in dropdown */}
            {selectedHistoricalRace && onDeleteRaceFromSeries && (
              <button
                onClick={() => setRaceToDelete(selectedHistoricalRace)}
                className="px-2.5 py-2 rounded-xl bg-danger/20 hover:bg-danger/35 text-danger-ink border border-danger-ink/40 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-sm"
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
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-canvas border border-line text-xs text-ink-muted shrink-0 whitespace-nowrap">
              <Layers className="w-3.5 h-3.5 text-accent" />
              <span className="font-bold text-ink">Race View:</span>
            </div>

            {/* Overall Series Tab */}
            <button
              onClick={() => setActiveTab('SERIES')}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs  font-bold flex items-center gap-1.5 sm:gap-2 transition-all shrink-0 border whitespace-nowrap ${
                activeTab === 'SERIES'
                  ? 'bg-accent text-on-accent border-accent'
                  : 'bg-surface text-ink border-line hover:text-ink hover:bg-raised hover:border-line'
              }`}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>Overall Series Standings</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${activeTab === 'SERIES' ? 'bg-on-accent/20 text-on-accent' : 'bg-raised text-ink-muted'}`}>
                {classSeriesRaces.length} R
              </span>
            </button>

            {/* Live Race Tab (Leftmost race tab) */}
            <button
              onClick={() => setActiveTab('live-race')}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs  font-bold flex items-center gap-1.5 sm:gap-2 transition-all shrink-0 border whitespace-nowrap ${
                activeTab === 'live-race'
                  ? 'bg-accent text-on-accent border-accent'
                  : 'bg-surface text-ink border-line hover:bg-raised'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-success-ink mr-0.5 shrink-0" aria-hidden="true" />
              <span>Live Race ({selectedClass})</span>
            </button>

            {/* Completed Class Historical Races Tabs (from latest to oldest, left to right) */}
            {classSeriesRacesDesc.map((race) => (
              <div
                key={race.id}
                className={`group relative flex items-center rounded-xl transition-all shrink-0 border whitespace-nowrap ${
                  activeTab === race.id
                    ? 'bg-accent text-on-accent border-accent'
                    : 'bg-surface text-ink border-line hover:text-ink hover:bg-raised hover:border-line'
                }`}
              >
                <button
                  onClick={() => setActiveTab(race.id)}
                  className="px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Flag className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Race {race.raceNumber}</span>
                  <span className={`text-xs px-1.5 py-0.2 rounded-md shrink-0 ${activeTab === race.id ? 'bg-ink/20 text-ink font-bold' : 'bg-canvas text-success-ink'}`}>
                    {race.results?.length || 0}
                  </span>
                </button>
                {onDeleteRaceFromSeries && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRaceToDelete(race);
                    }}
                    className={`p-1 mr-1.5 rounded-md text-danger-ink hover:text-ink hover:bg-danger/60 transition-all shrink-0 ${
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
                <div className="bg-surface border border-line rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
                  <div className="w-14 h-14 rounded-2xl bg-raised text-ink-muted flex items-center justify-center mx-auto">
                    <Trophy className="w-7 h-7" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1.5">
                    <h3 className="text-base font-bold text-ink">
                      No Series Races Recorded Yet
                    </h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      Run races on the water and click <strong>"Save Live to Series"</strong> (or <strong>"Prepare race"</strong>) to build your official multi-race regatta leaderboard with automated Low Point calculations and mark splits.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                    <button
                      onClick={() => setActiveTab('live-race')}
                      className="px-4 py-2 rounded-xl bg-accent text-on-accent font-bold text-xs hover:brightness-110 transition-[filter] flex items-center gap-2"
                    >
                      <Flag className="w-4 h-4" />
                      <span>View Live Active Race</span>
                    </button>
                    {onSaveRaceToSeries && (
                      <button
                        onClick={() => setShowSaveDialog(true)}
                        className="px-4 py-2 rounded-xl bg-accent/20 hover:bg-accent/30 text-accent font-bold text-xs border border-accent/40 transition-all flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        <span>Save Current Fleet as Race 1</span>
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
                        <div className="bg-gradient-to-br from-warning-ink/20 to-warning-ink/5 border border-warning-ink/50 rounded-xl p-3.5 flex items-center gap-3 relative overflow-hidden shadow-lg">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-warning-ink to-warning-ink text-canvas font-bold text-base flex items-center justify-center shadow-lg shrink-0">
                            1st
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-warning-ink font-bold flex items-center gap-1">
                              <Trophy className="w-3 h-3" /> SERIES WINNER • {seriesStandings[0].nettPoints} NETT PTS
                            </div>
                            <div className="font-bold text-ink truncate text-sm">
                              {seriesStandings[0].boatName}
                            </div>
                            <div className="text-xs text-ink-muted">
                              {seriesStandings[0].sailNumber} • {seriesStandings[0].skipper} ({seriesStandings[0].class})
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2nd Place Runner Up */}
                      {seriesStandings[1] && (
                        <div className="bg-gradient-to-br from-ink/15 to-raised/10 border border-line/40 rounded-xl p-3.5 flex items-center gap-3 relative overflow-hidden shadow-md">
                          <div className="w-10 h-10 rounded-full bg-ink text-canvas font-bold text-sm flex items-center justify-center shadow-md shrink-0">
                            2nd
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-ink font-bold">
                              2ND OVERALL • {seriesStandings[1].nettPoints} NETT PTS
                            </div>
                            <div className="font-bold text-ink truncate text-sm">
                              {seriesStandings[1].boatName}
                            </div>
                            <div className="text-xs text-ink-muted">
                              {seriesStandings[1].sailNumber} • {seriesStandings[1].skipper} ({seriesStandings[1].class})
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3rd Place Bronze */}
                      {seriesStandings[2] && (
                        <div className="bg-gradient-to-br from-warning-ink/15 to-surface/10 border border-warning-ink/40 rounded-xl p-3.5 flex items-center gap-3 relative overflow-hidden shadow-md">
                          <div className="w-10 h-10 rounded-full bg-warning-ink text-canvas font-bold text-sm flex items-center justify-center shadow-md shrink-0">
                            3rd
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-warning-ink font-bold">
                              3RD OVERALL • {seriesStandings[2].nettPoints} NETT PTS
                            </div>
                            <div className="font-bold text-ink truncate text-sm">
                              {seriesStandings[2].boatName}
                            </div>
                            <div className="text-xs text-ink-muted">
                              {seriesStandings[2].sailNumber} • {seriesStandings[2].skipper} ({seriesStandings[2].class})
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Overall Series Table */}
                  <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
                    <div className="px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2 bg-surface">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-warning-ink" />
                        <span className="text-xs font-bold text-ink">
                          Official Series Leaderboard ({selectedClass} Class)
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs">
                        {discardRule !== 'NONE' && (
                          <span className="text-success-ink hidden md:inline">
                            *Values in (brackets) indicate discarded scores
                          </span>
                        )}
                        {appViewMode !== 'SPECTATOR' && (
                          <button
                            onClick={() => setShowSeriesManagerDialog(true)}
                            className="text-ink-muted hover:text-warning-ink flex items-center gap-1 transition-colors"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Series Options ({classSeriesRaces.length} Races)</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-line text-ink-muted text-xs bg-canvas">
                            <th className="py-3 pl-3">Rank</th>
                            <th className="py-3">Sail / Boat</th>
                            <th className="py-3">Class</th>
                            <th className="py-3">Skipper</th>
                            <th className="py-3 text-right">Rating</th>
                            {classSeriesRaces.map((r) => (
                              <th key={r.id} className="py-3 text-center px-2">
                                <span className="hover:text-accent cursor-pointer" onClick={() => setActiveTab(r.id)}>
                                  R{r.raceNumber}
                                </span>
                              </th>
                            ))}
                            <th className="py-3 text-right">Total Pts</th>
                            <th className="py-3 text-right pr-4 font-bold text-warning-ink">Nett Pts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          {seriesStandings.map((standing, idx) => {
                            const isLeader = standing.seriesRank === 1;

                            return (
                              <tr
                                key={standing.boatId}
                                className={`hover:bg-raised/40 transition-colors ${
                                  isLeader ? 'bg-warning-ink/5 font-semibold text-ink' : 'text-ink'
                                }`}
                              >
                                <td className="py-3 pl-3">
                                  <span
                                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                      idx === 0
                                        ? 'bg-warning-ink text-canvas shadow-md '
                                        : idx === 1
                                        ? 'bg-ink text-canvas'
                                        : idx === 2
                                        ? 'bg-warning-ink text-canvas'
                                        : 'bg-raised text-ink-muted'
                                    }`}
                                  >
                                    {standing.seriesRank}
                                  </span>
                                </td>

                                <td className="py-3">
                                  <div className="font-bold text-ink flex items-center gap-1.5">
                                    <span className="text-accent">{standing.sailNumber}</span>
                                    <span>{standing.boatName}</span>
                                  </div>
                                </td>

                                <td className="py-3">
                                  <span className="px-2 py-0.5 rounded bg-raised text-ink-muted text-xs">
                                    {standing.class}
                                  </span>
                                </td>

                                <td className="py-3 text-ink-muted">{standing.skipper}</td>

                                <td className="py-3 text-right text-ink-muted">
                                  {safeFixed(standing.handicapRating, 3, '1.000')}
                                </td>

                                {/* Individual Race Score Columns */}
                                {classSeriesRaces.map((race) => {
                                  const score = scoreForRace(standing, race);
                                  return (
                                  <td key={race.id} className="py-3 text-center px-2">
                                    {!score ? (
                                      <span className="text-ink-muted">–</span>
                                    ) : score.isDiscarded ? (
                                      <span
                                        className="px-1.5 py-0.5 rounded bg-surface/40 text-danger-ink/70 line-through text-xs border border-danger-ink/30"
                                        title="Discarded worst race"
                                      >
                                        ({safeFixed(score.points, 1)})
                                      </span>
                                    ) : (
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                                          score.rank === 1
                                            ? 'bg-warning-ink/20 text-warning-ink border border-warning-ink/40'
                                            : 'bg-raised text-ink'
                                        }`}
                                      >
                                        {safeFixed(score.points, 1)}
                                      </span>
                                    )}
                                  </td>
                                  );
                                })}

                                <td className="py-3 text-right text-ink-muted">
                                  {safeFixed(standing.totalPoints, 1)}
                                </td>

                                <td className="py-3 text-right pr-4 font-bold text-base text-success-ink">
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
              <div className="p-3.5 bg-surface border border-line rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">
                      {isViewingLiveRace
                        ? 'Active Fleet Telemetry & Live Mark Splits'
                        : selectedHistoricalRace?.raceTitle || `Race ${selectedHistoricalRace?.raceNumber} Results`}
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Wind: {isViewingLiveRace ? raceState.windSpeedKt : selectedHistoricalRace?.windSpeedKt || 14} kt @ {isViewingLiveRace ? raceState.windDirectionDeg : selectedHistoricalRace?.windDirectionDeg || 210}° • Low Point System • {isViewingLiveRace ? liveFilteredBoats.length : sortedHistoricalResults.length} Competitors
                    </p>
                  </div>
                </div>
              </div>

              {/* Individual Race Standings & Mark Roundings Table */}
              <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-line text-ink-muted text-xs bg-canvas">
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
                    <tbody className="divide-y divide-line/60">
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
                              className={`hover:bg-raised/40 transition-colors ${
                                isWinner ? 'bg-warning-ink/5 font-semibold text-ink' : 'text-ink'
                              }`}
                            >
                              {/* Expand/Collapse Toggle Button */}
                              <td className="py-3 pl-3">
                                <button
                                  onClick={() => toggleBoatSplit(boatId)}
                                  className="p-1 rounded hover:bg-raised text-accent transition-colors"
                                  title="View detailed mark roundings & split times"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-warning-ink" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
                                  )}
                                </button>
                              </td>

                              {/* Rank */}
                              <td className="py-3 pl-1">
                                {isFinished ? (
                                  <span
                                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                      idx === 0
                                        ? 'bg-warning-ink text-canvas shadow-md '
                                        : idx === 1
                                        ? 'bg-ink text-canvas'
                                        : idx === 2
                                        ? 'bg-warning-ink text-canvas'
                                        : 'bg-raised text-ink-muted'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                ) : (
                                  <span className="text-ink-muted pl-2">-</span>
                                )}
                              </td>

                              {/* Sail & Boat Name */}
                              <td className="py-3">
                                <div className="font-bold text-ink flex items-center gap-1.5">
                                  <span className="text-accent">{sailNumber}</span>
                                  <span>{boatName}</span>
                                </div>
                              </td>

                              {/* Class */}
                              <td className="py-3">
                                <span className="px-2 py-0.5 rounded bg-raised text-ink-muted text-xs">
                                  {boatClass}
                                </span>
                              </td>

                              {/* Skipper */}
                              <td className="py-3 text-ink-muted">{skipper}</td>

                              {/* Status Badge */}
                              <td className="py-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    status === 'FINISHED'
                                      ? 'bg-success-ink/20 text-success-ink border border-success-ink/40'
                                      : status === 'RACING'
                                      ? 'bg-accent/20 text-accent border border-accent/40 '
                                      : status === 'PRE_START'
                                      ? 'bg-warning-ink/20 text-warning-ink border border-warning-ink/40'
                                      : 'bg-danger/20 text-danger-ink border border-danger-ink/40'
                                  }`}
                                >
                                  {status}
                                </span>
                              </td>

                              {/* Elapsed Time */}
                              <td className="py-3 text-right text-ink">
                                {status === 'FINISHED' ? formatTime(elapsedSec) : '-'}
                              </td>

                              {/* Handicap Rating */}
                              <td className="py-3 text-right text-ink-muted">
                                {safeFixed(handicapRating, 3, '1.000')}
                              </td>

                              {/* Corrected Time */}
                              <td className="py-3 text-right font-bold text-ink">
                                {status === 'FINISHED' ? formatTime(correctedSec) : '-'}
                              </td>

                              {/* Delta from Winner */}
                              <td className="py-3 text-right text-ink-muted">
                                {isFinished && idx > 0 ? (
                                  <span className="text-warning-ink/90">
                                    +{formatTime(Math.round(deltaSec))}
                                  </span>
                                ) : isFinished && idx === 0 ? (
                                  <span className="text-success-ink font-bold">WINNER</span>
                                ) : (
                                  '-'
                                )}
                              </td>

                              {/* World Sailing Low Point Score */}
                              <td className="py-3 text-right pr-3 font-bold text-success-ink text-sm">
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
                                    className="bg-surface border border-line text-xs text-accent rounded px-1.5 py-0.5 focus:outline-none focus:border-accent"
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
                              <tr className="bg-canvas/80 border-b border-line/40">
                                <td colSpan={12} className="py-3 px-4 sm:px-6">
                                  <div className="bg-surface border border-line rounded-xl p-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-accent font-bold flex items-center gap-1.5">
                                        <Navigation className="w-3.5 h-3.5" />
                                        Official Mark Rounding Splits for {boatName} ({sailNumber})
                                      </span>
                                      <span className="text-ink-muted">
                                        Total Marks Rounded: {markRoundings.length}
                                      </span>
                                    </div>

                                    {markRoundings.length === 0 ? (
                                      <p className="text-xs text-ink-muted italic">
                                        No mark roundings logged yet on course.
                                      </p>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                                        {markRoundings.map((mr: any, mIdx: number) => (
                                          <div
                                            key={mIdx}
                                            className="bg-canvas border border-line rounded-lg p-2.5 space-y-1"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-bold text-ink">
                                                Leg {mIdx + 1}: {mr.markName}
                                              </span>
                                              <span className="text-xs text-warning-ink bg-warning-ink/10 px-1 rounded">
                                                #{mIdx + 1}
                                              </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1 pt-1">
                                              <div>
                                                <div className="text-xs text-ink-muted">Elapsed At</div>
                                                <div className="text-xs text-ink">
                                                  {formatTime(mr.elapsedAtSec || 0)}
                                                </div>
                                              </div>
                                              <div>
                                                <div className="text-xs text-ink-muted">Leg Duration</div>
                                                <div className="text-xs font-bold text-success-ink">
                                                  +{formatTime(mr.legDurationSec || 0)}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-1 border-t border-line/50 text-xs text-ink-muted">
                                              <span>Avg Speed: <strong className="text-ink">{mr.legSpeedKt || 7.5} kt</strong></span>
                                              <span className="text-success-ink flex items-center gap-0.5">
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
        <div className="p-3.5 sm:p-4 border-t border-line bg-canvas/90 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
          <div className="flex items-center gap-3 flex-wrap">
            <span>Wind: {raceState.windSpeedKt} kt @ {raceState.windDirectionDeg}°</span>
            <span>•</span>
            <span>Total Fleet: {boats.length} boats</span>
            <span>•</span>
            <span>Series Races: {seriesRaces.length} Completed</span>
          </div>

          <div className="flex items-center gap-3 ml-auto flex-wrap">
            <span className="hidden sm:inline text-right text-xs text-ink-muted">
              World Sailing RRS Appendix A Scoring Engine • Automatic Finish & Mark Leg Splits
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-raised hover:bg-raised text-ink hover:text-ink text-xs font-bold transition-all ml-auto"
            >
              Close
            </button>
          </div>
        </div>

      </DialogFrame>

      {/* ========================================================= */}
      {/* DIALOG 1: SAVE LIVE RACE SNAPSHOT TO SERIES */}
      {/* ========================================================= */}
      {showSaveDialog && (
        <DialogFrame
          onClose={() => setShowSaveDialog(false)}
          labelledBy={saveTitleId}
          overlayClassName="fixed inset-0 z-60 flex items-center justify-center p-4 bg-canvas/70 backdrop-blur-sm"
          className="bg-surface border border-line rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4 text-ink"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-ink font-bold text-base">
              <Save className="w-5 h-5 text-accent" />
              <h3 id={saveTitleId}>Save Race to Series</h3>
            </div>
            <button
              aria-label="Close"
              onClick={() => setShowSaveDialog(false)}
              className="p-1 rounded-lg text-ink-muted hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-ink-muted">
            Save the current fleet elapsed times, corrected scores, and mark roundings as <strong>Race {nextRaceNum}</strong> in the regatta series.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs text-ink">Race Title / Course Name:</label>
            <input
              type="text"
              value={customRaceTitle}
              placeholder={`Race ${nextRaceNum}: Harbour Passage & Windward Leg`}
              onChange={(e) => setCustomRaceTitle(e.target.value)}
              className="w-full bg-canvas border border-line rounded-xl px-3 py-2 text-xs text-ink focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-3 py-1.5 rounded-xl bg-raised hover:bg-raised text-xs text-ink-muted hover:text-ink transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCurrentRace}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-accent to-accent hover:from-accent hover:to-accent text-canvas font-bold text-xs transition-all shadow-md"
            >
              Confirm & Save Race {nextRaceNum}
            </button>
          </div>
        </DialogFrame>
      )}

      {/* ========================================================= */}
      {/* DIALOG 2: DELETE PARTICULAR RACE CONFIRMATION */}
      {/* ========================================================= */}
      {raceToDelete && (
        <DialogFrame
          onClose={() => setRaceToDelete(null)}
          labelledBy={deleteTitleId}
          role="alertdialog"
          overlayClassName="fixed inset-0 z-60 flex items-center justify-center p-4 bg-canvas/75 backdrop-blur-sm"
          className="bg-surface border border-danger-ink/50 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4 text-ink"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-danger-ink font-bold text-base">
              <Trash2 className="w-5 h-5" />
              <h3 id={deleteTitleId}>Delete Race {raceToDelete.raceNumber}?</h3>
            </div>
            <button
              aria-label="Close"
              onClick={() => setRaceToDelete(null)}
              className="p-1 rounded-lg text-ink-muted hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 bg-canvas rounded-xl border border-line space-y-1">
            <div className="text-xs font-bold text-ink">
              {raceToDelete.raceTitle || `Race ${raceToDelete.raceNumber}`}
            </div>
            <div className="text-xs text-ink-muted">
              {raceToDelete.results?.length || 0} boat finish results • Wind: {raceToDelete.windSpeedKt} kt @ {raceToDelete.windDirectionDeg}°
            </div>
          </div>

          <p className="text-xs text-ink-muted">
            Are you sure you want to permanently remove this race from the regatta series? Overall series points, podium standings, and discard calculations will update immediately.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setRaceToDelete(null)}
              className="px-3 py-1.5 rounded-xl bg-raised hover:bg-raised text-xs text-ink-muted hover:text-ink transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDeleteRace}
              className="px-4 py-1.5 rounded-xl bg-danger hover:brightness-110 text-on-danger font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Race</span>
            </button>
          </div>
        </DialogFrame>
      )}

      {/* ========================================================= */}
      {/* DIALOG 3: REGATTA SERIES MANAGEMENT (NEW / CLEAR SERIES) */}
      {/* ========================================================= */}
      {showSeriesManagerDialog && (
        <DialogFrame
          onClose={() => setShowSeriesManagerDialog(false)}
          labelledBy={seriesTitleId}
          overlayClassName="fixed inset-0 z-60 flex items-center justify-center p-4 bg-canvas/75 backdrop-blur-sm"
          className="bg-surface border border-line rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-5 text-ink max-h-[90vh] overflow-y-auto custom-scrollbar"
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2.5 text-ink font-bold text-base">
              <FolderPlus className="w-5 h-5 text-accent" />
              <h3 id={seriesTitleId}>Regatta Series Management</h3>
            </div>
            <button
              aria-label="Close"
              onClick={() => setShowSeriesManagerDialog(false)}
              className="p-1 rounded-lg text-ink-muted hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Series Summary */}
          <div className="grid grid-cols-3 gap-2 bg-canvas border border-line rounded-xl p-3 text-center">
            <div>
              <div className="text-xs text-ink-muted">Completed Races</div>
              <div className="text-sm font-bold text-accent">{seriesRaces.length}</div>
            </div>
            <div>
              <div className="text-xs text-ink-muted">Participating Fleet</div>
              <div className="text-sm font-bold text-ink">{boats.length} Boats</div>
            </div>
            <div>
              <div className="text-xs text-ink-muted">Discards</div>
              <div className="text-sm font-bold text-success-ink">
                {discardRule === 'NONE' ? 'None' : '1 Drop'}
              </div>
            </div>
          </div>

          {/* Section 1: Start New / Clear Series */}
          <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <Sparkles className="w-4 h-4 text-warning-ink" />
              <h4>Start a New Regatta Series</h4>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Clears all past race results from local storage and starts a fresh series for today's championship round or regatta day.
            </p>

            <label className="flex items-center gap-2 text-xs text-ink cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={resetFleetWithNewSeries}
                onChange={(e) => setResetFleetWithNewSeries(e.target.checked)}
                className="rounded border-line bg-canvas text-accent focus:ring-0"
              />
              <span>Also reset live fleet timers & mark roundings to Race 1</span>
            </label>

            <div className="pt-2">
              <button
                onClick={handleConfirmStartNewSeries}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-danger/80 to-warning-ink/80 hover:from-danger hover:to-warning-ink text-ink font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Clear Historical Races & Start Fresh Series</span>
              </button>
            </div>
          </div>

          {/* Section 2: Manage Existing Races List */}
          {seriesRaces.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-ink flex items-center justify-between">
                <span>Completed Historical Races ({seriesRaces.length})</span>
                <span className="text-xs text-ink-muted">Click trash to remove individual race</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                {seriesRaces.map((r) => (
                  <div
                    key={r.id}
                    className="p-2 bg-canvas border border-line rounded-xl flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-ink truncate">
                        Race {r.raceNumber}{r.raceTitle ? `: ${r.raceTitle}` : ''}
                      </div>
                      <div className="text-xs text-ink-muted">
                        {r.results?.length || 0} finishes • Wind {r.windSpeedKt}kt @ {r.windDirectionDeg}°
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setRaceToDelete(r);
                      }}
                      className="p-1.5 rounded-lg text-danger-ink hover:text-ink hover:bg-danger/50 transition-all shrink-0"
                      title={`Delete Race ${r.raceNumber}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <button
              onClick={() => setShowSeriesManagerDialog(false)}
              className="px-4 py-1.5 rounded-xl bg-raised hover:bg-raised text-xs text-ink-muted hover:text-ink transition-all"
            >
              Close
            </button>
          </div>
        </DialogFrame>
      )}


    </>
  );
};
