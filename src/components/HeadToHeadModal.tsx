import React from 'react';
import { Boat } from '../types/regatta';
import { X, Swords, Compass, Wind, Award, Zap } from 'lucide-react';
import { safeFixed } from '../utils/formatters';

interface HeadToHeadModalProps {
  boat1: Boat;
  boat2: Boat;
  onClose: () => void;
}

export const HeadToHeadModal: React.FC<HeadToHeadModalProps> = ({
  boat1,
  boat2,
  onClose,
}) => {
  const sog1 = boat1.sog ?? 0;
  const sog2 = boat2.sog ?? 0;
  const vmg1 = boat1.vmg ?? 0;
  const vmg2 = boat2.vmg ?? 0;
  const speedDiff = sog1 - sog2;
  const vmgDiff = vmg1 - vmg2;
  const correctedTimeDiff = (boat1.correctedSeconds || 0) - (boat2.correctedSeconds || 0);

  // Approximate distance between boats
  const distNm = Math.sqrt(
    Math.pow(((boat1.lat || 0) - (boat2.lat || 0)) * 60, 2) +
      Math.pow(((boat1.lng || 0) - (boat2.lng || 0)) * 60 * Math.cos(((boat1.lat || 0) * Math.PI) / 180), 2)
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#020408]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0A0F1E] border border-[#1E293B] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#E0E6ED]">
        {/* Header */}
        <div className="p-4 bg-[#060B16] border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-[#00D4FF]" />
            <h2 className="text-base font-bold tracking-tight">
              Head-to-Head Telemetry Comparison
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#64748B] hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Body */}
        <div className="p-6 space-y-6">
          {/* Boat Cards Side-by-Side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Boat 1 */}
            <div className="bg-[#060B16] p-4 rounded-xl border border-[#00D4FF]/30 flex flex-col items-center text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-[#020408] mb-2 shadow-lg"
                style={{ backgroundColor: boat1.color }}
              >
                1
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">{boat1.name}</h3>
              <p className="text-xs text-[#00D4FF] font-mono">{boat1.sailNumber}</p>
              <div className="mt-2 text-[10px] text-[#94A3B8] font-mono bg-[#1E293B] px-2 py-0.5 rounded">
                {boat1.handicapSystem} {boat1.handicapRating}
              </div>
            </div>

            {/* Boat 2 */}
            <div className="bg-[#060B16] p-4 rounded-xl border border-[#38BDF8]/30 flex flex-col items-center text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-[#020408] mb-2 shadow-lg"
                style={{ backgroundColor: boat2.color }}
              >
                2
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">{boat2.name}</h3>
              <p className="text-xs text-[#38BDF8] font-mono">{boat2.sailNumber}</p>
              <div className="mt-2 text-[10px] text-[#94A3B8] font-mono bg-[#1E293B] px-2 py-0.5 rounded">
                {boat2.handicapSystem} {boat2.handicapRating}
              </div>
            </div>
          </div>

          {/* Metrics Comparison Table */}
          <div className="bg-[#060B16] rounded-xl border border-[#1E293B] overflow-hidden font-mono text-xs">
            <div className="grid grid-cols-3 p-3 border-b border-[#1E293B] bg-[#0A0F1E] text-[10px] uppercase tracking-widest text-[#64748B] font-bold">
              <span className="text-left">{boat1.name}</span>
              <span className="text-center">METRIC</span>
              <span className="text-right">{boat2.name}</span>
            </div>

            {/* SOG Speed Over Ground */}
            <div className="grid grid-cols-3 p-3 border-b border-[#1E293B] items-center">
              <span className="text-left font-bold text-[#00D4FF]">
                {safeFixed(boat1.sog, 1, '0.0')} kt
              </span>
              <span className="text-center text-[#94A3B8] text-[10px]">
                SPEED (SOG)
              </span>
              <span className="text-right font-bold text-[#00D4FF]">
                {safeFixed(boat2.sog, 1, '0.0')} kt
              </span>
            </div>

            {/* VMG Velocity Made Good */}
            <div className="grid grid-cols-3 p-3 border-b border-[#1E293B] items-center">
              <span className="text-left font-bold text-[#00FF9D]">
                {safeFixed(boat1.vmg, 1, '0.0')} kt
              </span>
              <span className="text-center text-[#94A3B8] text-[10px]">
                VMG (WINDWARD)
              </span>
              <span className="text-right font-bold text-[#00FF9D]">
                {safeFixed(boat2.vmg, 1, '0.0')} kt
              </span>
            </div>

            {/* COG Heading */}
            <div className="grid grid-cols-3 p-3 border-b border-[#1E293B] items-center">
              <span className="text-left text-white">{boat1.cog ?? 0}°</span>
              <span className="text-center text-[#94A3B8] text-[10px]">
                HEADING (COG)
              </span>
              <span className="text-right text-white">{boat2.cog ?? 0}°</span>
            </div>

            {/* Corrected Time Gap */}
            <div className="grid grid-cols-3 p-3 items-center bg-[#00D4FF]/5">
              <span className="text-left font-bold text-[#00FF9D]">
                {correctedTimeDiff <= 0 ? 'LEADER' : `+${Math.abs(Math.round(correctedTimeDiff))}s`}
              </span>
              <span className="text-center text-[#00D4FF] text-[10px] font-bold">
                CORRECTED GAP
              </span>
              <span className="text-right font-bold text-[#00FF9D]">
                {correctedTimeDiff > 0 ? 'LEADER' : `+${Math.abs(Math.round(correctedTimeDiff))}s`}
              </span>
            </div>
          </div>

          {/* Distance between vessels summary */}
          <div className="p-3 bg-[#00D4FF]/10 rounded-lg border border-[#00D4FF]/20 flex items-center justify-between text-xs font-mono">
            <span className="text-[#94A3B8]">Separation Distance:</span>
            <span className="text-[#00D4FF] font-bold text-sm">
              {safeFixed(distNm, 2, '0.00')} Nautical Miles ({Math.round(distNm * 1852)}m)
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#060B16] border-t border-[#1E293B] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded bg-[#00D4FF] text-[#020408] font-bold text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
