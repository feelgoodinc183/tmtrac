import React, { useState } from 'react';
import { MapBasemap, WeatherOverlays, MapViewSize } from '../types/regatta';
import {
  Layers,
  Wind,
  Compass,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Eye,
  Waves,
  CloudRain,
  Map,
  ChevronDown,
  X,
  RotateCcw,
} from 'lucide-react';

interface MapLayersControlProps {
  basemap: MapBasemap;
  onSelectBasemap: (basemap: MapBasemap) => void;
  overlays: WeatherOverlays;
  onToggleOverlay: (key: keyof WeatherOverlays) => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  mapSize: MapViewSize;
  onChangeMapSize: (size: MapViewSize) => void;
  directSunlightMode?: boolean;
}

export const MapLayersControl: React.FC<MapLayersControlProps> = ({
  basemap,
  onSelectBasemap,
  overlays,
  onToggleOverlay,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  mapSize,
  onChangeMapSize,
  directSunlightMode = false,
}) => {
  const [isBarExpanded, setIsBarExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 items-end">
      {/* Collapsed Icon Button OR Quick Map Zoom & Size Bar */}
      {!isBarExpanded ? (
        <button
          onClick={() => setIsBarExpanded(true)}
          className={`p-2 rounded-xl border text-xs font-mono font-bold transition-all shadow-xl flex items-center justify-center backdrop-blur-md group shrink-0 ${
            directSunlightMode
              ? 'bg-black/95 text-white border-white'
              : 'bg-[#060B16]/90 border-[#1E293B] hover:border-[#00D4FF]/70 text-[#00D4FF] hover:bg-[#1E293B] shadow-[0_0_12px_rgba(0,212,255,0.2)]'
          }`}
          title="Map & View Controls (Click to expand)"
          aria-label="Map & View Controls"
        >
          <Layers className="w-4 h-4 text-[#00D4FF] group-hover:scale-110 transition-transform" />
        </button>
      ) : (
        <div
          className={`border p-1 rounded-xl backdrop-blur-md shadow-2xl flex items-center gap-1 animate-in slide-in-from-right-2 fade-in duration-200 ${
            directSunlightMode
              ? 'bg-black/95 text-white border-white'
              : 'bg-[#0A0F1E]/90 border-[#1E293B] text-[#E0E6ED]'
          }`}
        >
          {/* Zoom In */}
          <button
            onClick={onZoomIn}
            disabled={zoomLevel >= 3}
            className="p-1.5 sm:p-2 rounded-lg bg-[#060B16] hover:bg-[#00D4FF] hover:text-[#020408] text-[#E0E6ED] transition-all disabled:opacity-30"
            title="Zoom In Map"
          >
            <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Zoom Level Indicator */}
          <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#00D4FF] px-1 select-none">
            {Math.round(zoomLevel * 100)}%
          </span>

          {/* Zoom Out */}
          <button
            onClick={onZoomOut}
            disabled={zoomLevel <= 0.6}
            className="p-1.5 sm:p-2 rounded-lg bg-[#060B16] hover:bg-[#00D4FF] hover:text-[#020408] text-[#E0E6ED] transition-all disabled:opacity-30"
            title="Zoom Out Map"
          >
            <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Reset Zoom Icon Button */}
          <button
            onClick={onResetZoom}
            className="p-1.5 sm:p-2 rounded-lg bg-[#060B16] hover:bg-[#1E293B] text-[#94A3B8] hover:text-white transition-all flex items-center justify-center"
            title="Reset Zoom & Center Fleet"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <div className="w-[1px] h-4 bg-[#1E293B] mx-0.5" />

          {/* Map Size Toggles */}
          <button
            onClick={() => onChangeMapSize(mapSize === 'FULLSCREEN' ? 'STANDARD' : 'FULLSCREEN')}
            className={`p-1.5 sm:p-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center ${
              mapSize === 'FULLSCREEN'
                ? 'bg-[#00FF9D] text-[#020408] shadow-[0_0_8px_#00FF9D]'
                : 'bg-[#060B16] hover:bg-[#1E293B] text-[#00D4FF]'
            }`}
            title="Toggle Fullscreen Map Mode"
          >
            {mapSize === 'FULLSCREEN' ? (
              <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>

          {/* Map & Weather Layers Icon Toggle Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`p-1.5 sm:p-2 rounded-lg border text-xs font-mono font-bold transition-all flex items-center justify-center ${
              isOpen
                ? 'bg-[#00D4FF] text-[#020408] border-[#00D4FF] shadow-[0_0_10px_#00D4FF]'
                : 'bg-[#060B16] border-[#1E293B] text-[#00D4FF] hover:border-[#00D4FF] hover:bg-[#1E293B]'
            }`}
            title="Map & Weather Layers"
          >
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Collapse Bar Button */}
          <button
            onClick={() => {
              setIsBarExpanded(false);
              setIsOpen(false);
            }}
            className="p-1.5 sm:p-2 rounded-lg bg-[#060B16] hover:bg-[#1E293B] text-[#64748B] hover:text-white transition-all flex items-center justify-center ml-0.5"
            title="Hide / Collapse Controls into Icon"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      )}

      {/* Expanded Map Layers Drawer / Dropdown Panel */}
      {isOpen && (
        <div className="w-72 sm:w-80 max-h-[70vh] landscape:max-h-[94dvh] overflow-y-auto custom-scrollbar bg-[#0A0F1E]/95 border border-[#1E293B] rounded-2xl p-3.5 sm:p-4 landscape:p-2.5 shadow-2xl backdrop-blur-xl text-[#E0E6ED] space-y-3 landscape:space-y-2 font-sans animate-in fade-in slide-in-from-top-2 duration-200 z-30">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-2 landscape:pb-1.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Map className="w-4 h-4 text-[#00D4FF]" />
              Maps & Weather Layers
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-[#1E293B] text-[#64748B] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* SECTION 1: OPEN MAP BASELAYERS */}
          <div className="space-y-1.5">
            <label className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-[#64748B] block">
              Open Maps Basemap
            </label>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onSelectBasemap('DARK_VECTOR')}
                className={`p-2 rounded-xl border text-left text-xs font-mono transition-all flex flex-col gap-0.5 ${
                  basemap === 'DARK_VECTOR'
                    ? 'bg-[#00D4FF]/15 border-[#00D4FF] text-white shadow-[0_0_8px_rgba(0,212,255,0.2)]'
                    : 'bg-[#060B16] border-[#1E293B] text-[#94A3B8] hover:text-white'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-[#00D4FF]" />
                  Dark Vector
                </span>
                <span className="text-[8.5px] text-[#64748B]">Tactical grid</span>
              </button>

              <button
                onClick={() => onSelectBasemap('OPEN_SEA_MAP')}
                className={`p-2 rounded-xl border text-left text-xs font-mono transition-all flex flex-col gap-0.5 ${
                  basemap === 'OPEN_SEA_MAP'
                    ? 'bg-[#00FF9D]/15 border-[#00FF9D] text-white shadow-[0_0_8px_rgba(0,255,157,0.2)]'
                    : 'bg-[#060B16] border-[#1E293B] text-[#94A3B8] hover:text-white'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-[#00FF9D]" />
                  OpenSeaMap
                </span>
                <span className="text-[8.5px] text-[#64748B]">Nautical soundings</span>
              </button>

              <button
                onClick={() => onSelectBasemap('OPEN_STREET_MAP')}
                className={`p-2 rounded-xl border text-left text-xs font-mono transition-all flex flex-col gap-0.5 ${
                  basemap === 'OPEN_STREET_MAP'
                    ? 'bg-[#FFB800]/15 border-[#FFB800] text-white shadow-[0_0_8px_rgba(255,184,0,0.2)]'
                    : 'bg-[#060B16] border-[#1E293B] text-[#94A3B8] hover:text-white'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-[#FFB800]" />
                  OpenStreetMap
                </span>
                <span className="text-[8.5px] text-[#64748B]">Topographic land</span>
              </button>

              <button
                onClick={() => onSelectBasemap('OPEN_TOPO_BATHYMETRY')}
                className={`p-2 rounded-xl border text-left text-xs font-mono transition-all flex flex-col gap-0.5 ${
                  basemap === 'OPEN_TOPO_BATHYMETRY'
                    ? 'bg-[#C084FC]/15 border-[#C084FC] text-white shadow-[0_0_8px_rgba(192,132,252,0.2)]'
                    : 'bg-[#060B16] border-[#1E293B] text-[#94A3B8] hover:text-white'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-[#C084FC]" />
                  Bathymetry
                </span>
                <span className="text-[8.5px] text-[#64748B]">Depth contours</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: WEATHER & WIND OVERLAY TOGGLES */}
          <div className="space-y-1.5">
            <label className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-[#64748B] block">
              Weather Overlays
            </label>

            <div className="space-y-1">
              {/* Wind Particle Streamlines */}
              <button
                onClick={() => onToggleOverlay('windParticles')}
                className={`w-full p-2 rounded-xl border text-xs font-mono transition-all flex items-center justify-between ${
                  overlays.windParticles
                    ? 'bg-[#00D4FF]/10 border-[#00D4FF] text-white'
                    : 'bg-[#060B16] border-[#1E293B] text-[#64748B]'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Wind className="w-3.5 h-3.5 text-[#00D4FF]" />
                  Wind Streamlines
                </span>
                <span className={`text-[9px] font-bold ${overlays.windParticles ? 'text-[#00D4FF]' : 'text-[#64748B]'}`}>
                  {overlays.windParticles ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Wind Barb Vectors */}
              <button
                onClick={() => onToggleOverlay('windBarbs')}
                className={`w-full p-2 rounded-xl border text-xs font-mono transition-all flex items-center justify-between ${
                  overlays.windBarbs
                    ? 'bg-[#00FF9D]/10 border-[#00FF9D] text-white'
                    : 'bg-[#060B16] border-[#1E293B] text-[#64748B]'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Compass className="w-3.5 h-3.5 text-[#00FF9D]" />
                  Wind Direction Vectors
                </span>
                <span className={`text-[9px] font-bold ${overlays.windBarbs ? 'text-[#00FF9D]' : 'text-[#64748B]'}`}>
                  {overlays.windBarbs ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Isobar Pressure Lines */}
              <button
                onClick={() => onToggleOverlay('isobars')}
                className={`w-full p-2 rounded-xl border text-xs font-mono transition-all flex items-center justify-between ${
                  overlays.isobars
                    ? 'bg-[#FFB800]/10 border-[#FFB800] text-white'
                    : 'bg-[#060B16] border-[#1E293B] text-[#64748B]'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px]">
                  <CloudRain className="w-3.5 h-3.5 text-[#FFB800]" />
                  Isobar Pressure (hPa)
                </span>
                <span className={`text-[9px] font-bold ${overlays.isobars ? 'text-[#FFB800]' : 'text-[#64748B]'}`}>
                  {overlays.isobars ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Tidal Ocean Currents */}
              <button
                onClick={() => onToggleOverlay('oceanCurrents')}
                className={`w-full p-2 rounded-xl border text-xs font-mono transition-all flex items-center justify-between ${
                  overlays.oceanCurrents
                    ? 'bg-[#C084FC]/10 border-[#C084FC] text-white'
                    : 'bg-[#060B16] border-[#1E293B] text-[#64748B]'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Waves className="w-3.5 h-3.5 text-[#C084FC]" />
                  Ocean Currents
                </span>
                <span className={`text-[9px] font-bold ${overlays.oceanCurrents ? 'text-[#C084FC]' : 'text-[#64748B]'}`}>
                  {overlays.oceanCurrents ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Wave Height Heatmap */}
              <button
                onClick={() => onToggleOverlay('waveHeatmap')}
                className={`w-full p-2 rounded-xl border text-xs font-mono transition-all flex items-center justify-between ${
                  overlays.waveHeatmap
                    ? 'bg-[#FF4D4D]/10 border-[#FF4D4D] text-white'
                    : 'bg-[#060B16] border-[#1E293B] text-[#64748B]'
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Eye className="w-3.5 h-3.5 text-[#FF4D4D]" />
                  Wave & Swell Height
                </span>
                <span className={`text-[9px] font-bold ${overlays.waveHeatmap ? 'text-[#FF4D4D]' : 'text-[#64748B]'}`}>
                  {overlays.waveHeatmap ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
