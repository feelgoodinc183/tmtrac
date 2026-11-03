import React, { useState } from 'react';
import { X, Database, Download, CheckCircle2, HardDrive, RefreshCw, Trash2, MapPin } from 'lucide-react';

interface OfflineCacheModalProps {
  onClose: () => void;
}

interface ChartRegion {
  id: string;
  name: string;
  location: string;
  coverage: string;
  tilesCount: number;
  sizeMb: number;
  status: 'CACHED' | 'DOWNLOADING' | 'NOT_CACHED';
}

const DEFAULT_SEA_REGIONS: ChartRegion[] = [
  {
    id: 'reg-andaman-sea',
    name: 'Andaman Sea & Langkawi Archipelago',
    location: 'Thailand & Malaysia & N. Indonesia',
    coverage: 'Langkawi, Penang, Phuket, Krabi, Similan Islands & N. Sumatra approach',
    tilesCount: 2840,
    sizeMb: 64.2,
    status: 'CACHED',
  },
  {
    id: 'reg-strait-melaka',
    name: 'Strait of Melaka & Singapore Strait',
    location: 'Malaysia & Singapore & Indonesia',
    coverage: 'Port Klang, Melaka, Johor, Singapore, Batam, Bintan & Riau / East Sumatra',
    tilesCount: 3450,
    sizeMb: 88.6,
    status: 'NOT_CACHED',
  },
  {
    id: 'reg-south-china-sea',
    name: 'South China Sea & East Malaysia / Natuna',
    location: 'Malaysia & Indonesia & Brunei',
    coverage: 'Tioman, Terengganu, Sarawak, Sabah, Brunei & Natuna/Anambas waters',
    tilesCount: 4120,
    sizeMb: 112.4,
    status: 'NOT_CACHED',
  },
  {
    id: 'reg-gulf-thailand',
    name: 'Gulf of Thailand & Eastern Seaboard',
    location: 'Thailand & Cambodia / Vietnam Coast',
    coverage: 'Pattaya, Koh Samui, Hua Hin, Rayong, Bangkok Bay & S. Indochina border',
    tilesCount: 2680,
    sizeMb: 72.8,
    status: 'NOT_CACHED',
  },
];

export const OfflineCacheModal: React.FC<OfflineCacheModalProps> = ({
  onClose,
}) => {
  const [regions, setRegions] = useState<ChartRegion[]>(() => {
    try {
      const saved = localStorage.getItem('tmtrac_offline_chart_regions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with current SEA regions definition to preserve latest metadata
          return DEFAULT_SEA_REGIONS.map((def) => {
            const found = parsed.find((p: any) => p.id === def.id);
            return found ? { ...def, status: found.status } : def;
          });
        }
      }
    } catch (e) {}
    return DEFAULT_SEA_REGIONS;
  });

  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [isSyncingSqlite, setIsSyncingSqlite] = useState(false);

  const totalCachedTilesMb = regions
    .filter((r) => r.status === 'CACHED')
    .reduce((acc, r) => acc + r.sizeMb, 0);

  const handleDownloadRegion = (id: string) => {
    setRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'DOWNLOADING' as const } : r))
    );
    setDownloadProgress((prev) => ({ ...prev, [id]: 30 }));

    setTimeout(() => {
      setDownloadProgress((prev) => ({ ...prev, [id]: 75 }));
    }, 800);

    setTimeout(() => {
      setDownloadProgress((prev) => ({ ...prev, [id]: 100 }));
      setRegions((prev) => {
        const updated = prev.map((r) =>
          r.id === id ? { ...r, status: 'CACHED' as const } : r
        );
        try {
          localStorage.setItem('tmtrac_offline_chart_regions', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }, 1600);
  };

  const handleRemoveRegion = (id: string) => {
    setRegions((prev) => {
      const updated = prev.map((r) =>
        r.id === id ? { ...r, status: 'NOT_CACHED' as const } : r
      );
      try {
        localStorage.setItem('tmtrac_offline_chart_regions', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleSyncSqliteNow = () => {
    setIsSyncingSqlite(true);
    setTimeout(() => {
      setIsSyncingSqlite(false);
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 landscape:p-1.5 animate-in fade-in duration-200 font-google">
      <div className="bg-[#0A0F1E]/95 backdrop-blur-md border border-[#334155]/80 w-full max-w-xl rounded-3xl landscape:rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#E0E6ED] max-h-[calc(100vh-120px)] sm:max-h-[85vh] landscape:max-h-[98dvh] landscape:h-[98dvh] min-h-0">
        {/* Header */}
        <div className="px-5 py-4 landscape:py-2.5 bg-[#060B16]/90 border-b border-[#1E293B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#FFB800]/15 border border-[#FFB800]/40 flex items-center justify-center text-[#FFB800] shrink-0 shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2 truncate">
                Offline Nautical Maps & SQLite Sync
              </h2>
              <p className="text-[11px] text-[#64748B] font-mono truncate">
                South East Asia OpenSeaMap & Vector Tile Caching for Remote Regattas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#1E293B]/80 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto custom-scrollbar overscroll-contain min-h-0">
          {/* Local SQLite Buffer Card */}
          <div className="bg-[#060B16]/80 p-4 sm:p-5 rounded-2xl border border-[#1E293B] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#00D4FF] flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#00D4FF]" />
                Local State Database (Lismore.db)
              </span>
              <button
                onClick={handleSyncSqliteNow}
                disabled={isSyncingSqlite}
                className="text-[11px] font-mono font-bold bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 text-[#00D4FF] px-3 py-1.5 rounded-xl border border-[#00D4FF]/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSqlite ? 'animate-spin' : ''}`} />
                {isSyncingSqlite ? 'Syncing...' : 'Force Sync to Cloud'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-[10px] font-mono">
              <div className="bg-[#0A0F1E] p-3 rounded-xl border border-[#1E293B]">
                <span className="text-[#64748B] block mb-0.5">Local Pings</span>
                <span className="text-white font-bold text-sm">1,482</span>
              </div>
              <div className="bg-[#0A0F1E] p-3 rounded-xl border border-[#1E293B]">
                <span className="text-[#64748B] block mb-0.5">Cached Tiles</span>
                <span className="text-[#00D4FF] font-bold text-sm">
                  {totalCachedTilesMb > 0 ? `${totalCachedTilesMb.toFixed(1)} MB` : '0 MB'}
                </span>
              </div>
              <div className="bg-[#0A0F1E] p-3 rounded-xl border border-[#1E293B]">
                <span className="text-[#64748B] block mb-0.5">Cloud Status</span>
                <span className="text-[#00FF9D] font-bold text-sm">SYNCED</span>
              </div>
            </div>
          </div>

          {/* Offline Map Tile Download Regions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-mono uppercase tracking-wider text-[#64748B] font-bold">
                South East Asia Nautical Chart Tile Regions
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {regions.filter((r) => r.status === 'CACHED').length}/{regions.length} Cached
              </span>
            </div>

            <div className="space-y-2.5">
              {regions.map((reg) => (
                <div
                  key={reg.id}
                  className="p-3.5 rounded-2xl bg-[#060B16]/80 border border-[#1E293B] hover:border-slate-700/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-bold text-white tracking-tight">{reg.name}</h4>
                    </div>
                    <p className="text-[11px] text-cyan-400/90 font-mono flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>{reg.location}</span>
                    </p>
                    <p className="text-[10px] text-[#94A3B8] font-mono mt-0.5 leading-tight">
                      {reg.coverage}
                    </p>
                    <p className="text-[10px] text-[#64748B] font-mono mt-1">
                      {reg.tilesCount.toLocaleString()} tiles • {reg.sizeMb} MB
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                    {reg.status === 'CACHED' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#00FF9D] bg-[#00FF9D]/10 px-2.5 py-1.5 rounded-lg border border-[#00FF9D]/30 flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF9D]" />
                          CACHED
                        </span>
                        <button
                          onClick={() => handleRemoveRegion(reg.id)}
                          className="text-[10px] font-mono bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 border border-rose-500/30 hover:border-rose-500/50 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 font-semibold cursor-pointer active:scale-95 shadow-xs"
                          title={`Remove cached tiles for ${reg.name} to free storage`}
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" />
                          <span>Remove</span>
                        </button>
                      </div>
                    ) : reg.status === 'DOWNLOADING' ? (
                      <span className="text-[10px] font-mono text-[#FFB800] bg-[#FFB800]/10 px-3 py-1.5 rounded-lg border border-[#FFB800]/30 flex items-center gap-1.5 font-bold animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FFB800]" />
                        <span>DOWNLOADING ({downloadProgress[reg.id] || 45}%)</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDownloadRegion(reg.id)}
                        className="text-[10px] font-mono bg-[#00D4FF] hover:bg-cyan-300 text-[#020408] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Tiles</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
