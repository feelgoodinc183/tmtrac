import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  QrCode,
  Copy,
  Check,
  Compass,
  Activity,
  Code2,
  Sparkles,
  Share2,
  Tv,
  Play,
  Layout,
  Radio,
  ExternalLink,
  Wind,
  Gauge,
  Layers,
  CheckCircle2,
  Anchor,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Boat, CourseMark, RaceState, RaceHighlightMoment } from '../types/regatta';
import { generateRaceHighlights, generateHighlightReportText } from '../services/highlightService';
import { roomService } from '../services/roomService';

interface SpectatorQrModalProps {
  onClose: () => void;
  onOpenSpectatorView: () => void;
  onOpenRcConsoleView?: () => void;
  onOpenBoatQrs?: () => void;
  currentViewMode?: 'RC_CONSOLE' | 'SPECTATOR';
  boats?: Boat[];
  raceState?: RaceState;
  courseMarks?: CourseMark[];
  onSeekReplay?: (timeSec: number) => void;
}

export const SpectatorQrModal: React.FC<SpectatorQrModalProps> = ({
  onClose,
  onOpenSpectatorView,
  onOpenRcConsoleView,
  onOpenBoatQrs,
  currentViewMode = 'SPECTATOR',
  boats = [],
  raceState,
  courseMarks = [],
  onSeekReplay,
}) => {
  const [activeTab, setActiveTab] = useState<'QR_CODE' | 'REPLAY_HIGHLIGHTS' | 'EMBED_WIDGETS'>('QR_CODE');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Widget customizer states
  const [widgetType, setWidgetType] = useState<'LEADERBOARD' | 'RADAR' | 'TICKER'>('LEADERBOARD');
  const [widgetTheme, setWidgetTheme] = useState<'dark' | 'light' | 'transparent'>('dark');
  const [widgetClass, setWidgetClass] = useState<string>('ALL');

  const shareUrl = typeof window !== 'undefined'
    ? roomService.getShareableLink('spectator')
    : 'https://regatta.marine.app';

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      width: 360,
      margin: 2,
      color: { dark: '#020408', light: '#FFFFFF' },
    })
      .then(setQrDataUrl)
      .catch((err) => console.error('Failed to generate spectator QR:', err));
  }, [shareUrl]);

  // Compute Highlights
  const defaultRaceState: RaceState = raceState || {
    status: 'IN_PROGRESS',
    elapsedSeconds: 1240,
    windSpeedKt: 12.5,
    windDirectionDeg: 0,
    startTime: Date.now() - 1240000,
    activeRaceClass: 'Class 1',
  };

  const highlights: RaceHighlightMoment[] = useMemo(() => {
    return generateRaceHighlights(boats, defaultRaceState, courseMarks);
  }, [boats, defaultRaceState, courseMarks]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyReport = () => {
    const text = generateHighlightReportText(boats, defaultRaceState, highlights);
    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  // Generate Embed Iframe Code
  const embedSnippet = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://regatta.marine.app';
    const params = new URLSearchParams({
      widget: widgetType.toLowerCase(),
      theme: widgetTheme,
      class: widgetClass,
      view: 'spectator',
    });
    const embedUrl = `${origin}?${params.toString()}`;

    const dimensions = {
      LEADERBOARD: { width: '380px', height: '520px' },
      RADAR: { width: '600px', height: '420px' },
      TICKER: { width: '100%', height: '65px' },
    }[widgetType];

    return `<iframe\n  src="${embedUrl}"\n  width="${dimensions.width}"\n  height="${dimensions.height}"\n  style="border:0; border-radius: 16px; overflow: hidden;"\n  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"\n  loading="lazy"\n  title="Live Regatta ${widgetType}"\n></iframe>`;
  }, [widgetType, widgetTheme, widgetClass]);

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-lb-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200 font-google">
      <div className="bg-lb-0a0f1e/95 backdrop-blur-md border border-ll-334155/80 w-full max-w-2xl rounded-3xl landscape:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-lt-e0e6ed max-h-[calc(100vh-80px)] sm:max-h-[90vh] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-0">
        {/* Modal Header */}
        <div className="px-5 py-3.5 landscape:py-2.5 bg-lb-060b16/90 border-b border-ll-1e293b flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-lb-00d4ff/15 border border-ll-00d4ff/40 flex items-center justify-center text-lt-00d4ff shrink-0 shadow-sm">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold tracking-tight text-lt-white truncate">
                Spectator &amp; Media Broadcast Hub
              </h2>
              <p className="text-xs text-lt-64748b font-mono truncate">
                Live QR Tracking &bull; Embeddable Web Widgets &bull; Automated Replays
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-lt-94a3b8 hover:text-lt-white hover:bg-lb-1e293b/80 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-ll-1e293b bg-lb-080d1a p-2 gap-1.5 shrink-0 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('QR_CODE')}
            className={`py-2 px-3.5 rounded-2xl font-mono text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'QR_CODE'
                ? 'bg-lb-00d4ff text-lt-020408 shadow-sm font-extrabold'
                : 'bg-lb-0f172a text-lt-94a3b8 hover:text-lt-white border border-ll-1e293b'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            QR &amp; Mobile Link
          </button>

          <button
            onClick={() => setActiveTab('REPLAY_HIGHLIGHTS')}
            className={`py-2 px-3.5 rounded-2xl font-mono text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'REPLAY_HIGHLIGHTS'
                ? 'bg-lb-fbbc04 text-lt-black shadow-sm font-extrabold'
                : 'bg-lb-0f172a text-lt-94a3b8 hover:text-lt-white border border-ll-1e293b'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-lt-fbbc04" />
            Automated Replay Highlights ({highlights.length})
          </button>

          <button
            onClick={() => setActiveTab('EMBED_WIDGETS')}
            className={`py-2 px-3.5 rounded-2xl font-mono text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'EMBED_WIDGETS'
                ? 'bg-lb-81c995 text-lt-black shadow-sm font-extrabold'
                : 'bg-lb-0f172a text-lt-94a3b8 hover:text-lt-white border border-ll-1e293b'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-lt-81c995" />
            Embeddable Live Widgets
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar space-y-4">
          {/* TAB 1: QR & MOBILE LINK */}
          {activeTab === 'QR_CODE' && (
            <div className="flex flex-col items-center text-center space-y-4 max-w-md mx-auto">
              <div className="p-4 bg-lb-white rounded-3xl shadow-2xl border-4 border-ll-00d4ff/50">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Spectator Regatta QR Code"
                    className="w-40 h-40 sm:w-44 sm:h-44 object-contain block"
                  />
                ) : (
                  <div className="w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center text-lt-black font-mono text-xs">
                    Generating QR...
                  </div>
                )}
              </div>

              <p className="text-xs text-lt-94a3b8 font-mono leading-relaxed">
                Scan with any mobile camera at the marina or yacht club to view live regatta standings, boat vectors, and real-time fleet telemetry without installing an app.
              </p>

              {onOpenBoatQrs && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenBoatQrs();
                  }}
                  className="w-full py-2.5 px-3.5 rounded-2xl bg-lb-00d4ff/15 hover:bg-lb-00d4ff/25 border border-ll-00d4ff/40 text-lt-00d4ff font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Anchor className="w-4 h-4" />
                  <span>Looking for Boat / Skipper QRs? Open Smart Boat QRs</span>
                </button>
              )}

              {/* Link Box */}
              <div className="w-full bg-lb-060b16/80 border border-ll-1e293b rounded-2xl p-3 flex items-center justify-between text-xs font-mono">
                <span className="text-lt-64748b truncate max-w-[200px] sm:max-w-[260px]">{shareUrl}</span>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-lb-00d4ff/20 hover:bg-lb-00d4ff/30 text-lt-00d4ff font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* View Mode Switching Controls */}
              <div className="w-full pt-1 flex flex-col gap-2 text-left">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-mono uppercase tracking-wider text-lt-64748b">
                    Active View Mode
                  </span>
                  <span className="text-xs font-mono font-bold text-lt-00d4ff">
                    {currentViewMode === 'RC_CONSOLE' ? 'RC CONSOLE ACTIVE' : 'SPECTATOR ACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                  <button
                    onClick={() => {
                      onOpenRcConsoleView?.();
                      onClose();
                    }}
                    className={`py-3 px-3 rounded-2xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm border cursor-pointer ${
                      currentViewMode === 'RC_CONSOLE'
                        ? 'bg-lb-1a73e8/25 text-lt-white border-ll-1a73e8 shadow-[0_0_12px_rgba(26,115,232,0.35)]'
                        : 'bg-lb-1a73e8 hover:bg-lb-1557b0 text-lt-white border-transparent'
                    }`}
                  >
                    <Compass className="w-4 h-4 text-lt-fbbc04 shrink-0" />
                    <span>{currentViewMode === 'RC_CONSOLE' ? 'RC Control (Active)' : 'RC Control Mode'}</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenSpectatorView();
                      onClose();
                    }}
                    className={`py-3 px-3 rounded-2xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm border cursor-pointer ${
                      currentViewMode === 'SPECTATOR'
                        ? 'bg-lb-00d4ff/25 text-lt-00d4ff border-ll-00d4ff shadow-[0_0_12px_rgba(0,212,255,0.35)]'
                        : 'bg-lb-00d4ff hover:bg-lb-cyan-300 text-lt-020408 border-transparent'
                    }`}
                  >
                    <Activity className={`w-4 h-4 shrink-0 ${currentViewMode === 'SPECTATOR' ? 'text-lt-00d4ff' : 'text-lt-020408'}`} />
                    <span>{currentViewMode === 'SPECTATOR' ? 'Spectator (Active)' : 'Spectator View Mode'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AUTOMATED REPLAY HIGHLIGHTS */}
          {activeTab === 'REPLAY_HIGHLIGHTS' && (
            <div className="space-y-4">
              <div className="p-4 bg-lb-0f172a rounded-2xl border border-ll-1e293b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-lt-white flex items-center gap-2 font-mono">
                    <Sparkles className="w-4 h-4 text-lt-fbbc04" />
                    Automated Tactical Race Highlights Generator
                  </h3>
                  <p className="text-xs text-lt-94a3b8 font-mono mt-0.5">
                    Algorithmically detects start gun charges, mark rounding overlaps, downwind splits &amp; photo-finishes.
                  </p>
                </div>

                <button
                  onClick={handleCopyReport}
                  className="px-4 py-2 bg-lb-fbbc04 hover:bg-lb-amber-300 text-lt-black font-mono font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                >
                  {copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReport ? 'Report Copied!' : 'Copy Press Recap'}</span>
                </button>
              </div>

              {/* Highlights List */}
              <div className="space-y-2.5">
                {highlights.map((hl) => {
                  const sec = hl.timestampSec ?? hl.timeSec ?? 0;
                  const mins = Math.floor(sec / 60);
                  const secs = (sec % 60).toString().padStart(2, '0');
                  return (
                    <div
                      key={hl.id}
                      className="p-3.5 bg-lb-060b16 rounded-2xl border border-ll-1e293b hover:border-ll-00d4ff/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-lb-0f172a border border-ll-1e293b flex flex-col items-center justify-center text-center shrink-0">
                          <span className="text-xs text-lt-64748b">TIME</span>
                          <span className="text-xs font-bold text-lt-fbbc04">{mins}:{secs}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-lt-white font-google">{hl.title}</span>
                            <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${hl.badgeColor || 'bg-lb-blue-500/20 text-lt-blue-400 border-ll-blue-500/30'}`}>
                              {(hl.type || 'HIGHLIGHT').replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-lt-94a3b8 mt-1 leading-relaxed">{hl.description}</p>
                        </div>
                      </div>

                      {onSeekReplay && (
                        <button
                          onClick={() => {
                            onSeekReplay(sec);
                            onClose();
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-lb-00d4ff/15 hover:bg-lb-00d4ff/25 border border-ll-00d4ff/40 text-lt-00d4ff font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Jump to Replay</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: EMBEDDABLE LIVE WIDGETS */}
          {activeTab === 'EMBED_WIDGETS' && (
            <div className="space-y-4">
              {/* Controls Grid */}
              <div className="p-4 bg-lb-0f172a rounded-2xl border border-ll-1e293b space-y-3">
                <span className="text-xs font-mono font-bold text-lt-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-lt-81c995" />
                  Embeddable Regatta Widget Generator
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  {/* Widget Variety Selector */}
                  <div>
                    <label className="text-xs uppercase text-lt-64748b block mb-1">Widget Format</label>
                    <select
                      value={widgetType}
                      onChange={(e) => setWidgetType(e.target.value as any)}
                      className="w-full bg-lb-060b16 border border-ll-1e293b rounded-xl p-2 text-lt-white outline-none focus:border-ll-81c995"
                    >
                      <option value="LEADERBOARD">Live Leaderboard Card</option>
                      <option value="RADAR">Tactical Course Radar</option>
                      <option value="TICKER">Broadcast Ticker (OBS / TV)</option>
                    </select>
                  </div>

                  {/* Theme Selector */}
                  <div>
                    <label className="text-xs uppercase text-lt-64748b block mb-1">Color Theme</label>
                    <select
                      value={widgetTheme}
                      onChange={(e) => setWidgetTheme(e.target.value as any)}
                      className="w-full bg-lb-060b16 border border-ll-1e293b rounded-xl p-2 text-lt-white outline-none focus:border-ll-81c995"
                    >
                      <option value="dark">Dark Nautical</option>
                      <option value="light">Light Yacht Club</option>
                      <option value="transparent">Transparent (OBS Overlay)</option>
                    </select>
                  </div>

                  {/* Class Filter */}
                  <div>
                    <label className="text-xs uppercase text-lt-64748b block mb-1">Fleet Division</label>
                    <select
                      value={widgetClass}
                      onChange={(e) => setWidgetClass(e.target.value)}
                      className="w-full bg-lb-060b16 border border-ll-1e293b rounded-xl p-2 text-lt-white outline-none focus:border-ll-81c995"
                    >
                      <option value="ALL">All Classes Combined</option>
                      <option value="Class 1">Class 1 (IRC Racing)</option>
                      <option value="Class 2">Class 2 (Cruising)</option>
                      <option value="Class 3">Class 3 (Sportsboat)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Live Interactive Sandbox Preview */}
              <div className="space-y-2">
                <span className="text-xs font-mono uppercase text-lt-64748b block">
                  Interactive Live Preview Sandbox ({widgetType})
                </span>

                {/* Preview Frame */}
                <div
                  className={`p-4 rounded-2xl border transition-all ${
                    widgetTheme === 'light'
                      ? 'bg-lb-slate-100 border-ll-slate-300 text-lt-slate-900'
                      : widgetTheme === 'transparent'
                      ? 'bg-lb-slate-900/60 backdrop-blur-md border-ll-cyan-500/40 text-lt-white'
                      : 'bg-lb-060b16 border-ll-1e293b text-lt-white'
                  }`}
                >
                  {/* PREVIEW: LEADERBOARD */}
                  {widgetType === 'LEADERBOARD' && (
                    <div className="space-y-2 font-mono text-xs max-w-sm mx-auto">
                      <div className="flex items-center justify-between pb-1.5 border-b border-ll-white/10">
                        <span className="font-bold flex items-center gap-1.5 text-lt-00d4ff">
                          <Activity className="w-3.5 h-3.5" />
                          Live Leaderboard
                        </span>
                        <span className="text-xs text-lt-green-400 font-bold animate-pulse">● LIVE 1s</span>
                      </div>
                      {boats.slice(0, 4).map((b, idx) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-lb-white/5 border border-ll-white/10"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 font-bold text-lt-slate-400">#{idx + 1}</span>
                            <div>
                              <div className="font-bold truncate">{b.name}</div>
                              <div className="text-xs text-lt-slate-400">{b.sailNumber}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lt-00ff9d">{Number(b.speedKt ?? b.sog ?? 0).toFixed(1)} kt</div>
                            <div className="text-xs text-lt-slate-400">{b.tack}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* PREVIEW: RADAR MAP */}
                  {widgetType === 'RADAR' && (
                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-ll-white/10">
                        <span className="font-bold flex items-center gap-1.5 text-lt-00d4ff">
                          <Compass className="w-3.5 h-3.5" />
                          Tactical Course Radar (Mini-Map)
                        </span>
                        <span className="text-xs text-lt-slate-400">Wind: {defaultRaceState.windSpeedKt}kt @ {defaultRaceState.windDirectionDeg}°</span>
                      </div>
                      <div className="relative h-44 bg-lb-0a0f1e rounded-xl border border-ll-cyan-500/20 overflow-hidden flex items-center justify-center">
                        {/* Simulated concentric range rings */}
                        <div className="absolute w-32 h-32 rounded-full border border-ll-cyan-500/20" />
                        <div className="absolute w-20 h-20 rounded-full border border-ll-cyan-500/30" />
                        <div className="absolute w-8 h-8 rounded-full border border-ll-cyan-500/40" />
                        {/* Course Marks */}
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-lb-orange-500 text-lt-black text-xs font-bold">
                          Windward Mark 1
                        </div>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-lb-blue-500 text-lt-white text-xs font-bold">
                          Start / RC Vessel
                        </div>
                        {/* Boats Markers */}
                        <div className="absolute top-16 left-28 w-3 h-3 rounded-full bg-lb-00d4ff animate-pulse" title="MAS 77" />
                        <div className="absolute top-20 left-36 w-3 h-3 rounded-full bg-lb-00ff9d" title="SIN 88" />
                        <div className="absolute top-24 left-24 w-3 h-3 rounded-full bg-lb-fbbc04" title="THA 12" />
                      </div>
                    </div>
                  )}

                  {/* PREVIEW: TICKER (TV / OBS LOWER-THIRD) */}
                  {widgetType === 'TICKER' && (
                    <div className="p-2 flex items-center justify-between gap-4 font-mono text-xs overflow-x-auto custom-scrollbar">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-lb-red-600 text-lt-white font-bold text-xs animate-pulse">
                          LIVE TV
                        </span>
                        <span className="text-lt-white font-bold truncate">LANGKAWI REGATTA</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        <span className="text-lt-00d4ff">
                          1ST: <strong className="text-lt-white">{boats[0]?.name || 'Leader'}</strong> ({Number(boats[0]?.speedKt ?? boats[0]?.sog ?? 7.2).toFixed(1)}kt)
                        </span>
                        <span className="text-lt-slate-400">&bull;</span>
                        <span className="text-lt-00ff9d">
                          2ND: <strong className="text-lt-white">{boats[1]?.name || 'Challenger'}</strong> (+0.3 kt)
                        </span>
                        <span className="text-lt-slate-400">&bull;</span>
                        <span className="text-lt-fbbc04">WIND: {defaultRaceState.windSpeedKt} kt @ {defaultRaceState.windDirectionDeg}°</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Code Snippet Box */}
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-lt-64748b uppercase">HTML Iframe Embed Code</span>
                  <button
                    onClick={handleCopyEmbed}
                    className="text-xs text-lt-81c995 hover:text-lt-green-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedEmbed ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedEmbed ? 'Snippet Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
                <div className="p-3 bg-lb-060b16 rounded-2xl border border-ll-1e293b text-lt-94a3b8 font-mono text-xs overflow-x-auto custom-scrollbar">
                  <pre>{embedSnippet}</pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-lb-060b16/95 border-t border-ll-1e293b flex items-center justify-between">
          <span className="text-xs text-lt-64748b font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-lt-81c995" />
            Responsive across all devices &amp; screen orientations
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-lb-00d4ff hover:bg-lb-cyan-300 text-lt-020408 font-mono font-bold text-xs transition-all cursor-pointer shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
