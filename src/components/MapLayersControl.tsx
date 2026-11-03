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
            'bg-lb-060b16/90 border-ll-1e293b hover:border-ll-00d4ff/70 text-lt-00d4ff hover:bg-lb-1e293b shadow-[0_0_12px_rgba(0,212,255,0.2)]'
          }`}
          title="Map & View Controls (Click to expand)"
          aria-label="Map & View Controls"
        >
          <Layers className="w-4 h-4 text-lt-00d4ff group-hover:scale-110 transition-transform" />
        </button>
      ) : (
        <div
          className={`border p-1 rounded-xl backdrop-blur-md shadow-2xl flex items-center gap-1 animate-in slide-in-from-right-2 fade-in duration-200 ${
            'bg-lb-0a0f1e/90 border-ll-1e293b text-lt-e0e6ed'
          }`}
        >
          {/* Zoom In */}
          <button
            onClick={onZoomIn}
            disabled={zoomLevel >= 3}
            className="p-1.5 sm:p-2 rounded-lg bg-lb-060b16 hover:bg-lb-00d4ff hover:text-lt-020408 text-lt-e0e6ed transition-all disabled:opacity-30"
            title="Zoom In Map"
          >
            <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Zoom Level Indicator */}
          <span className="text-xs sm:text-xs font-mono font-bold text-lt-00d4ff px-1 select-none">
            {Math.round(zoomLevel * 100)}%
          </span>

          {/* Zoom Out */}
          <button
            onClick={onZoomOut}
            disabled={zoomLevel <= 0.6}
            className="p-1.5 sm:p-2 rounded-lg bg-lb-060b16 hover:bg-lb-00d4ff hover:text-lt-020408 text-lt-e0e6ed transition-all disabled:opacity-30"
            title="Zoom Out Map"
          >
            <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* "Fit all" on the map toolbar re-centres the fleet */}
          <div className="w-[1px] h-4 bg-lb-1e293b mx-0.5" />

          {/* Map Size Toggles */}
          <button
            onClick={() => onChangeMapSize(mapSize === 'FULLSCREEN' ? 'STANDARD' : 'FULLSCREEN')}
            className={`p-1.5 sm:p-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center ${
              mapSize === 'FULLSCREEN'
                ? 'bg-lb-00ff9d text-lt-020408 shadow-[0_0_8px_#00FF9D]'
                : 'bg-lb-060b16 hover:bg-lb-1e293b text-lt-00d4ff'
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
                ? 'bg-lb-00d4ff text-lt-020408 border-ll-00d4ff shadow-[0_0_10px_#00D4FF]'
                : 'bg-lb-060b16 border-ll-1e293b text-lt-00d4ff hover:border-ll-00d4ff hover:bg-lb-1e293b'
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
            className="p-1.5 sm:p-2 rounded-lg bg-lb-060b16 hover:bg-lb-1e293b text-lt-64748b hover:text-lt-white transition-all flex items-center justify-center ml-0.5"
            title="Hide / Collapse Controls into Icon"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      )}

      {/* Expanded Map Layers Drawer / Dropdown Panel */}
      {isOpen && (
        <div className="w-72 sm:w-80 max-h-[70vh] landscape:max-h-[94dvh] overflow-y-auto custom-scrollbar bg-lb-0a0f1e/95 border border-ll-1e293b rounded-2xl p-3.5 sm:p-4 landscape:p-2.5 shadow-2xl backdrop-blur-xl text-lt-e0e6ed space-y-3 landscape:space-y-2 font-sans animate-in fade-in slide-in-from-top-2 duration-200 z-30">
          <div className="flex items-center justify-between border-b border-ll-1e293b pb-2 landscape:pb-1.5">
            <span className="text-xs font-bold text-lt-white flex items-center gap-1.5">
              <Map className="w-4 h-4 text-lt-00d4ff" />
              Maps & Weather Layers
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-lb-1e293b text-lt-64748b hover:text-lt-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* SECTION 1: OPEN MAP BASELAYERS */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-xs font-mono uppercase tracking-widest text-lt-64748b block">
              Open Maps Basemap
            </label>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onSelectBasemap('DARK_VECTOR')}
                className={`p-2 rounded-xl border text-left text-xs font-mono transition-all flex flex-col gap-0.5 ${
                  basemap === 'DARK_VECTOR'
                    ? 'bg-lb-00d4ff/15 border-ll-00d4ff text-lt-white shadow-[0_0_8px_rgba(0,212,255,0.2)]'
                    : 'bg-lb-060b16 border-ll-1e293b text-lt-94a3b8 hover:text-lt-white'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-lb-00d4ff" />
                  Dark Vector
                </span>
                <span className="text-xs text-lt-64748b">Tactical grid</span>
              </button>

              <button
                onClick={() => onSelectBasemap('OPEN_SEA_MAP')}
                className={`p-2 rounded-xl border text-left text-xs font-mono transition-all flex flex-col gap-0.5 ${
                  basemap === 'OPEN_SEA_MAP'
                    ? 'bg-lb-00ff9d/15 border-ll-00ff9d text-lt-white shadow-[0_0_8px_rgba(0,255,157,0.2)]'
                    : 'bg-lb-060b16 border-ll-1e293b text-lt-94a3b8 hover:text-lt-white'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-lb-00ff9d" />
                  OpenSeaMap
                </span>
                <span className="text-xs text-lt-64748b">Nautical soundings</span>
              </button>

              <button
                onClick={() => onSelectBasemap('OPEN_STREET_MAP')}
                className={`p-2 rounded-xl border text-left text-xs font-mono transition-all flex flex-col gap-0.5 ${
                  basemap === 'OPEN_STREET_MAP'
                    ? 'bg-lb-ffb800/15 border-ll-ffb800 text-lt-white shadow-[0_0_8px_rgba(255,184,0,0.2)]'
                    : 'bg-lb-060b16 border-ll-1e293b text-lt-94a3b8 hover:text-lt-white'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-lb-ffb800" />
                  OpenStreetMap
                </span>
                <span className="text-xs text-lt-64748b">Topographic land</span>
              </button>

              <button
                onClick={() => onSelectBasemap('OPEN_TOPO_BATHYMETRY')}
                className={`p-2 rounded-xl border text-left text-xs font-mono transition-all flex flex-col gap-0.5 ${
                  basemap === 'OPEN_TOPO_BATHYMETRY'
                    ? 'bg-lb-c084fc/15 border-ll-c084fc text-lt-white shadow-[0_0_8px_rgba(192,132,252,0.2)]'
                    : 'bg-lb-060b16 border-ll-1e293b text-lt-94a3b8 hover:text-lt-white'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-lb-c084fc" />
                  Bathymetry
                </span>
                <span className="text-xs text-lt-64748b">Depth contours</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: WEATHER & WIND OVERLAY TOGGLES */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-xs font-mono uppercase tracking-widest text-lt-64748b block">
              Weather Overlays
            </label>

            <div className="space-y-1">
              {/* Wind Particle Streamlines */}
              <button
                onClick={() => onToggleOverlay('windParticles')}
                className={`w-full p-2 rounded-xl border text-xs font-mono transition-all flex items-center justify-between ${
                  overlays.windParticles
                    ? 'bg-lb-00d4ff/10 border-ll-00d4ff text-lt-white'
                    : 'bg-lb-060b16 border-ll-1e293b text-lt-64748b'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <Wind className="w-3.5 h-3.5 text-lt-00d4ff" />
                  Wind Streamlines
                </span>
                <span className={`text-xs font-bold ${overlays.windParticles ? 'text-lt-00d4ff' : 'text-lt-64748b'}`}>
                  {overlays.windParticles ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Wind Barb Vectors */}
              <button
                onClick={() => onToggleOverlay('windBarbs')}
                className={`w-full p-2 rounded-xl border text-xs font-mono transition-all flex items-center justify-between ${
                  overlays.windBarbs
                    ? 'bg-lb-00ff9d/10 border-ll-00ff9d text-lt-white'
                    : 'bg-lb-060b16 border-ll-1e293b text-lt-64748b'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <Compass className="w-3.5 h-3.5 text-lt-00ff9d" />
                  Wind Direction Vectors
                </span>
                <span className={`text-xs font-bold ${overlays.windBarbs ? 'text-lt-00ff9d' : 'text-lt-64748b'}`}>
                  {overlays.windBarbs ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Isobar Pressure Lines */}
              <button
                onClick={() => onToggleOverlay('isobars')}
                className={`w-full p-2 rounded-xl border text-xs font-mono transition-all flex items-center justify-between ${
                  overlays.isobars
                    ? 'bg-lb-ffb800/10 border-ll-ffb800 text-lt-white'
                    : 'bg-lb-060b16 border-ll-1e293b text-lt-64748b'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <CloudRain className="w-3.5 h-3.5 text-lt-ffb800" />
                  Isobar Pressure (hPa)
                </span>
                <span className={`text-xs font-bold ${overlays.isobars ? 'text-lt-ffb800' : 'text-lt-64748b'}`}>
                  {overlays.isobars ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Tidal Ocean Currents */}
              <button
                onClick={() => onToggleOverlay('oceanCurrents')}
                className={`w-full p-2 rounded-xl border text-xs font-mono transition-all flex items-center justify-between ${
                  overlays.oceanCurrents
                    ? 'bg-lb-c084fc/10 border-ll-c084fc text-lt-white'
                    : 'bg-lb-060b16 border-ll-1e293b text-lt-64748b'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <Waves className="w-3.5 h-3.5 text-lt-c084fc" />
                  Ocean Currents
                </span>
                <span className={`text-xs font-bold ${overlays.oceanCurrents ? 'text-lt-c084fc' : 'text-lt-64748b'}`}>
                  {overlays.oceanCurrents ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Wave Height Heatmap */}
              <button
                onClick={() => onToggleOverlay('waveHeatmap')}
                className={`w-full p-2 rounded-xl border text-xs font-mono transition-all flex items-center justify-between ${
                  overlays.waveHeatmap
                    ? 'bg-lb-ff4d4d/10 border-ll-ff4d4d text-lt-white'
                    : 'bg-lb-060b16 border-ll-1e293b text-lt-64748b'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <Eye className="w-3.5 h-3.5 text-lt-ff4d4d" />
                  Wave & Swell Height
                </span>
                <span className={`text-xs font-bold ${overlays.waveHeatmap ? 'text-lt-ff4d4d' : 'text-lt-64748b'}`}>
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
