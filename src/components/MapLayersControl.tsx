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
          className={`p-2 rounded-xl border text-xs  font-bold transition-all shadow-xl flex items-center justify-center backdrop-blur-md group shrink-0 ${
            'bg-canvas/90 border-line hover:border-accent/70 text-accent hover:bg-raised '
          }`}
          title="Map & View Controls (Click to expand)"
          aria-label="Map & View Controls"
        >
          <Layers className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
        </button>
      ) : (
        <div
          className={`border p-1 rounded-xl backdrop-blur-md shadow-2xl flex items-center gap-1 animate-in slide-in-from-right-2 fade-in duration-200 ${
            'bg-surface/90 border-line text-ink'
          }`}
        >
          {/* Zoom In */}
          <button
            onClick={onZoomIn}
            disabled={zoomLevel >= 3}
            className="p-1.5 sm:p-2 rounded-lg bg-canvas hover:brightness-110 hover:text-canvas text-ink transition-all disabled:opacity-30"
            title="Zoom In Map"
          >
            <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Zoom Level Indicator */}
          <span className="text-xs sm:text-xs font-bold text-accent px-1 select-none">
            {Math.round(zoomLevel * 100)}%
          </span>

          {/* Zoom Out */}
          <button
            onClick={onZoomOut}
            disabled={zoomLevel <= 0.6}
            className="p-1.5 sm:p-2 rounded-lg bg-canvas hover:brightness-110 hover:text-canvas text-ink transition-all disabled:opacity-30"
            title="Zoom Out Map"
          >
            <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* "Fit all" on the map toolbar re-centres the fleet */}
          <div className="w-[1px] h-4 bg-raised mx-0.5" />

          {/* Map Size Toggles */}
          <button
            onClick={() => onChangeMapSize(mapSize === 'FULLSCREEN' ? 'STANDARD' : 'FULLSCREEN')}
            className={`p-1.5 sm:p-2 rounded-lg  text-xs font-bold transition-all flex items-center justify-center ${
              mapSize === 'FULLSCREEN'
                ? 'bg-success-ink text-canvas '
                : 'bg-canvas hover:bg-raised text-accent'
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
            className={`p-1.5 sm:p-2 rounded-lg border text-xs  font-bold transition-all flex items-center justify-center ${
              isOpen
                ? 'bg-accent text-on-accent border-accent '
                : 'bg-canvas border-line text-accent hover:border-accent hover:bg-raised'
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
            className="p-1.5 sm:p-2 rounded-lg bg-canvas hover:bg-raised text-ink-muted hover:text-ink transition-all flex items-center justify-center ml-0.5"
            title="Hide / Collapse Controls into Icon"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      )}

      {/* Expanded Map Layers Drawer / Dropdown Panel */}
      {isOpen && (
        <div className="w-72 sm:w-80 max-h-[70vh] landscape:max-h-[94dvh] overflow-y-auto custom-scrollbar bg-surface/95 border border-line rounded-2xl p-3.5 sm:p-4 landscape:p-2.5 shadow-2xl backdrop-blur-xl text-ink space-y-3 landscape:space-y-2 font-sans animate-in fade-in slide-in-from-top-2 duration-200 z-30">
          <div className="flex items-center justify-between border-b border-line pb-2 landscape:pb-1.5">
            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Map className="w-4 h-4 text-accent" />
              Maps & Weather Layers
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-raised text-ink-muted hover:text-ink"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* SECTION 1: OPEN MAP BASELAYERS */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-xs text-ink-muted block">
              Open Maps Basemap
            </label>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onSelectBasemap('DARK_VECTOR')}
                className={`p-2 rounded-xl border text-left text-xs  transition-all flex flex-col gap-0.5 ${
                  basemap === 'DARK_VECTOR'
                    ? 'bg-accent/15 border-accent text-ink '
                    : 'bg-canvas border-line text-ink-muted hover:text-ink'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-accent" />
                  Dark Vector
                </span>
                <span className="text-xs text-ink-muted">Tactical grid</span>
              </button>

              <button
                onClick={() => onSelectBasemap('OPEN_SEA_MAP')}
                className={`p-2 rounded-xl border text-left text-xs  transition-all flex flex-col gap-0.5 ${
                  basemap === 'OPEN_SEA_MAP'
                    ? 'bg-success-ink/15 border-success-ink text-ink '
                    : 'bg-canvas border-line text-ink-muted hover:text-ink'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-success-ink" />
                  OpenSeaMap
                </span>
                <span className="text-xs text-ink-muted">Nautical soundings</span>
              </button>

              <button
                onClick={() => onSelectBasemap('OPEN_STREET_MAP')}
                className={`p-2 rounded-xl border text-left text-xs  transition-all flex flex-col gap-0.5 ${
                  basemap === 'OPEN_STREET_MAP'
                    ? 'bg-warning-ink/15 border-warning-ink text-ink '
                    : 'bg-canvas border-line text-ink-muted hover:text-ink'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-warning-ink" />
                  OpenStreetMap
                </span>
                <span className="text-xs text-ink-muted">Topographic land</span>
              </button>

              <button
                onClick={() => onSelectBasemap('OPEN_TOPO_BATHYMETRY')}
                className={`p-2 rounded-xl border text-left text-xs  transition-all flex flex-col gap-0.5 ${
                  basemap === 'OPEN_TOPO_BATHYMETRY'
                    ? 'bg-ink/15 border-line text-ink '
                    : 'bg-canvas border-line text-ink-muted hover:text-ink'
                }`}
              >
                <span className="font-bold flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-ink" />
                  Bathymetry
                </span>
                <span className="text-xs text-ink-muted">Depth contours</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: WEATHER & WIND OVERLAY TOGGLES */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-xs text-ink-muted block">
              Weather Overlays
            </label>

            <div className="space-y-1">
              {/* Wind Particle Streamlines */}
              <button
                onClick={() => onToggleOverlay('windParticles')}
                className={`w-full p-2 rounded-xl border text-xs  transition-all flex items-center justify-between ${
                  overlays.windParticles
                    ? 'bg-accent/10 border-accent text-ink'
                    : 'bg-canvas border-line text-ink-muted'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <Wind className="w-3.5 h-3.5 text-accent" />
                  Wind Streamlines
                </span>
                <span className={`text-xs font-bold ${overlays.windParticles ? 'text-accent' : 'text-ink-muted'}`}>
                  {overlays.windParticles ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Wind Barb Vectors */}
              <button
                onClick={() => onToggleOverlay('windBarbs')}
                className={`w-full p-2 rounded-xl border text-xs  transition-all flex items-center justify-between ${
                  overlays.windBarbs
                    ? 'bg-success-ink/10 border-success-ink text-ink'
                    : 'bg-canvas border-line text-ink-muted'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <Compass className="w-3.5 h-3.5 text-success-ink" />
                  Wind Direction Vectors
                </span>
                <span className={`text-xs font-bold ${overlays.windBarbs ? 'text-success-ink' : 'text-ink-muted'}`}>
                  {overlays.windBarbs ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Isobar Pressure Lines */}
              <button
                onClick={() => onToggleOverlay('isobars')}
                className={`w-full p-2 rounded-xl border text-xs  transition-all flex items-center justify-between ${
                  overlays.isobars
                    ? 'bg-warning-ink/10 border-warning-ink text-ink'
                    : 'bg-canvas border-line text-ink-muted'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <CloudRain className="w-3.5 h-3.5 text-warning-ink" />
                  Isobar Pressure (hPa)
                </span>
                <span className={`text-xs font-bold ${overlays.isobars ? 'text-warning-ink' : 'text-ink-muted'}`}>
                  {overlays.isobars ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Tidal Ocean Currents */}
              <button
                onClick={() => onToggleOverlay('oceanCurrents')}
                className={`w-full p-2 rounded-xl border text-xs  transition-all flex items-center justify-between ${
                  overlays.oceanCurrents
                    ? 'bg-ink/10 border-line text-ink'
                    : 'bg-canvas border-line text-ink-muted'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <Waves className="w-3.5 h-3.5 text-ink-muted" />
                  Ocean Currents
                </span>
                <span className={`text-xs font-bold ${overlays.oceanCurrents ? 'text-ink-muted' : 'text-ink-muted'}`}>
                  {overlays.oceanCurrents ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Wave Height Heatmap */}
              <button
                onClick={() => onToggleOverlay('waveHeatmap')}
                className={`w-full p-2 rounded-xl border text-xs  transition-all flex items-center justify-between ${
                  overlays.waveHeatmap
                    ? 'bg-danger/10 border-danger-ink text-ink'
                    : 'bg-canvas border-line text-ink-muted'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <Eye className="w-3.5 h-3.5 text-danger-ink" />
                  Wave & Swell Height
                </span>
                <span className={`text-xs font-bold ${overlays.waveHeatmap ? 'text-danger-ink' : 'text-ink-muted'}`}>
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
