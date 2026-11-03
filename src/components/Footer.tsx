import React from 'react';
import { Radio, Database, ShieldCheck, Terminal } from 'lucide-react';
import { RaceState } from '../types/regatta';

interface FooterProps {
  raceState: RaceState;
  onOpenMqttInspector: () => void;
  onOpenOfflineCache: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  raceState,
  onOpenMqttInspector,
  onOpenOfflineCache,
}) => {
  return (
    <footer className="h-12 bg-[#020408] border-t border-[#1E293B] flex items-center justify-between px-4 sm:px-6 shrink-0 text-[#94A3B8] text-xs font-mono select-none z-20">
      {/* Multi-Class Start Schedule */}
      <div className="flex gap-4 sm:gap-8 text-[10px] uppercase tracking-widest text-[#64748B] overflow-x-auto">
        <span className="flex items-center gap-1.5 font-bold text-[#E0E6ED]">
          <span className="w-2 h-2 rounded-full bg-[#00D4FF]" />
          Class 1: <strong className="text-[#00D4FF]">02:44</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00FF9D]" />
          Class 2: <strong className="text-white">07:44</strong>
        </span>
        <span className="flex items-center gap-1.5 hidden md:flex">
          <span className="w-2 h-2 rounded-full bg-[#C084FC]" />
          Class 3: <strong className="text-white">12:44</strong>
        </span>
      </div>

      {/* Right: Network & Chart Caching Status Indicators */}
      <div className="flex items-center gap-4 sm:gap-6">
        <button
          onClick={onOpenMqttInspector}
          className="flex items-center gap-2 hover:text-[#00FF9D] transition-all cursor-pointer"
          title="Open MQTT Packet Inspector"
        >
          <div className="w-2 h-2 rounded-full bg-[#00FF9D] shadow-[0_0_8px_#00FF9D]" />
          <span className="text-[10px] tracking-wider uppercase text-[#E0E6ED] flex items-center gap-1">
            <Radio className="w-3 h-3 text-[#00FF9D]" />
            LO-RA MESH: OPTIMAL
          </span>
        </button>

        <button
          onClick={onOpenOfflineCache}
          className="flex items-center gap-2 hover:text-[#00D4FF] transition-all cursor-pointer hidden sm:flex"
          title="Open Chart Cache Manager"
        >
          <div className="w-2 h-2 rounded-full bg-[#00D4FF]" />
          <span className="text-[10px] tracking-wider uppercase text-[#94A3B8] flex items-center gap-1">
            <Database className="w-3 h-3 text-[#00D4FF]" />
            CHART: CACHED (LISMORE)
          </span>
        </button>
      </div>
    </footer>
  );
};
