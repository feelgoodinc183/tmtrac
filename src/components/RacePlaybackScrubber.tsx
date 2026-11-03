import React from 'react';
import { RacePlaybackState, RaceHighlightMoment } from '../types/regatta';
import { Play, Pause, RotateCcw, FastForward, Rewind, Clock, Activity, X, Sparkles, Flag } from 'lucide-react';

interface RacePlaybackScrubberProps {
  playback: RacePlaybackState;
  highlights?: RaceHighlightMoment[];
  onTogglePlay: () => void;
  onSetSpeed: (speed: 1 | 2 | 5 | 10) => void;
  onSeek: (timeSec: number) => void;
  onReset: () => void;
  onClose?: () => void;
}

export const RacePlaybackScrubber: React.FC<RacePlaybackScrubberProps> = ({
  playback,
  highlights = [],
  onTogglePlay,
  onSetSpeed,
  onSeek,
  onReset,
  onClose,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min(
    100,
    Math.max(0, (playback.currentTimeSec / (playback.maxDurationSec || 1800)) * 100)
  );

  const handleStep = (deltaSec: number) => {
    const next = Math.max(0, Math.min(playback.maxDurationSec, playback.currentTimeSec + deltaSec));
    onSeek(next);
  };

  if (playback.maxDurationSec <= 0) {
    return (
      <div className="fixed md:static bottom-16 md:bottom-auto left-0 right-0 z-40 bg-[#0A0F1E] border-t border-[#1E293B] text-[#E0E6ED] shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-[#94A3B8]">
            <span className="font-semibold text-[#E0E6ED]">Nothing to replay yet.</span> The replay appears once boats have
            raced and sent positions.
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="shrink-0 min-h-[40px] px-3 rounded-lg bg-[#1E293B] hover:bg-[#334155] text-sm font-semibold"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed md:static bottom-16 md:bottom-auto left-0 right-0 z-40 bg-[#0A0F1E]/95 border-t border-[#1E293B] shadow-[0_-8px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl text-[#E0E6ED] shrink-0 animate-in slide-in-from-bottom-4 duration-200">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 py-2 sm:py-3 space-y-1.5">
        {/* MOBILE PORTRAIT VIEW (< 640px vertical) */}
        <div className="flex flex-col gap-2 sm:hidden">
          {/* Row 1: Status badge, Speed selector pills & Close button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#FFB800] animate-pulse shrink-0" />
              <span className="text-[11px] font-mono font-bold text-[#FFB800] tracking-wider uppercase truncate">
                Replay
              </span>
              <span className="text-slate-600 text-xs">•</span>
              <span className="text-xs font-mono font-bold text-[#00D4FF]">
                {formatTime(playback.currentTimeSec)}
              </span>
              <span className="text-[10px] font-mono text-[#64748B]">
                / {formatTime(playback.maxDurationSec)}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Speed Buttons */}
              <div className="flex items-center bg-[#060B16] border border-[#1E293B] rounded-lg p-0.5">
                {([1, 2, 5, 10] as const).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => onSetSpeed(spd)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded transition-all ${
                      playback.speedMultiplier === spd
                        ? 'bg-[#00D4FF] text-black shadow-xs font-extrabold'
                        : 'text-[#64748B] hover:text-white'
                    }`}
                    title={`Replay Speed: ${spd}x`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Close Button */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg bg-[#1E293B] hover:bg-slate-700 text-[#94A3B8] hover:text-white transition-all ml-1"
                  title="Close Replay Scrubber"
                  aria-label="Close Replay"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Play/Pause, Rewind, Fast Forward & Interactive Range Slider */}
          <div className="flex items-center gap-2">
            {/* Reset to Start */}
            <button
              onClick={onReset}
              className="p-1.5 rounded-lg bg-[#060B16] border border-[#1E293B] text-[#94A3B8] hover:text-white active:scale-95 transition-all shrink-0"
              title="Reset to Race Start (00:00)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Step Back -15s */}
            <button
              onClick={() => handleStep(-15)}
              className="p-1.5 rounded-lg bg-[#060B16] border border-[#1E293B] text-[#94A3B8] hover:text-white active:scale-95 transition-all shrink-0"
              title="Rewind 15 seconds"
            >
              <Rewind className="w-3.5 h-3.5" />
            </button>

            {/* Play / Pause Toggle */}
            <button
              onClick={onTogglePlay}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 shadow-sm ${
                playback.isPlaying
                  ? 'bg-[#FF4D4D] text-black hover:bg-red-400'
                  : 'bg-[#FFB800] text-black hover:bg-amber-300'
              }`}
              title={playback.isPlaying ? 'Pause Replay' : 'Play Replay'}
            >
              {playback.isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{playback.isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            {/* Step Forward +15s */}
            <button
              onClick={() => handleStep(15)}
              className="p-1.5 rounded-lg bg-[#060B16] border border-[#1E293B] text-[#94A3B8] hover:text-white active:scale-95 transition-all shrink-0"
              title="Forward 15 seconds"
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>

            {/* Range Scrubber Track */}
            <div className="relative flex-1 flex items-center min-w-0">
              <input
                type="range"
                min="0"
                max={playback.maxDurationSec}
                step="1"
                value={playback.currentTimeSec}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                className="w-full h-2.5 bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-[#00D4FF] focus:outline-none"
              />
              <div
                className="absolute left-0 h-2.5 bg-[#00D4FF] rounded-lg pointer-events-none transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
              {/* Highlights dots on slider */}
              {highlights.map((hl) => {
                const pos = Math.min(100, Math.max(0, (hl.timestampSec / (playback.maxDurationSec || 1800)) * 100));
                return (
                  <button
                    key={hl.id}
                    onClick={() => onSeek(hl.timestampSec)}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#FBBC04] border border-black z-10 hover:scale-150 transition-all cursor-pointer shadow-sm"
                    style={{ left: `${pos}%` }}
                    title={hl.title}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* TABLET / DESKTOP & MOBILE HORIZONTAL / LANDSCAPE (sm:flex) */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Playback Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onReset}
              title="Reset Replay to Race Start (00:00)"
              className="p-2 rounded-xl bg-[#060B16] border border-[#1E293B] hover:border-[#00D4FF]/50 text-[#94A3B8] hover:text-white transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleStep(-15)}
              title="Rewind 15 seconds"
              className="p-2 rounded-xl bg-[#060B16] border border-[#1E293B] hover:border-[#00D4FF]/50 text-[#94A3B8] hover:text-white transition-all active:scale-95"
            >
              <Rewind className="w-4 h-4" />
            </button>

            <button
              onClick={onTogglePlay}
              className={`py-2 px-3.5 sm:px-4 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 active:scale-95 ${
                playback.isPlaying
                  ? 'bg-[#FF4D4D] text-black shadow-[0_0_12px_rgba(255,77,77,0.4)] hover:bg-red-400'
                  : 'bg-[#FFB800] text-black shadow-[0_0_12px_rgba(255,184,0,0.4)] hover:bg-amber-300'
              }`}
              title={playback.isPlaying ? 'Pause Race Replay' : 'Play Historical Race Replay'}
            >
              {playback.isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              <span>{playback.isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <button
              onClick={() => handleStep(15)}
              title="Fast Forward 15 seconds"
              className="p-2 rounded-xl bg-[#060B16] border border-[#1E293B] hover:border-[#00D4FF]/50 text-[#94A3B8] hover:text-white transition-all active:scale-95"
            >
              <FastForward className="w-4 h-4" />
            </button>

            {/* Speed Selectors */}
            <div className="flex items-center bg-[#060B16] border border-[#1E293B] rounded-xl p-0.5">
              {([1, 2, 5, 10] as const).map((spd) => (
                <button
                  key={spd}
                  onClick={() => onSetSpeed(spd)}
                  className={`px-2 sm:px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg transition-all ${
                    playback.speedMultiplier === spd
                      ? 'bg-[#00D4FF] text-black shadow-xs font-extrabold'
                      : 'text-[#64748B] hover:text-white'
                  }`}
                  title={`Playback Speed: ${spd}x`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Scrubber Slider */}
          <div className="flex-1 w-full flex items-center gap-2.5">
            <span className="text-xs font-mono text-[#00D4FF] font-bold shrink-0 w-11 text-right">
              {formatTime(playback.currentTimeSec)}
            </span>

            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min="0"
                max={playback.maxDurationSec}
                step="1"
                value={playback.currentTimeSec}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                className="w-full h-2.5 bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-[#00D4FF] focus:outline-none"
              />
              {/* Visual Progress Bar Highlight */}
              <div
                className="absolute left-0 h-2.5 bg-[#00D4FF] rounded-lg pointer-events-none transition-all duration-75"
                style={{ width: `${progressPercent}%` }}
              />
              {/* Highlights markers on slider */}
              {highlights.map((hl) => {
                const pos = Math.min(100, Math.max(0, (hl.timestampSec / (playback.maxDurationSec || 1800)) * 100));
                return (
                  <button
                    key={hl.id}
                    onClick={() => onSeek(hl.timestampSec)}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#FBBC04] border border-black z-10 hover:scale-150 transition-all cursor-pointer shadow-sm"
                    style={{ left: `${pos}%` }}
                    title={`${hl.title} (${formatTime(hl.timestampSec)})`}
                  />
                );
              })}
            </div>

            <span className="text-xs font-mono text-[#64748B] shrink-0 w-11">
              {formatTime(playback.maxDurationSec)}
            </span>
          </div>

          {/* Telemetry Indicator & Close Drawer Button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-mono text-[#00FF9D] bg-[#00FF9D]/10 border border-[#00FF9D]/30 px-2.5 py-1.5 rounded-xl">
              <Activity className="w-3.5 h-3.5" />
              <span>DEAD RECKONING</span>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-[#060B16] hover:bg-[#1E293B] border border-[#1E293B] text-[#94A3B8] hover:text-white transition-all ml-1"
                title="Close Replay Scrubber"
                aria-label="Close Replay"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Highlights Quick-Jump Bar (Horizontal Scroll on Mobile/Tablet) */}
        {highlights.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pt-0.5 pb-0.5">
            <span className="text-[10px] font-mono uppercase text-[#64748B] shrink-0 flex items-center gap-1 font-bold">
              <Sparkles className="w-3 h-3 text-[#FBBC04]" />
              Key Moments:
            </span>
            {highlights.map((hl) => (
              <button
                key={hl.id}
                onClick={() => onSeek(hl.timestampSec)}
                className="px-2 py-0.5 rounded-lg bg-[#060B16] hover:bg-[#1E293B] border border-[#1E293B] hover:border-[#00D4FF]/40 text-[10px] font-mono text-slate-300 hover:text-white shrink-0 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="text-[#FBBC04] font-bold">
                  {formatTime(hl.timestampSec)}
                </span>
                <span className="truncate max-w-[110px] sm:max-w-[160px]">{hl.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

